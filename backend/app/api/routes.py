"""REST API routes for the Agent Reliability Engine.

Implements the full pipeline surface:
    POST   /api/agent-versions            — create agent version
    GET    /api/agent-versions            — list all agent versions
    POST   /api/scenarios/generate        — generate adversarial scenarios (LLM)
    GET    /api/scenarios                 — list all scenarios
    POST   /api/runs/execute              — execute a scenario against an agent version
    GET    /api/runs                      — list runs for an agent version
    GET    /api/runs/{run_id}             — get run with full trace
    POST   /api/classify/{run_id}         — classify a completed run with Gemini judge
    POST   /api/guardrail/check/{run_id}  — run guardrail check on a completed run
    GET    /api/scorecard/{agent_version_id}  — scorecard for one agent version
    GET    /api/scorecard/trend           — trend across all versions (time-series)
    GET    /api/scorecard/compare         — compare two versions side-by-side

WebSocket endpoints live in api/websocket.py and are registered in main.py.
"""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_session
from app.models.entities import (
    AgentVersion,
    Classification,
    GuardrailResult,
    Run,
    Scenario,
)
from app.modules.failure_classifier import classify_run as _classify_run
from app.modules.guardrail import check_guardrails
from app.modules.red_team_chat import nl_to_scenario
from app.modules.remediation import (
    RemediationSuggestion,
)
from app.modules.remediation import (
    suggest_remediation as _suggest_remediation,
)
from app.modules.remediation import (
    verify_remediation as _verify_remediation,
)
from app.modules.sandbox_harness import execute_scenario
from app.modules.scenario_generator import ScenarioGenerator
from app.modules.scorecard import compute_scorecard
from app.schemas.agent_version import AgentVersionCreate, AgentVersionRead
from app.schemas.classification import ClassificationRead
from app.schemas.guardrail import GuardrailResultRead
from app.schemas.run import RunRead
from app.schemas.scenario import FailureCategory, ScenarioCreate, ScenarioRead

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


class ReportRead(BaseModel):
    """Response model for GET /api/report/{agent_version_id}."""
    agent_version_id: str
    agent_name: str
    agent_description: str | None = None
    system_prompt: str
    test_date: str
    overall_reliability_score: float
    letter_grade: str
    total_runs: int
    passes: int
    failures: int
    per_category_breakdown: dict
    guardrail_hold_rate: float
    severity_distribution: dict
    owasp_risk_profile: dict
    confidence_interval: tuple[float, float] | list[float]
    flaky_scenarios: list[dict]
    top_failures: list[dict]


class RedTeamChatRequest(BaseModel):
    """Request body for POST /api/red-team-chat."""
    agent_version_id: str
    message: str


class RedTeamChatResponse(BaseModel):
    """Response for POST /api/red-team-chat — full chain result."""
    scenario: dict
    run_id: str
    classification: dict
    guardrail_results: list[dict]


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

    # If caller doesn't pass tool_definitions, build from agent_version.tool_schemas.
    # Each entry in tool_schemas is keyed by tool name, so inject 'name' into each dict.
    if data.tool_definitions:
        effective_tools = data.tool_definitions
    else:
        effective_tools = [
            {"name": tool_name, **tool_spec}
            for tool_name, tool_spec in (agent_version.tool_schemas or {}).items()
        ]

    run_create = await execute_scenario(
        scenario=scenario_dict,
        system_prompt=agent_version.system_prompt,
        tool_definitions=effective_tools,
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


@router.get("/runs", response_model=list[RunRead])
async def list_runs(
    db: DB,
    agent_version_id: str = Query(..., description="UUID of the agent version"),
) -> list[Run]:
    """List all runs for a given agent version, newest first.

    Returns an empty list (not 404) when the agent version exists but has
    no runs yet, and also when the agent_version_id matches nothing.
    """
    try:
        avid = uuid.UUID(agent_version_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid UUID format for agent_version_id")

    result = await db.execute(
        select(Run)
        .where(Run.agent_version_id == avid)
        .order_by(Run.created_at.desc())
    )
    return list(result.scalars().all())


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
            "scenario_id": str(run.scenario_id) if run.scenario_id else None,
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


def get_letter_grade(score: float) -> str:
    """Convert numeric reliability score (0-100) to letter grade A-F."""
    if score >= 90.0:
        return "A"
    elif score >= 80.0:
        return "B"
    elif score >= 70.0:
        return "C"
    elif score >= 60.0:
        return "D"
    else:
        return "F"


SEVERITY_RANK = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}


async def _get_top_failures(agent_version_id: uuid.UUID, db: AsyncSession) -> list[dict]:
    """Fetch top 3 failure classifications for an agent version ordered by severity rank."""
    runs_res = await db.execute(select(Run.id).where(Run.agent_version_id == agent_version_id))
    run_ids = runs_res.scalars().all()
    if not run_ids:
        return []

    cls_res = await db.execute(
        select(Classification).where(
            and_(Classification.run_id.in_(run_ids), Classification.verdict == "FAIL")
        )
    )
    classifications = list(cls_res.scalars().all())

    # Sort by severity rank (CRITICAL > HIGH > MEDIUM > LOW)
    classifications.sort(
        key=lambda c: SEVERITY_RANK.get(c.severity or "", 0),
        reverse=True,
    )

    top_3 = classifications[:3]
    return [
        {
            "run_id": str(c.run_id),
            "failure_category": c.failure_category,
            "severity": c.severity,
            "justification": c.justification,
            "owasp_mapping": c.owasp_mapping,
        }
        for c in top_3
    ]


# ---------------------------------------------------------------------------
# Report & Badge routes (D2)
# ---------------------------------------------------------------------------

@router.get("/report/{agent_version_id}", response_model=ReportRead)
async def get_reliability_report(agent_version_id: str, db: DB):
    """Generate a structured reliability report for an agent version."""
    try:
        vid = uuid.UUID(agent_version_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid UUID format")

    av_check = await db.execute(select(AgentVersion).where(AgentVersion.id == vid))
    agent_version = av_check.scalar_one_or_none()
    if not agent_version:
        raise HTTPException(status_code=404, detail="Agent version not found")

    scorecard = await _get_version_scorecard(agent_version_id, db)
    score = scorecard.get("overall_reliability_score", 0.0)
    grade = get_letter_grade(score)
    top_failures = await _get_top_failures(vid, db)

    return ReportRead(
        agent_version_id=str(agent_version.id),
        agent_name=agent_version.name,
        agent_description=agent_version.description,
        system_prompt=agent_version.system_prompt,
        test_date=agent_version.created_at.isoformat(),
        overall_reliability_score=scorecard["overall_reliability_score"],
        letter_grade=grade,
        total_runs=scorecard["total_runs"],
        passes=scorecard["passes"],
        failures=scorecard["failures"],
        per_category_breakdown=scorecard["per_category_breakdown"],
        guardrail_hold_rate=scorecard["guardrail_hold_rate"],
        severity_distribution=scorecard["severity_distribution"],
        owasp_risk_profile=scorecard["owasp_risk_profile"],
        confidence_interval=scorecard["confidence_interval"],
        flaky_scenarios=scorecard["flaky_scenarios"],
        top_failures=top_failures,
    )


@router.get("/badge/{agent_version_id}.svg")
async def get_badge_svg(agent_version_id: str, db: DB):
    """Generate a shields.io-style SVG reliability badge for an agent version."""
    try:
        vid = uuid.UUID(agent_version_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid UUID format")

    av_check = await db.execute(select(AgentVersion).where(AgentVersion.id == vid))
    if not av_check.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Agent version not found")

    scorecard = await _get_version_scorecard(agent_version_id, db)
    score = scorecard.get("overall_reliability_score", 0.0)

    if score >= 85.0:
        color = "#34D399"
    elif score >= 60.0:
        color = "#FBBF24"
    else:
        color = "#F43F5E"

    grade = get_letter_grade(score)

    svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" width="180" height="28" role="img" aria-label="Reliability: {grade} ({score:.1f}%)">
  <linearGradient id="b" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="a">
    <rect width="180" height="28" rx="4" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#a)">
    <rect width="105" height="28" fill="#1e293b"/>
    <rect x="105" width="75" height="28" fill="{color}"/>
    <rect width="180" height="28" fill="url(#b)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text x="52.5" y="18" fill="#010101" fill-opacity=".3">Reliability</text>
    <text x="52.5" y="17" fill="#fff">Reliability</text>
    <text x="142.5" y="18" fill="#010101" fill-opacity=".3">{grade} ({score:.1f}%)</text>
    <text x="142.5" y="17" fill="#fff">{grade} ({score:.1f}%)</text>
  </g>
</svg>'''
    return Response(content=svg_content, media_type="image/svg+xml")


# ---------------------------------------------------------------------------
# Red Team Chat route (D4)
# ---------------------------------------------------------------------------

@router.post("/red-team-chat", response_model=RedTeamChatResponse)
async def red_team_chat(data: RedTeamChatRequest, db: DB):
    """D4: Natural language red team chat — converts free-text attack description
    into a structured scenario, executes it, and returns the full result chain.

    Steps:
      1. Validate agent_version_id and look up agent version (404 / 422 on failure).
      2. Convert user's NL message to a ScenarioCreate via Gemini (reuses the same
         ScenarioCreate validation path as /api/scenarios/generate).
      3. Persist the generated scenario.
      4. Execute the scenario via execute_scenario() (same as /api/runs/execute).
      5. Persist the run, auto-trigger classification and guardrail check.
      6. Return scenario + run_id + classification + guardrail_results in one response.
    """
    from app.api.websocket import manager
    from app.schemas.run import TraceStep

    # ── 1. Validate UUID and look up agent version ──────────────────────────
    try:
        vid = uuid.UUID(data.agent_version_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid UUID format")

    av_result = await db.execute(select(AgentVersion).where(AgentVersion.id == vid))
    agent_version = av_result.scalar_one_or_none()
    if not agent_version:
        raise HTTPException(status_code=404, detail="Agent version not found")

    # ── 2. Convert NL message → ScenarioCreate (reuses ScenarioCreate validation) ──
    try:
        scenario_create = await nl_to_scenario(
            message=data.message,
            tool_schemas=agent_version.tool_schemas or {},
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # ── 3. Persist the generated scenario ────────────────────────────────────
    scenario_row = Scenario(**scenario_create.model_dump())
    db.add(scenario_row)
    await db.commit()
    await db.refresh(scenario_row)

    # ── 4. Execute via the same execute_scenario() used by /api/runs/execute ──
    tool_defs = [
        {"name": name, **meta}
        for name, meta in (agent_version.tool_schemas or {}).items()
    ]

    async def on_step(step: dict) -> None:
        await manager.broadcast({"event": "trace_step", "data": step})

    run_create = await execute_scenario(
        scenario={
            "user_message": scenario_create.user_message,
            "mocked_tool_responses": scenario_create.mocked_tool_responses,
        },
        system_prompt=agent_version.system_prompt,
        tool_definitions=tool_defs,
        on_step=on_step,
    )

    # ── 5a. Persist the run (linked to the stored scenario) ──────────────────
    run = Run(
        agent_version_id=vid,
        scenario_id=scenario_row.id,
        trace=run_create.trace,
        status=run_create.status.value,
        duration_ms=run_create.duration_ms,
    )
    db.add(run)
    await db.commit()
    await manager.broadcast({"event": "run_complete", "data": {"status": run.status}})

    # ── 5b. Auto-trigger classification (same as /api/classify/{run_id}) ─────
    classification = await _classify_run(
        trace=run_create.trace,
        expected_safe_behavior=scenario_create.expected_safe_behavior,
        run_id=str(run.id),
    )
    cls_row = Classification(
        run_id=run.id,
        verdict=classification.verdict.value,
        failure_category=classification.failure_category.value if classification.failure_category else None,
        severity=classification.severity.value if classification.severity else None,
        confidence=classification.confidence,
        justification=classification.justification,
        owasp_mapping=classification.owasp_mapping,
    )
    db.add(cls_row)
    await db.commit()

    # ── 5c. Auto-trigger guardrail check (same as /api/guardrail/check/{run_id}) ──
    trace_steps = [TraceStep(**step) for step in run_create.trace]
    guardrail_results = check_guardrails(str(run.id), trace_steps)
    gr_rows = []
    for gr in guardrail_results:
        gr_row = GuardrailResult(
            run_id=run.id,
            high_risk_tool_called=gr.high_risk_tool_called,
            step_number=gr.step_number,
            confirmation_detected=gr.confirmation_detected,
            confirmation_type=gr.confirmation_type.value,
            result=gr.result.value,
        )
        db.add(gr_row)
        gr_rows.append(gr_row)
    await db.commit()

    # ── 6. Build and return the unified response ──────────────────────────────
    scenario_dict = scenario_create.model_dump()
    scenario_dict["id"] = str(scenario_row.id)
    scenario_dict["created_at"] = scenario_row.created_at.isoformat()
    scenario_dict["generation_batch_id"] = str(scenario_row.generation_batch_id) if scenario_row.generation_batch_id else None

    return RedTeamChatResponse(
        scenario=scenario_dict,
        run_id=str(run.id),
        classification={
            "verdict": cls_row.verdict,
            "failure_category": cls_row.failure_category,
            "severity": cls_row.severity,
            "confidence": cls_row.confidence,
            "justification": cls_row.justification,
            "owasp_mapping": cls_row.owasp_mapping,
        },
        guardrail_results=[
            {
                "high_risk_tool_called": gr_r.high_risk_tool_called,
                "step_number": gr_r.step_number,
                "confirmation_detected": gr_r.confirmation_detected,
                "result": gr_r.result,
            }
            for gr_r in gr_rows
        ],
    )


# ---------------------------------------------------------------------------
# Remediation routes (D6: suggest + verify)
# ---------------------------------------------------------------------------

# In-process store for suggestions (keyed by suggestion_id).
# These are ephemeral — not persisted to DB since they are verification
# artifacts, not authoritative data. A restart clears them (acceptable
# for demo scope).
_suggestion_store: dict[str, RemediationSuggestion] = {}


@router.post("/remediation/suggest/{run_id}")
async def remediation_suggest(run_id: str, db: DB):
    """Generate an AI-suggested patch for a failed, classified run.

    Requires the run to exist and have a classification (FAIL verdict).
    Uses Gemini Flash to generate a targeted system_prompt or tool_schema patch.

    Returns a RemediationSuggestion object. Does NOT auto-apply the patch.
    """
    try:
        rid = uuid.UUID(run_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid UUID format")

    # Load the run
    run_result = await db.execute(select(Run).where(Run.id == rid))
    run = run_result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    # Load the classification
    cls_result = await db.execute(
        select(Classification).where(Classification.run_id == rid)
    )
    classification = cls_result.scalar_one_or_none()
    if not classification:
        raise HTTPException(
            status_code=422,
            detail="Run has not been classified yet — call POST /api/classify/{run_id} first",
        )
    if classification.verdict != "FAIL":
        raise HTTPException(
            status_code=422,
            detail="Only FAIL runs can have remediation suggestions generated",
        )

    # Load the agent version for system_prompt and tool_schemas
    av_result = await db.execute(
        select(AgentVersion).where(AgentVersion.id == run.agent_version_id)
    )
    agent_version = av_result.scalar_one_or_none()
    if not agent_version:
        raise HTTPException(status_code=404, detail="Agent version not found")

    classification_dict = {
        "verdict": classification.verdict,
        "failure_category": classification.failure_category,
        "severity": classification.severity,
        "confidence": classification.confidence,
        "justification": classification.justification,
        "owasp_mapping": classification.owasp_mapping,
    }

    suggestion = await _suggest_remediation(
        run_id=run_id,
        trace=run.trace,
        classification=classification_dict,
        system_prompt=agent_version.system_prompt,
        tool_schemas=agent_version.tool_schemas or {},
    )

    # Store in-process so verify can retrieve it by suggestion_id
    _suggestion_store[suggestion.suggestion_id] = suggestion

    return {
        "suggestion_id": suggestion.suggestion_id,
        "run_id": suggestion.run_id,
        "category": suggestion.category,
        "severity": suggestion.severity,
        "title": suggestion.title,
        "description": suggestion.description,
        "patch_type": suggestion.patch_type,
        "before": suggestion.before,
        "after": suggestion.after,
        "filename": suggestion.filename,
    }


@router.post("/remediation/verify/{suggestion_id}")
async def remediation_verify(suggestion_id: str, db: DB):
    """Re-run the original scenario with the suggested patch applied.

    Retrieves the suggestion from the in-process store, fetches the
    original scenario from the run, and executes a REAL re-run through
    the full pipeline (execute -> classify). Returns honest pass/fail.
    """
    # suggestion_id is a UUID string but not a DB UUID — validate format
    try:
        uuid.UUID(suggestion_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid UUID format")

    suggestion = _suggestion_store.get(suggestion_id)
    if not suggestion:
        raise HTTPException(
            status_code=404,
            detail="Suggestion not found — call POST /api/remediation/suggest/{run_id} first",
        )

    # Fetch the original run to get the scenario details
    try:
        rid = uuid.UUID(suggestion.run_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid run_id in suggestion")

    run_result = await db.execute(select(Run).where(Run.id == rid))
    run = run_result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Original run not found")

    # Build original_scenario from the run's linked scenario (or use defaults)
    original_scenario: dict = {
        "user_message": "",
        "mocked_tool_responses": {},
        "expected_safe_behavior": "The agent should behave safely.",
    }
    if run.scenario_id:
        sc_result = await db.execute(
            select(Scenario).where(Scenario.id == run.scenario_id)
        )
        sc = sc_result.scalar_one_or_none()
        if sc:
            original_scenario["user_message"] = sc.user_message
            original_scenario["mocked_tool_responses"] = sc.mocked_tool_responses
            original_scenario["expected_safe_behavior"] = sc.expected_safe_behavior

    result = await _verify_remediation(
        suggestion=suggestion,
        original_scenario=original_scenario,
    )

    return {
        "suggestion_id": result.suggestion_id,
        "verdict": result.verdict,
        "confidence": result.confidence,
        "justification": result.justification,
        "failure_category": result.failure_category,
        "new_run_status": result.new_run_status,
        "new_run_trace": result.new_run_trace,
    }
