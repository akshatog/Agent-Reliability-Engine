"""Tests for the Sandbox Execution Harness (Module 2)."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from langchain_core.messages import AIMessage, ToolMessage

from app.modules.sandbox_harness import execute_scenario
from app.schemas.run import RunStatus


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

SIMPLE_SCENARIO = {
    "user_message": "What is the status of the api-gateway service?",
    "mocked_tool_responses": {
        "get_service_status": {"status": "healthy", "service": "api-gateway"},
    },
}

SIMPLE_TOOL_DEFS = [
    {
        "name": "get_service_status",
        "description": "Check the current health and status of a deployment or service.",
        "parameters": {
            "type": "object",
            "properties": {
                "service_name": {"type": "string"},
            },
            "required": ["service_name"],
        },
    }
]

NO_TOOL_SCENARIO = {
    "user_message": "Hello, how are you?",
    "mocked_tool_responses": {},
}


def _make_final_ai_message(content: str = "The service is healthy."):
    """AI message with no tool calls — agent is done."""
    msg = MagicMock(spec=AIMessage)
    msg.content = content
    msg.tool_calls = []
    return msg


def _make_tool_call_ai_message(tool_name: str, args: dict):
    """AI message that requests a tool call."""
    msg = MagicMock(spec=AIMessage)
    msg.content = ""
    msg.tool_calls = [{"name": tool_name, "args": args, "id": "tc-001"}]
    return msg


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestExecuteScenarioStructure:
    """Tests for the structure and shape of execute_scenario output."""

    @pytest.mark.asyncio
    async def test_returns_run_with_completed_status(self):
        """A successful execution should produce RunStatus.COMPLETED."""
        final_msg = _make_final_ai_message()
        mock_graph = MagicMock()
        mock_graph.ainvoke = AsyncMock(return_value={"messages": [final_msg]})

        with patch("app.modules.sandbox_harness.create_devops_agent", return_value=mock_graph):
            result = await execute_scenario(
                scenario=NO_TOOL_SCENARIO,
                system_prompt="You are a DevOps assistant.",
                tool_definitions=[],
            )

        assert result.status == RunStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_trace_is_non_empty_after_execution(self):
        """Trace must have at least one step after any execution."""
        final_msg = _make_final_ai_message()
        mock_graph = MagicMock()
        mock_graph.ainvoke = AsyncMock(return_value={"messages": [final_msg]})

        with patch("app.modules.sandbox_harness.create_devops_agent", return_value=mock_graph):
            result = await execute_scenario(
                scenario=NO_TOOL_SCENARIO,
                system_prompt="You are a DevOps assistant.",
                tool_definitions=[],
            )

        assert len(result.trace) > 0

    @pytest.mark.asyncio
    async def test_trace_steps_have_required_keys(self):
        """Every trace step must contain step_number, step_type, content, risk_level."""
        final_msg = _make_final_ai_message()
        mock_graph = MagicMock()
        mock_graph.ainvoke = AsyncMock(return_value={"messages": [final_msg]})

        with patch("app.modules.sandbox_harness.create_devops_agent", return_value=mock_graph):
            result = await execute_scenario(
                scenario=NO_TOOL_SCENARIO,
                system_prompt="You are a DevOps assistant.",
                tool_definitions=[],
            )

        for step in result.trace:
            assert "step_number" in step
            assert "step_type" in step
            assert "content" in step
            assert "risk_level" in step

    @pytest.mark.asyncio
    async def test_step_numbers_are_sequential(self):
        """Step numbers must start at 1 and be strictly increasing."""
        final_msg = _make_final_ai_message()
        mock_graph = MagicMock()
        mock_graph.ainvoke = AsyncMock(return_value={"messages": [final_msg]})

        with patch("app.modules.sandbox_harness.create_devops_agent", return_value=mock_graph):
            result = await execute_scenario(
                scenario=NO_TOOL_SCENARIO,
                system_prompt="You are a DevOps assistant.",
                tool_definitions=[],
            )

        step_numbers = [s["step_number"] for s in result.trace]
        assert step_numbers == sorted(step_numbers)
        assert step_numbers[0] == 1

    @pytest.mark.asyncio
    async def test_step_types_are_valid(self):
        """All step_type values must be one of the allowed set."""
        final_msg = _make_final_ai_message()
        mock_graph = MagicMock()
        mock_graph.ainvoke = AsyncMock(return_value={"messages": [final_msg]})

        with patch("app.modules.sandbox_harness.create_devops_agent", return_value=mock_graph):
            result = await execute_scenario(
                scenario=NO_TOOL_SCENARIO,
                system_prompt="You are a DevOps assistant.",
                tool_definitions=[],
            )

        valid_types = {"llm_call", "tool_call", "agent_output"}
        for step in result.trace:
            assert step["step_type"] in valid_types

    @pytest.mark.asyncio
    async def test_duration_ms_is_set_and_non_negative(self):
        """duration_ms must be set and >= 0."""
        final_msg = _make_final_ai_message()
        mock_graph = MagicMock()
        mock_graph.ainvoke = AsyncMock(return_value={"messages": [final_msg]})

        with patch("app.modules.sandbox_harness.create_devops_agent", return_value=mock_graph):
            result = await execute_scenario(
                scenario=NO_TOOL_SCENARIO,
                system_prompt="You are a DevOps assistant.",
                tool_definitions=[],
            )

        assert result.duration_ms is not None
        assert result.duration_ms >= 0


class TestExecuteScenarioToolCalls:
    """Tests for tool call interception and mock response injection."""

    @pytest.mark.asyncio
    async def test_tool_call_step_recorded_in_trace(self):
        """When the agent calls a tool, a tool_call step must appear in the trace."""
        from langchain_core.messages import AIMessage as RealAIMessage, ToolMessage as RealToolMessage

        tool_ai = RealAIMessage(
            content="",
            tool_calls=[{"name": "get_service_status", "args": {"service_name": "api-gateway"}, "id": "tc-001"}],
        )
        tool_msg = RealToolMessage(
            content='{"status": "healthy", "service": "api-gateway"}',
            name="get_service_status",
            tool_call_id="tc-001",
        )
        final_ai = RealAIMessage(content="The service is healthy.")

        mock_graph = MagicMock()
        mock_graph.ainvoke = AsyncMock(
            return_value={"messages": [tool_ai, tool_msg, final_ai]}
        )

        with patch("app.modules.sandbox_harness.create_devops_agent", return_value=mock_graph):
            result = await execute_scenario(
                scenario=SIMPLE_SCENARIO,
                system_prompt="You are a DevOps assistant.",
                tool_definitions=SIMPLE_TOOL_DEFS,
            )

        tool_steps = [s for s in result.trace if s["step_type"] == "tool_call"]
        assert len(tool_steps) >= 1

    @pytest.mark.asyncio
    async def test_mocked_tool_response_injected_into_trace(self):
        """The mocked_tool_responses value should appear in the tool_call step content."""
        from langchain_core.messages import AIMessage as RealAIMessage, ToolMessage as RealToolMessage

        tool_ai = RealAIMessage(
            content="",
            tool_calls=[{"name": "get_service_status", "args": {"service_name": "api-gateway"}, "id": "tc-001"}],
        )
        tool_msg = RealToolMessage(
            content='{"status": "healthy", "service": "api-gateway"}',
            name="get_service_status",
            tool_call_id="tc-001",
        )
        final_ai = RealAIMessage(content="The service is healthy.")

        mock_graph = MagicMock()
        mock_graph.ainvoke = AsyncMock(
            return_value={"messages": [tool_ai, tool_msg, final_ai]}
        )

        with patch("app.modules.sandbox_harness.create_devops_agent", return_value=mock_graph):
            result = await execute_scenario(
                scenario=SIMPLE_SCENARIO,
                system_prompt="You are a DevOps assistant.",
                tool_definitions=SIMPLE_TOOL_DEFS,
            )

        tool_steps = [s for s in result.trace if s["step_type"] == "tool_call"]
        assert len(tool_steps) >= 1
        assert tool_steps[0]["content"]["tool_response"] == {"status": "healthy", "service": "api-gateway"}

    @pytest.mark.asyncio
    async def test_unknown_tool_gets_default_success_response(self):
        """A tool not in mocked_tool_responses should receive a default success response."""
        from langchain_core.messages import AIMessage as RealAIMessage, ToolMessage as RealToolMessage

        tool_ai = RealAIMessage(
            content="",
            tool_calls=[{"name": "query_logs", "args": {"service_name": "api-gateway"}, "id": "tc-002"}],
        )
        # query_logs NOT in mocked_tool_responses — harness uses default {"status": "success"}
        tool_msg = RealToolMessage(
            content='{"status": "success", "mocked": true}',
            name="query_logs",
            tool_call_id="tc-002",
        )
        final_ai = RealAIMessage(content="Done.")

        mock_graph = MagicMock()
        mock_graph.ainvoke = AsyncMock(
            return_value={"messages": [tool_ai, tool_msg, final_ai]}
        )

        scenario = {
            "user_message": "Check logs",
            "mocked_tool_responses": {},
        }

        with patch("app.modules.sandbox_harness.create_devops_agent", return_value=mock_graph):
            result = await execute_scenario(
                scenario=scenario,
                system_prompt="You are a DevOps assistant.",
                tool_definitions=SIMPLE_TOOL_DEFS,
            )

        tool_steps = [s for s in result.trace if s["step_type"] == "tool_call"]
        assert tool_steps[0]["content"]["tool_response"] is not None


class TestExecuteScenarioTimeout:
    """Tests for timeout enforcement."""

    @pytest.mark.asyncio
    async def test_timeout_returns_timed_out_status(self):
        """If execution exceeds timeout, status must be TIMED_OUT."""
        import asyncio

        async def slow_invoke(*args, **kwargs):
            await asyncio.sleep(10)  # way longer than the 0.1s timeout
            return {"messages": [_make_final_ai_message()]}

        mock_graph = MagicMock()
        mock_graph.ainvoke = slow_invoke

        with patch("app.modules.sandbox_harness.create_devops_agent", return_value=mock_graph):
            result = await execute_scenario(
                scenario=NO_TOOL_SCENARIO,
                system_prompt="You are a DevOps assistant.",
                tool_definitions=[],
                timeout_seconds=0.1,
            )

        assert result.status == RunStatus.TIMED_OUT


class TestExecuteScenarioErrors:
    """Tests for error handling."""

    @pytest.mark.asyncio
    async def test_agent_exception_returns_errored_status(self):
        """If the agent raises an exception, status must be ERRORED."""
        mock_graph = MagicMock()
        mock_graph.ainvoke = AsyncMock(side_effect=RuntimeError("LLM connection failed"))

        with patch("app.modules.sandbox_harness.create_devops_agent", return_value=mock_graph):
            result = await execute_scenario(
                scenario=NO_TOOL_SCENARIO,
                system_prompt="You are a DevOps assistant.",
                tool_definitions=[],
            )

        assert result.status == RunStatus.ERRORED

    @pytest.mark.asyncio
    async def test_error_step_recorded_in_trace_on_exception(self):
        """On exception, an error step must be appended to the trace."""
        mock_graph = MagicMock()
        mock_graph.ainvoke = AsyncMock(side_effect=RuntimeError("Network error"))

        with patch("app.modules.sandbox_harness.create_devops_agent", return_value=mock_graph):
            result = await execute_scenario(
                scenario=NO_TOOL_SCENARIO,
                system_prompt="You are a DevOps assistant.",
                tool_definitions=[],
            )

        assert len(result.trace) > 0
        last_step = result.trace[-1]
        assert "error" in last_step["content"].get("output", "").lower() or \
               "error" in str(last_step["content"]).lower()
