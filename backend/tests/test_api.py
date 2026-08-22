"""Tests for REST API endpoints (Task 8).

Strategy: Tests use the real Neon Postgres via the app's DATABASE_URL.
Each test runs inside a transaction that is rolled back after the test
completes, keeping the database clean without requiring a separate test DB.

The ASGI client is patched to override the DB session dependency so every
request in a test uses the same rolled-back transaction.
"""
from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, MagicMock, patch

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

from app.config import settings
from app.models.entities import Base
from app.main import app
from app.database import get_async_session


# ---------------------------------------------------------------------------
# Real-DB transaction-rollback fixture
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture(scope="function")
async def db_session():
    """
    Yield an async DB session that wraps every test in a SAVEPOINT.
    On teardown the SAVEPOINT is rolled back, leaving the DB clean.
    Uses NullPool so each fixture creates a fresh connection.
    """
    engine = create_async_engine(settings.database_url, poolclass=NullPool)
    async with engine.connect() as conn:
        await conn.begin()
        session_factory = async_sessionmaker(
            bind=conn,
            class_=AsyncSession,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        )
        async with session_factory() as session:
            yield session
            await session.rollback()
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def client(db_session):
    """ASGI test client with DB dependency overridden to the test session."""
    async def override_get_session():
        yield db_session

    app.dependency_overrides[get_async_session] = override_get_session
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Health endpoint
# ---------------------------------------------------------------------------

class TestHealthEndpoint:
    @pytest.mark.asyncio
    async def test_health_returns_ok(self, client):
        response = await client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"

    @pytest.mark.asyncio
    async def test_health_returns_json_content_type(self, client):
        response = await client.get("/health")
        assert response.headers["content-type"].startswith("application/json")

    @pytest.mark.asyncio
    async def test_health_does_not_require_auth(self, client):
        """Health check should be publicly accessible."""
        response = await client.get("/health")
        assert response.status_code != 401
        assert response.status_code != 403


# ---------------------------------------------------------------------------
# Agent Version endpoints
# ---------------------------------------------------------------------------

class TestAgentVersionEndpoints:
    @pytest.mark.asyncio
    async def test_create_agent_version_returns_success(self, client):
        response = await client.post("/api/agent-versions", json={
            "name": "Test Agent v1",
            "description": "Test description",
            "system_prompt": "You are a test agent.",
            "tool_schemas": {},
        })
        assert response.status_code in (200, 201)
        data = response.json()
        assert "id" in data
        assert data["name"] == "Test Agent v1"

    @pytest.mark.asyncio
    async def test_create_agent_version_stores_system_prompt(self, client):
        response = await client.post("/api/agent-versions", json={
            "name": "Prompt Agent",
            "system_prompt": "You are a strict guardrail agent.",
            "tool_schemas": {},
        })
        assert response.status_code in (200, 201)
        assert response.json()["system_prompt"] == "You are a strict guardrail agent."

    @pytest.mark.asyncio
    async def test_create_agent_version_returns_uuid(self, client):
        response = await client.post("/api/agent-versions", json={
            "name": "UUID Test Agent",
            "system_prompt": "Test.",
            "tool_schemas": {},
        })
        data = response.json()
        assert "id" in data
        # UUID format validation
        import uuid
        uuid.UUID(data["id"])  # Raises ValueError if not valid UUID

    @pytest.mark.asyncio
    async def test_create_agent_version_returns_created_at(self, client):
        response = await client.post("/api/agent-versions", json={
            "name": "Timestamp Agent",
            "system_prompt": "Test.",
            "tool_schemas": {},
        })
        data = response.json()
        assert "created_at" in data
        assert data["created_at"] is not None

    @pytest.mark.asyncio
    async def test_list_agent_versions_returns_empty_list_initially(self, client):
        response = await client.get("/api/agent-versions")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    @pytest.mark.asyncio
    async def test_list_agent_versions_reflects_created(self, client):
        await client.post("/api/agent-versions", json={
            "name": "Agent Alpha",
            "system_prompt": "Alpha.",
            "tool_schemas": {},
        })
        await client.post("/api/agent-versions", json={
            "name": "Agent Beta",
            "system_prompt": "Beta.",
            "tool_schemas": {},
        })
        response = await client.get("/api/agent-versions")
        data = response.json()
        assert isinstance(data, list)
        names = [d["name"] for d in data]
        assert "Agent Alpha" in names
        assert "Agent Beta" in names

    @pytest.mark.asyncio
    async def test_create_agent_version_missing_system_prompt_returns_422(self, client):
        """system_prompt is required — missing it should return 422."""
        response = await client.post("/api/agent-versions", json={
            "name": "Incomplete Agent",
        })
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_agent_version_missing_name_returns_422(self, client):
        response = await client.post("/api/agent-versions", json={
            "system_prompt": "You are a test agent.",
        })
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# Scenarios endpoints
# ---------------------------------------------------------------------------

class TestScenariosEndpoints:
    @pytest.mark.asyncio
    async def test_list_scenarios_returns_list(self, client):
        response = await client.get("/api/scenarios")
        assert response.status_code == 200
        assert isinstance(response.json(), list)


# ---------------------------------------------------------------------------
# Scorecard endpoint
# ---------------------------------------------------------------------------

class TestScorecardEndpoint:
    @pytest.mark.asyncio
    async def test_scorecard_with_no_runs_returns_zero_score(self, client):
        av_resp = await client.post("/api/agent-versions", json={
            "name": "Scorecard Agent",
            "system_prompt": "Test.",
            "tool_schemas": {},
        })
        agent_version_id = av_resp.json()["id"]

        response = await client.get(f"/api/scorecard/{agent_version_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["overall_reliability_score"] == 0.0
        assert data["total_runs"] == 0

    @pytest.mark.asyncio
    async def test_scorecard_has_all_required_fields(self, client):
        av_resp = await client.post("/api/agent-versions", json={
            "name": "Fields Agent",
            "system_prompt": "Test.",
            "tool_schemas": {},
        })
        agent_version_id = av_resp.json()["id"]

        response = await client.get(f"/api/scorecard/{agent_version_id}")
        data = response.json()
        required = {
            "overall_reliability_score", "total_runs", "passes", "failures",
            "per_category_breakdown", "guardrail_hold_rate",
            "severity_distribution", "owasp_risk_profile", "confidence_interval",
        }
        assert required.issubset(set(data.keys()))

    @pytest.mark.asyncio
    async def test_scorecard_invalid_uuid_returns_422(self, client):
        response = await client.get("/api/scorecard/not-a-uuid")
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# Execute run endpoint (mocked LangGraph — no real LLM)
# ---------------------------------------------------------------------------

class TestExecuteEndpoint:
    @pytest.mark.asyncio
    async def test_execute_run_returns_run_data(self, client):
        from langchain_core.messages import AIMessage

        mock_graph = MagicMock()
        mock_graph.ainvoke = AsyncMock(
            return_value={"messages": [AIMessage(content="Service is healthy.")]}
        )

        av_resp = await client.post("/api/agent-versions", json={
            "name": "Execute Agent",
            "system_prompt": "You are a DevOps assistant.",
            "tool_schemas": {},
        })
        agent_version_id = av_resp.json()["id"]

        with patch("app.modules.sandbox_harness.create_devops_agent", return_value=mock_graph):
            response = await client.post("/api/runs/execute", json={
                "agent_version_id": agent_version_id,
                "user_message": "What is the status of the service?",
                "mocked_tool_responses": {},
                "expected_safe_behavior": "Agent should check service status.",
            })

        assert response.status_code in (200, 201)
        data = response.json()
        assert "status" in data
        assert "trace" in data

    @pytest.mark.asyncio
    async def test_execute_run_status_is_completed(self, client):
        from langchain_core.messages import AIMessage

        mock_graph = MagicMock()
        mock_graph.ainvoke = AsyncMock(
            return_value={"messages": [AIMessage(content="Done.")]}
        )

        av_resp = await client.post("/api/agent-versions", json={
            "name": "Status Agent",
            "system_prompt": "You are a DevOps assistant.",
            "tool_schemas": {},
        })
        agent_version_id = av_resp.json()["id"]

        with patch("app.modules.sandbox_harness.create_devops_agent", return_value=mock_graph):
            response = await client.post("/api/runs/execute", json={
                "agent_version_id": agent_version_id,
                "user_message": "Do it.",
                "mocked_tool_responses": {},
                "expected_safe_behavior": "Complete the task.",
            })

        assert response.json()["status"] == "COMPLETED"

    @pytest.mark.asyncio
    async def test_execute_run_missing_agent_version_id_returns_422(self, client):
        response = await client.post("/api/runs/execute", json={
            "user_message": "Do it.",
        })
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# Trend endpoint
# ---------------------------------------------------------------------------

class TestTrendEndpoint:
    @pytest.mark.asyncio
    async def test_trend_returns_list(self, client):
        response = await client.get("/api/scorecard/trend")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    @pytest.mark.asyncio
    async def test_trend_includes_created_agent_version(self, client):
        await client.post("/api/agent-versions", json={
            "name": "Trend Agent",
            "system_prompt": "Test.",
            "tool_schemas": {},
        })
        response = await client.get("/api/scorecard/trend")
        data = response.json()
        names = [d["agent_version_name"] for d in data]
        assert "Trend Agent" in names

    @pytest.mark.asyncio
    async def test_trend_entry_has_scorecard_fields(self, client):
        await client.post("/api/agent-versions", json={
            "name": "Trend Fields Agent",
            "system_prompt": "Test.",
            "tool_schemas": {},
        })
        response = await client.get("/api/scorecard/trend")
        data = response.json()
        entry = next(d for d in data if d["agent_version_name"] == "Trend Fields Agent")
        assert "overall_reliability_score" in entry
        assert "agent_version_id" in entry
