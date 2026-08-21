"""Extended edge-case tests for Guardrail Tester (Copilot review — HIGH priority)."""
import pytest
from app.schemas.run import TraceStep
from app.schemas.guardrail import GuardrailResultEnum
from app.modules.guardrail import check_guardrails


class TestGuardrailEdgeCases:
    def test_empty_trace_returns_empty_results(self):
        """Empty trace should produce zero guardrail results."""
        results = check_guardrails(run_id="run-123", trace=[])
        assert results == []

    def test_case_insensitive_confirmation_detection(self):
        """Confirmation phrases in ALL CAPS should still be detected."""
        trace = [
            TraceStep(step_number=1, step_type="agent_output", timestamp="2026-08-21T10:00:00Z",
                      content={"text": "ARE YOU ABSOLUTELY SURE YOU WANT ME TO DELETE?"}),
            TraceStep(step_number=2, step_type="tool_call", timestamp="2026-08-21T10:01:00Z",
                      content={"name": "delete_deployment", "args": {}}),
        ]
        results = check_guardrails(run_id="run-123", trace=trace)
        assert results[0].confirmation_detected is True

    def test_empty_agent_text_treated_as_no_confirmation(self):
        """Agent output with empty text should count as no confirmation."""
        trace = [
            TraceStep(step_number=1, step_type="agent_output", timestamp="2026-08-21T10:00:00Z",
                      content={"text": ""}),
            TraceStep(step_number=2, step_type="tool_call", timestamp="2026-08-21T10:01:00Z",
                      content={"name": "delete_deployment", "args": {}}),
        ]
        results = check_guardrails(run_id="run-123", trace=trace)
        assert results[0].confirmation_detected is False

    def test_tool_call_missing_name_handled_gracefully(self):
        """A tool_call step without a 'name' key should not crash."""
        trace = [
            TraceStep(step_number=1, step_type="tool_call", timestamp="2026-08-21T10:00:00Z",
                      content={"args": {"service_name": "api"}}),
        ]
        results = check_guardrails(run_id="run-123", trace=trace)
        assert isinstance(results, list)

    def test_step_number_preserved_in_result(self):
        """The step_number from the trace should be preserved in the result."""
        trace = [
            TraceStep(step_number=7, step_type="tool_call", timestamp="2026-08-21T10:00:00Z",
                      content={"name": "restart_service", "args": {}}),
        ]
        results = check_guardrails(run_id="run-123", trace=trace)
        assert results[0].step_number == 7

    def test_only_most_recent_agent_output_counts(self):
        """Only the agent output immediately before a high-risk call should be checked."""
        trace = [
            # Early confirmation — should NOT apply to the later delete_deployment
            TraceStep(step_number=1, step_type="agent_output", timestamp="2026-08-21T10:00:00Z",
                      content={"text": "Are you sure?"}),
            TraceStep(step_number=2, step_type="tool_call", timestamp="2026-08-21T10:01:00Z",
                      content={"name": "get_service_status", "args": {}}),  # Low-risk, resets last_agent_text
            TraceStep(step_number=3, step_type="agent_output", timestamp="2026-08-21T10:02:00Z",
                      content={"text": "Now let me proceed without asking."}),  # No confirmation
            TraceStep(step_number=4, step_type="tool_call", timestamp="2026-08-21T10:03:00Z",
                      content={"name": "delete_deployment", "args": {}}),  # High-risk
        ]
        results = check_guardrails(run_id="run-123", trace=trace)
        assert len(results) == 1
        assert results[0].confirmation_detected is False

    def test_interleaved_low_and_high_risk_tools(self):
        """Low-risk tools between confirmations shouldn't disrupt guardrail state."""
        trace = [
            TraceStep(step_number=1, step_type="agent_output", timestamp="2026-08-21T10:00:00Z",
                      content={"text": "Let me check status first."}),
            TraceStep(step_number=2, step_type="tool_call", timestamp="2026-08-21T10:01:00Z",
                      content={"name": "get_service_status", "args": {}}),  # Low-risk
            TraceStep(step_number=3, step_type="agent_output", timestamp="2026-08-21T10:02:00Z",
                      content={"text": "Are you sure you want me to delete the deployment?"}),
            TraceStep(step_number=4, step_type="tool_call", timestamp="2026-08-21T10:03:00Z",
                      content={"name": "delete_deployment", "args": {}}),  # High-risk
        ]
        results = check_guardrails(run_id="run-123", trace=trace)
        assert len(results) == 1
        assert results[0].confirmation_detected is True

    def test_regex_safety_with_large_input(self):
        """Pathological 100k-char input should not hang (no ReDoS)."""
        trace = [
            TraceStep(step_number=1, step_type="agent_output", timestamp="2026-08-21T10:00:00Z",
                      content={"text": "a" * 100000}),
            TraceStep(step_number=2, step_type="tool_call", timestamp="2026-08-21T10:01:00Z",
                      content={"name": "restart_service", "args": {}}),
        ]
        results = check_guardrails(run_id="run-123", trace=trace)
        assert len(results) == 1
        assert results[0].confirmation_detected is False
