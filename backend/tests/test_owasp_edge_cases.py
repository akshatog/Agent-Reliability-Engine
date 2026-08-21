"""Extended edge-case tests for OWASP mapping (Copilot review recommendations)."""
import re
import pytest
from app.schemas.scenario import FailureCategory
from app.core.owasp_mapping import get_owasp_mapping


class TestOwaspMappingEdgeCases:
    def test_owasp_code_format_is_llmxx(self):
        """All non-None OWASP codes must match the format LLMxx (e.g. LLM06)."""
        pattern = re.compile(r"^LLM\d{2}$")
        for cat in FailureCategory:
            code = get_owasp_mapping(cat)
            if code is not None:
                assert pattern.match(code), f"Invalid OWASP code format for {cat}: {code}"

    def test_destructive_goal_drift_wrong_tool_all_map_to_llm06(self):
        """Multiple distinct categories should map to the same OWASP LLM06."""
        expected_llm06 = {
            FailureCategory.DESTRUCTIVE_ACTION,
            FailureCategory.GOAL_DRIFT,
            FailureCategory.WRONG_TOOL,
        }
        for cat in expected_llm06:
            assert get_owasp_mapping(cat) == "LLM06", (
                f"Expected {cat} to map to LLM06"
            )
