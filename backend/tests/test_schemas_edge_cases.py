"""Extended edge-case tests for Pydantic schemas (Copilot review recommendations)."""
import pytest
from pydantic import ValidationError
from app.schemas.scenario import FailureCategory, ScenarioCreate
from app.schemas.classification import ClassificationCreate, Verdict


class TestScenarioSchemaEdgeCases:
    def test_scenario_with_empty_tool_sequence_valid(self):
        """Empty tool sequence is valid (some scenarios need no tools)."""
        scenario = ScenarioCreate(
            category=FailureCategory.PROMPT_INJECTION,
            setup="test",
            user_message="test",
            expected_safe_behavior="test",
            expected_tool_sequence=[],
            mocked_tool_responses={},
        )
        assert scenario.expected_tool_sequence == []

    def test_scenario_missing_required_field_fails(self):
        """Missing required fields should raise ValidationError."""
        with pytest.raises(ValidationError):
            ScenarioCreate(
                category=FailureCategory.DESTRUCTIVE_ACTION,
                setup="test",
                # Missing user_message and expected_safe_behavior
            )

    def test_scenario_invalid_category_fails(self):
        """Invalid failure category string should raise ValidationError."""
        with pytest.raises(ValidationError):
            ScenarioCreate(
                category="INVALID_CATEGORY",
                setup="test",
                user_message="test",
                expected_safe_behavior="test",
            )

    def test_scenario_with_very_long_strings(self):
        """Schemas should handle very long text fields without truncation."""
        long_text = "x" * 10000
        scenario = ScenarioCreate(
            category=FailureCategory.DESTRUCTIVE_ACTION,
            setup=long_text,
            user_message=long_text,
            expected_safe_behavior=long_text,
            expected_tool_sequence=[],
            mocked_tool_responses={},
        )
        assert len(scenario.setup) == 10000

    def test_scenario_with_unicode_characters(self):
        """Schemas should handle Unicode correctly."""
        scenario = ScenarioCreate(
            category=FailureCategory.DESTRUCTIVE_ACTION,
            setup="数据库是损坏的",
            user_message="请删除所有部署",
            expected_safe_behavior="应该拒绝",
            expected_tool_sequence=[],
            mocked_tool_responses={},
        )
        assert "数据库" in scenario.setup

    def test_scenario_default_difficulty_is_medium(self):
        """Default difficulty should be 'medium' when not specified."""
        scenario = ScenarioCreate(
            category=FailureCategory.GOAL_DRIFT,
            setup="test",
            user_message="test",
            expected_safe_behavior="test",
        )
        assert scenario.difficulty == "medium"


class TestClassificationEdgeCases:
    def test_confidence_at_zero(self):
        """Confidence of exactly 0.0 should be valid."""
        c = ClassificationCreate(
            run_id="00000000-0000-0000-0000-000000000001",
            verdict=Verdict.FAIL,
            confidence=0.0,
            justification="test",
        )
        assert c.confidence == 0.0

    def test_confidence_at_one(self):
        """Confidence of exactly 1.0 should be valid."""
        c = ClassificationCreate(
            run_id="00000000-0000-0000-0000-000000000001",
            verdict=Verdict.PASS,
            confidence=1.0,
            justification="test",
        )
        assert c.confidence == 1.0

    def test_confidence_above_1_fails(self):
        """Confidence > 1.0 should be rejected."""
        with pytest.raises(ValidationError):
            ClassificationCreate(
                run_id="00000000-0000-0000-0000-000000000001",
                verdict=Verdict.FAIL,
                confidence=1.5,
                justification="test",
            )

    def test_confidence_below_0_fails(self):
        """Confidence < 0.0 should be rejected."""
        with pytest.raises(ValidationError):
            ClassificationCreate(
                run_id="00000000-0000-0000-0000-000000000001",
                verdict=Verdict.FAIL,
                confidence=-0.1,
                justification="test",
            )
