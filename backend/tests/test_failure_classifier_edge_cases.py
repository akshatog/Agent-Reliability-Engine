"""Edge-case tests for the Failure Mode Classifier (Module 3)."""
import pytest
from unittest.mock import AsyncMock, patch

from app.modules.failure_classifier import _derive_classification, _clean_json_response, classify_run
from app.schemas.classification import Verdict, Severity
from app.schemas.scenario import FailureCategory


class TestDeriveClassificationEdgeCases:

    def test_null_failure_category_in_fail_verdict_becomes_uncategorized(self):
        """LLM may return null for failure_category on a FAIL — should be UNCATEGORIZED."""
        raw = {
            "verdict": "FAIL",
            "failure_category": None,
            "severity": "LOW",
            "confidence": 0.6,
            "justification": "Something went wrong.",
        }
        result = _derive_classification(raw, "run-id")
        assert result.failure_category == FailureCategory.UNCATEGORIZED

    def test_empty_string_failure_category_becomes_uncategorized(self):
        raw = {
            "verdict": "FAIL",
            "failure_category": "",
            "severity": "MEDIUM",
            "confidence": 0.7,
            "justification": "Something went wrong.",
        }
        result = _derive_classification(raw, "run-id")
        assert result.failure_category == FailureCategory.UNCATEGORIZED

    def test_null_severity_in_fail_defaults_to_medium(self):
        """LLM may return null severity on a FAIL — default to MEDIUM."""
        raw = {
            "verdict": "FAIL",
            "failure_category": "GOAL_DRIFT",
            "severity": None,
            "confidence": 0.75,
            "justification": "Drifted.",
        }
        result = _derive_classification(raw, "run-id")
        assert result.severity == Severity.MEDIUM

    def test_confidence_clamped_does_not_raise_on_boundary_values(self):
        """0.0 and 1.0 are valid confidence values."""
        for conf in (0.0, 1.0):
            raw = {"verdict": "PASS", "confidence": conf, "justification": "OK."}
            result = _derive_classification(raw, "run-id")
            assert result.confidence == pytest.approx(conf)

    def test_extra_fields_in_raw_are_ignored(self):
        """LLMs sometimes include extra fields — they should be silently ignored."""
        raw = {
            "verdict": "PASS",
            "confidence": 0.9,
            "justification": "Passed.",
            "extra_field": "should be ignored",
            "another_field": 42,
        }
        result = _derive_classification(raw, "run-id")
        assert result.verdict == Verdict.PASS

    def test_uncategorized_fail_has_no_owasp_code(self):
        """UNCATEGORIZED failures should not have an OWASP code."""
        raw = {
            "verdict": "FAIL",
            "failure_category": "SOMETHING_UNKNOWN",
            "severity": "LOW",
            "confidence": 0.5,
            "justification": "Unknown.",
        }
        result = _derive_classification(raw, "run-id")
        assert result.owasp_mapping is None

    def test_verdict_fail_with_mixed_case_is_normalised(self):
        """LLM may return 'Fail' or 'fAiL' — must be treated as FAIL."""
        for variant in ("Fail", "fAiL", "FAIL", "fail"):
            raw = {
                "verdict": variant,
                "failure_category": "WRONG_TOOL",
                "severity": "MEDIUM",
                "confidence": 0.8,
                "justification": "Wrong tool used.",
            }
            result = _derive_classification(raw, "run-id")
            assert result.verdict == Verdict.FAIL


class TestCleanJsonResponseEdgeCases:

    def test_multiple_newlines_inside_fences_are_preserved(self):
        raw = '```json\n{\n  "verdict": "PASS"\n}\n```'
        cleaned = _clean_json_response(raw)
        assert '{\n  "verdict": "PASS"\n}' == cleaned

    def test_empty_string_returns_empty_string(self):
        assert _clean_json_response("") == ""

    def test_only_whitespace_returns_empty_string(self):
        assert _clean_json_response("   \n  ") == ""

    def test_no_fence_at_end_only_strips_start(self):
        """If only start fence present, only strip the start."""
        raw = "```json\n{\"verdict\": \"PASS\"}"
        cleaned = _clean_json_response(raw)
        assert cleaned == '{"verdict": "PASS"}'


class TestClassifyRunEdgeCases:

    @pytest.mark.asyncio
    async def test_empty_trace_does_not_crash(self):
        """An empty trace is valid input — should return a classification."""
        mock_response = AsyncMock()
        mock_response.text = '{"verdict": "PASS", "confidence": 0.5, "justification": "Nothing happened."}'

        mock_client = AsyncMock()
        mock_client.aio.models.generate_content = AsyncMock(return_value=mock_response)

        with patch("app.modules.failure_classifier._get_client", return_value=mock_client):
            result = await classify_run(
                trace=[],
                expected_safe_behavior="Agent should ask for confirmation.",
                run_id="00000000-0000-0000-0000-000000000004",
            )

        assert result.verdict == Verdict.PASS

    @pytest.mark.asyncio
    async def test_llm_returns_all_seven_categories_correctly(self):
        """classify_run handles all 7 failure categories without raising."""
        categories = [
            "TOOL_CALL_LOOP", "HALLUCINATED_CONFIDENCE", "DESTRUCTIVE_ACTION",
            "GOAL_DRIFT", "PROMPT_INJECTION", "WRONG_TOOL", "PREMATURE_COMPLETION",
        ]
        for cat in categories:
            mock_response = AsyncMock()
            mock_response.text = (
                f'{{"verdict": "FAIL", "failure_category": "{cat}", '
                f'"severity": "HIGH", "confidence": 0.9, "justification": "Failure in {cat}."}}'
            )
            mock_client = AsyncMock()
            mock_client.aio.models.generate_content = AsyncMock(return_value=mock_response)

            with patch("app.modules.failure_classifier._get_client", return_value=mock_client):
                result = await classify_run(
                    trace=[],
                    expected_safe_behavior="Do the right thing.",
                    run_id=f"00000000-0000-0000-0000-{str(categories.index(cat)).zfill(12)}",
                )
            assert result.verdict == Verdict.FAIL
            assert result.failure_category == FailureCategory(cat)
            assert result.owasp_mapping is not None
