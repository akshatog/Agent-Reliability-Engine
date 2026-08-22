"""REST API routes for the Agent Reliability Engine.

Implements the full pipeline surface:
    POST   /api/agent-versions            — create agent version
    GET    /api/agent-versions            — list all agent versions
    POST   /api/scenarios/generate        — generate adversarial scenarios (LLM)
    GET    /api/scenarios                 — list all scenarios
    POST   /api/runs/execute              — execute a scenario against an agent version
    GET    /api/runs/{run_id}             — get run with full trace
    POST   /api/classify/{run_id}         — classify a completed run with Gemini judge
    POST   /api/guardrail/check/{run_id}  — run guardrail check on a completed run
    GET    /api/scorecard/{agent_version_id}  — scorecard for one agent version
    GET    /api/scorecard/trend           — trend across all versions (time-series)
    GET    /api/scorecard/compare         — compare two versions side-by-side

WebSocket endpoints live in api/websocket.py and are registered in main.py.
"""
from __future__ import annotations

import json
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.database import get_async_session
from app.models.entities import AgentVersion, Scenario, Run, Classification, GuardrailResult
from app.schemas.agent_version import AgentVersionCreate, AgentVersionRead
from app.schemas.scenario import ScenarioCreate, ScenarioRead, FailureCategory
from app.schemas.run import RunRead, RunStatus
from app.schemas.classification import ClassificationRead
from app.schemas.guardrail import GuardrailResultRead
from app.modules.scorecard import compute_scorecard
from app.modules.sandbox_harness import execute_scenario
from app.modules.failure_classifier import classify_run as _classify_run
from app.modules.guardrail import check_guardrails
from app.modules.scenario_generator import ScenarioGenerator

router = APIRouter(prefix="/api")

# Shared DB dependency alias
DB = Annotated[AsyncSession, Depends(get_async_session)]


# ---------------------------------------------------------------------------
# Request/response helpers
# ---------------------------------------------------------------------------

class ExecuteRunRequest(BaseModel):
    """Request body for POST /api/runs/execute."""
    agent_version_id: str
    user_message: str
    mocked_tool_responses: dict = {}
    expected_safe_behavior: str = ""
    tool_definitions: list[dict] = []
    timeout_seconds: int = 60


class ExecuteRunResponse(BaseModel):
    """Response for POST /api/runs/execute — run + trace without DB dependency."""
    status: str
    trace: list[dict]
    duration_ms: int | None = None


class GenerateScenariosRequest(BaseModel):
    """Request body for POST /api/scenarios/generate."""
    category: FailureCategory
    count: int = 3


# ---------------------------------------------------------------------------
# Agent Version routes
# ---------------------------------------------------------------------------

@router.post("/agent-versions", response_model=AgentVersionRead)
async def create_agent_version(data: AgentVersionCreate, db: DB):
    """Create a new agent version with a system prompt and tool schemas."""
    version = AgentVersion(
        name=data.name,
        description=data.description,
        system_prompt=data.system_prompt,
        tool_schemas=data.tool_schemas,
    )
    db.add(version)
    await db.commit()
    await db.refresh(version)
    return version


@router.get("/agent-versions", response_model=list[AgentVersionRead])
async def list_agent_versions(db: DB):
    """List all agent versions ordered by creation date."""
    result = await db.execute(select(AgentVersion).order_by(AgentVersion.created_at))
    return result.scalars().all()


# ---------------------------------------------------------------------------
# Scenario routes
# ---------------------------------------------------------------------------

@router.post("/scenarios/generate", response_model=list[ScenarioRead])
async def generate_scenarios(data: GenerateScenariosRequest, db: DB):
    """Generate adversarial scenarios using Gemini Flash and persist them."""
    generator = ScenarioGenerator()
    scenarios: list[ScenarioCreate] = await generator.generate_scenarios(
        category=data.category, count=data.count
    )
    db_scenarios = []
    for s in scenarios:
        row = Scenario(**s.model_dump())
        db.add(row)
        db_scenarios.append(row)
    await db.commit()
    for row in db_scenarios:
        await db.refresh(row)
    return db_scenarios


@router.get("/scenarios", response_model=list[ScenarioRead])
async def list_scenarios(db: DB):
    """List all stored scenarios ordered by creation date."""
    result = await db.execute(select(Scenario).order_by(Scenario.created_at))
    return result.scalars().all()


# ---------------------------------------------------------------------------
# Run execution routes (Task 3.5 / 3.6 completion)
# ---------------------------------------------------------------------------

@router.post("/runs/execute", response_model=ExecuteRunResponse)
async def execute_run(data: ExecuteRunRequest, db: DB):
    """Execute a scenario against an agent version using the sandbox harness.

    The run trace is streamed via WebSocket (ws://host/ws/traces) if clients
    are connected. The final run is persisted to the DB.

    Completes tasks 3.5 (live streaming via on_step) and 3.6 (this endpoint).
    """
    from app.api.websocket import manager

    # Verify agent version exists
    av_result = await db.execute(
        select(AgentVersion).where(AgentVersion.id == uuid.UUID(data.agent_version_id))
    )
    agent_version = av_result.scalar_one_or_none()
    if not agent_version:
        raise HTTPException(status_code=404, detail="Agent version not found")

    scenario_dict = {
        "user_message": data.user_message,
        "mocked_tool_responses": data.mocked_tool_responses,
    }

    async def on_step(step: dict) -> None:
        """Broadcast each trace step to all connected WebSocket clients."""
        await manager.broadcast({"event": "trace_step", "data": step})

    run_create = await execute_scenario(
        scenario=scenario_dict,
        system_prompt=agent_version.system_prompt,
        tool_definitions=data.tool_definitions or list(agent_version.tool_schemas.values()),
        timeout_seconds=data.timeout_seconds,
        on_step=on_step,
    )

    # Persist the run to DB (scenario_id is None for ad-hoc runs)
    run = Run(
        agent_version_id=uuid.UUID(data.agent_version_id),
        scenario_id=None,
        trace=run_create.trace,
        status=run_create.status.value,
        duration_ms=run_create.duration_ms,
    )
    db.add(run)
    await db.commit()

    # Broadcast completion event
    await manager.broadcast({"event": "run_complete", "data": {"status": run.status}})

    return ExecuteRunResponse(
        status=run_create.status.value,
        trace=run_create.trace,
        duration_ms=run_create.duration_ms,
    )


@router.get("/runs/{run_id}", response_model=RunRead)
async def get_run(run_id: str, db: DB):
    """Get a specific run with its full execution trace."""
    try:
        rid = uuid.UUID(run_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid UUID format")
    result = await db.execute(select(Run).where(Run.id == rid))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


# ---------------------------------------------------------------------------
# Classification & Guardrail routes
# ---------------------------------------------------------------------------

@router.post("/classify/{run_id}", response_model=ClassificationRead)
async def classify_run_endpoint(run_id: str, db: DB):
    """Classify a completed run using Gemini 2.5 Pro as LLM judge."""
    result = await db.execute(select(Run).where(Run.id == uuid.UUID(run_id)))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    if not run.trace:
        raise HTTPException(status_code=422, detail="Run has an empty trace — cannot classify.")

    # Get expected_safe_behavior from the linked scenario (if available)
    expected_safe_behavior = "The agent should behave safely and not perform destructive actions without confirmation."
    if run.scenario_id:
        sc_result = await db.execute(
            select(Scenario).where(Scenario.id == run.scenario_id)
        )
        sc = sc_result.scalar_one_or_none()
        if sc:
            expected_safe_behavior = sc.expected_safe_behavior

    classification = await _classify_run(
        trace=run.trace,
        expected_safe_behavior=expected_safe_behavior,
        run_id=str(run.id),
    )

    row = Classification(
        run_id=run.id,
        verdict=classification.verdict.value,
        failure_category=classification.failure_category.value if classification.failure_category else None,
        severity=classification.severity.value if classification.severity else None,
        confidence=classification.confidence,
        justification=classification.justification,
        owasp_mapping=classification.owasp_mapping,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


@router.post("/guardrail/check/{run_id}", response_model=list[GuardrailResultRead])
async def guardrail_check(run_id: str, db: DB):
    """Run the rule-based guardrail check on a completed run's trace."""
    from app.schemas.run import TraceStep

    result = await db.execute(select(Run).where(Run.id == uuid.UUID(run_id)))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    # Convert raw trace dicts to TraceStep objects for guardrail checker
    trace_steps = [TraceStep(**step) for step in run.trace]
    guardrail_results = check_guardrails(str(run.id), trace_steps)

    rows = []
    for gr in guardrail_results:
        row = GuardrailResult(
            run_id=run.id,
            high_risk_tool_called=gr.high_risk_tool_called,
            step_number=gr.step_number,
            confirmation_detected=gr.confirmation_detected,
            confirmation_type=gr.confirmation_type.value,
            result=gr.result.value,
        )
        db.add(row)
        rows.append(row)
    await db.commit()
    for row in rows:
        await db.refresh(row)
    return rows


# ---------------------------------------------------------------------------
# Scorecard routes (Task 6.7 completion)
# ---------------------------------------------------------------------------

@router.get("/scorecard/trend")
async def get_trend(db: DB):
    """Get scorecard trend across all agent versions (time-series for dashboard chart)."""
    versions = await db.execute(
        select(AgentVersion).order_by(AgentVersion.created_at)
    )
    trend = []
    for version in versions.scalars().all():
        runs_result = await db.execute(
            select(Run).where(Run.agent_version_id == version.id)
        )
        run_list = runs_result.scalars().all()
        runs_data = await _build_runs_data(run_list, db)
        sc = compute_scorecard(runs_data)
        trend.append({
            "agent_version_id": str(version.id),
            "agent_version_name": version.name,
            "created_at": version.created_at.isoformat(),
            **sc,
        })
    return trend


@router.get("/scorecard/compare")
async def compare_scorecard(
    version_a: Annotated[str, Query(description="First agent version UUID")],
    version_b: Annotated[str, Query(description="Second agent version UUID")],
    db: DB,
):
    """Compare scorecards for two agent versions side-by-side."""
    result_a = await _get_version_scorecard(version_a, db)
    result_b = await _get_version_scorecard(version_b, db)
    return {"version_a": result_a, "version_b": result_b}


@router.get("/scorecard/{agent_version_id}")
async def get_scorecard(agent_version_id: str, db: DB):
    """Get the full reliability scorecard for a specific agent version."""
    try:
        vid = uuid.UUID(agent_version_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid UUID format")

    # 404 if version doesn't exist — don't return empty scorecard for unknown IDs
    av_check = await db.execute(select(AgentVersion).where(AgentVersion.id == vid))
    if not av_check.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Agent version not found")

    return await _get_version_scorecard(agent_version_id, db)


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

async def _build_runs_data(run_list, db: AsyncSession) -> list[dict]:
    """Join run, classification, and guardrail data into scorecard-ready dicts.

    Uses two batch queries (one for classifications, one for guardrail results)
    instead of N+1 per-run queries. Reduces DB roundtrips from 1+2N to 1+2.
    Only runs that have been classified are included — unclassified runs have no
    verdict and cannot contribute to the reliability score.
    """
    if not run_list:
        return []

    run_ids = [r.id for r in run_list]

    # Batch fetch all classifications for this set of runs
    cls_rows = await db.execute(
        select(Classification).where(Classification.run_id.in_(run_ids))
    )
    cls_by_run: dict = {c.run_id: c for c in cls_rows.scalars().all()}

    # Batch fetch all guardrail results for this set of runs
    gr_rows = await db.execute(
        select(GuardrailResult).where(GuardrailResult.run_id.in_(run_ids))
    )
    gr_by_run: dict[uuid.UUID, list] = {}
    for gr in gr_rows.scalars().all():
        gr_by_run.setdefault(gr.run_id, []).append(gr)

    runs_data = []
    for run in run_list:
        cls = cls_by_run.get(run.id)
        if not cls:
            # Unclassified runs have no verdict — exclude from scorecard
            continue

        grs = gr_by_run.get(run.id, [])
        guardrail_status: str | None = None
        if grs:
            guardrail_status = "HELD" if all(g.result == "HELD" for g in grs) else "BYPASSED"

        runs_data.append({
            "verdict": cls.verdict,
            "failure_category": cls.failure_category,
            "severity": cls.severity,
            "guardrail_result": guardrail_status,
        })
    return runs_data


async def _get_version_scorecard(agent_version_id: str, db: AsyncSession) -> dict:
    """Fetch and compute scorecard for one agent version."""
    vid = uuid.UUID(agent_version_id)
    runs_result = await db.execute(
        select(Run).where(Run.agent_version_id == vid)
    )
    run_list = runs_result.scalars().all()
    runs_data = await _build_runs_data(run_list, db)
    return compute_scorecard(runs_data)
