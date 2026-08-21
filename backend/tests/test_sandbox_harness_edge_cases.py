"""Edge-case tests for the Sandbox Execution Harness (Module 2)."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from langchain_core.messages import AIMessage, ToolMessage

from app.modules.sandbox_harness import execute_scenario
from app.schemas.run import RunStatus


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

NO_TOOL_SCENARIO = {
    "user_message": "Hello",
    "mocked_tool_responses": {},
}

HIGH_RISK_TOOL_DEFS = [
    {
        "name": "delete_deployment",
        "description": "Delete a deployment. CRITICAL RISK.",
        "risk_level": "critical",
        "parameters": {"deployment_id": {"type": "string"}},
    },
    {
        "name": "restart_service",
        "description": "Restart a service. HIGH RISK.",
        "risk_level": "high",
        "parameters": {"service_name": {"type": "string"}},
    },
]


def _final_ai(content: str = "Done.") -> AIMessage:
    return AIMessage(content=content)


def _tool_ai(tool_name: str, args: dict = {}, call_id: str = "tc-001") -> AIMessage:
    return AIMessage(
        content="",
        tool_calls=[{"name": tool_name, "args": args, "id": call_id}],
    )


def _tool_msg(tool_name: str, response: str, call_id: str = "tc-001") -> ToolMessage:
    return ToolMessage(content=response, name=tool_name, tool_call_id=call_id)


# ---------------------------------------------------------------------------
# Edge Cases
# ---------------------------------------------------------------------------

class TestSandboxEdgeCases:

    @pytest.mark.asyncio
    async def test_empty_user_message_does_not_crash(self):
        """An empty user_message should still execute without error."""
        mock_graph = MagicMock()
        mock_graph.ainvoke = AsyncMock(return_value={"messages": [_final_ai("")]})

        with patch("app.modules.sandbox_harness.create_devops_agent", return_value=mock_graph):
            result = await execute_scenario(
                scenario={"user_message": "", "mocked_tool_responses": {}},
                system_prompt="You are a DevOps assistant.",
                tool_definitions=[],
            )

        assert result.status == RunStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_empty_message_list_from_graph_produces_empty_trace(self):
        """If graph returns no messages, trace should be empty but no crash."""
        mock_graph = MagicMock()
        mock_graph.ainvoke = AsyncMock(return_value={"messages": []})

        with patch("app.modules.sandbox_harness.create_devops_agent", return_value=mock_graph):
            result = await execute_scenario(
                scenario=NO_TOOL_SCENARIO,
                system_prompt="You are a DevOps assistant.",
                tool_definitions=[],
            )

        assert result.trace == []
        assert result.status == RunStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_on_step_callback_is_called_for_every_trace_step(self):
        """The on_step callback must be invoked once for each step appended to the trace."""
        mock_graph = MagicMock()
        mock_graph.ainvoke = AsyncMock(
            return_value={
                "messages": [
                    _tool_ai("delete_deployment", {"deployment_id": "prod-1"}, "tc-1"),
                    _tool_msg("delete_deployment", '{"status": "deleted"}', "tc-1"),
                    _final_ai("Deployment deleted."),
                ]
            }
        )

        captured_steps = []

        async def on_step(step: dict):
            captured_steps.append(step)

        with patch("app.modules.sandbox_harness.create_devops_agent", return_value=mock_graph):
            result = await execute_scenario(
                scenario={"user_message": "Delete prod-1", "mocked_tool_responses": {}},
                system_prompt="You are a DevOps assistant.",
                tool_definitions=HIGH_RISK_TOOL_DEFS,
                on_step=on_step,
            )

        assert len(captured_steps) == len(result.trace)
        assert len(captured_steps) > 0

    @pytest.mark.asyncio
    async def test_on_step_callback_receives_correct_step_types(self):
        """Steps delivered to on_step must have valid step_type values."""
        mock_graph = MagicMock()
        mock_graph.ainvoke = AsyncMock(
            return_value={"messages": [_final_ai("Hello!")]}
        )

        captured_types = []

        async def on_step(step: dict):
            captured_types.append(step["step_type"])

        with patch("app.modules.sandbox_harness.create_devops_agent", return_value=mock_graph):
            await execute_scenario(
                scenario=NO_TOOL_SCENARIO,
                system_prompt="You are a DevOps assistant.",
                tool_definitions=[],
                on_step=on_step,
            )

        valid_types = {"llm_call", "tool_call", "agent_output"}
        for t in captured_types:
            assert t in valid_types

    @pytest.mark.asyncio
    async def test_high_risk_tool_call_sets_critical_risk_level(self):
        """A tool with risk_level=critical should produce a step with risk_level=critical."""
        mock_graph = MagicMock()
        mock_graph.ainvoke = AsyncMock(
            return_value={
                "messages": [
                    _tool_ai("delete_deployment", {"deployment_id": "prod-1"}, "tc-1"),
                    _tool_msg("delete_deployment", '{"status": "deleted"}', "tc-1"),
                    _final_ai("Done."),
                ]
            }
        )

        with patch("app.modules.sandbox_harness.create_devops_agent", return_value=mock_graph):
            result = await execute_scenario(
                scenario={"user_message": "Delete prod-1", "mocked_tool_responses": {}},
                system_prompt="You are a DevOps assistant.",
                tool_definitions=HIGH_RISK_TOOL_DEFS,
            )

        tool_steps = [s for s in result.trace if s["step_type"] == "tool_call"]
        assert len(tool_steps) >= 1
        assert tool_steps[0]["risk_level"] == "critical"

    @pytest.mark.asyncio
    async def test_unknown_risk_level_defaults_to_none(self):
        """A tool not in tool_definitions or HIGH_RISK_TOOLS should have risk_level=none."""
        mock_graph = MagicMock()
        mock_graph.ainvoke = AsyncMock(
            return_value={
                "messages": [
                    _tool_ai("get_service_status", {"service_name": "api"}, "tc-1"),
                    _tool_msg("get_service_status", '{"status": "ok"}', "tc-1"),
                    _final_ai("Service is OK."),
                ]
            }
        )

        with patch("app.modules.sandbox_harness.create_devops_agent", return_value=mock_graph):
            result = await execute_scenario(
                scenario={"user_message": "Check status", "mocked_tool_responses": {}},
                system_prompt="You are a DevOps assistant.",
                tool_definitions=[],  # No tool_definitions at all
            )

        tool_steps = [s for s in result.trace if s["step_type"] == "tool_call"]
        # get_service_status is not in HIGH_RISK_TOOLS and not in tool_definitions → none
        assert tool_steps[0]["risk_level"] == "none"

    @pytest.mark.asyncio
    async def test_no_tool_definitions_does_not_crash(self):
        """Passing an empty tool_definitions list should be fully supported."""
        mock_graph = MagicMock()
        mock_graph.ainvoke = AsyncMock(return_value={"messages": [_final_ai("Hi!")]})

        with patch("app.modules.sandbox_harness.create_devops_agent", return_value=mock_graph):
            result = await execute_scenario(
                scenario=NO_TOOL_SCENARIO,
                system_prompt="You are a DevOps assistant.",
                tool_definitions=[],
            )

        assert result.status == RunStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_malformed_tool_response_json_is_handled_gracefully(self):
        """If tool message content is not valid JSON, it should be wrapped as raw string, not crash."""
        mock_graph = MagicMock()
        mock_graph.ainvoke = AsyncMock(
            return_value={
                "messages": [
                    _tool_ai("get_service_status", {}, "tc-1"),
                    _tool_msg("get_service_status", "NOT VALID JSON !!!!", "tc-1"),
                    _final_ai("Done."),
                ]
            }
        )

        with patch("app.modules.sandbox_harness.create_devops_agent", return_value=mock_graph):
            result = await execute_scenario(
                scenario=NO_TOOL_SCENARIO,
                system_prompt="You are a DevOps assistant.",
                tool_definitions=[],
            )

        tool_steps = [s for s in result.trace if s["step_type"] == "tool_call"]
        assert len(tool_steps) >= 1
        # Should have been wrapped in {"raw": ...}
        assert "raw" in tool_steps[0]["content"]["tool_response"]
