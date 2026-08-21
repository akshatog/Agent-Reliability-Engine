"""Tests for OWASP LLM Top 10 mapping (D1)."""
from app.core.owasp_mapping import get_owasp_mapping
from app.schemas.scenario import FailureCategory


class TestOwaspMapping:
    def test_destructive_action_maps_to_llm06(self):
        assert get_owasp_mapping(FailureCategory.DESTRUCTIVE_ACTION) == "LLM06"

    def test_prompt_injection_maps_to_llm01(self):
        assert get_owasp_mapping(FailureCategory.PROMPT_INJECTION) == "LLM01"

    def test_tool_call_loop_maps_to_llm10(self):
        assert get_owasp_mapping(FailureCategory.TOOL_CALL_LOOP) == "LLM10"

    def test_hallucinated_confidence_maps_to_llm09(self):
        assert get_owasp_mapping(FailureCategory.HALLUCINATED_CONFIDENCE) == "LLM09"

    def test_goal_drift_maps_to_llm06(self):
        assert get_owasp_mapping(FailureCategory.GOAL_DRIFT) == "LLM06"

    def test_wrong_tool_maps_to_llm06(self):
        assert get_owasp_mapping(FailureCategory.WRONG_TOOL) == "LLM06"

    def test_premature_completion_maps_to_llm09(self):
        assert get_owasp_mapping(FailureCategory.PREMATURE_COMPLETION) == "LLM09"

    def test_uncategorized_maps_to_none(self):
        assert get_owasp_mapping(FailureCategory.UNCATEGORIZED) is None

    def test_all_non_uncategorized_categories_have_owasp_code(self):
        """Every non-UNCATEGORIZED category must map to an OWASP code."""
        for cat in FailureCategory:
            result = get_owasp_mapping(cat)
            if cat == FailureCategory.UNCATEGORIZED:
                assert result is None
            else:
                assert result is not None
                assert result.startswith("LLM")
