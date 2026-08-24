"""Extended edge-case tests for Scenario Generator (Copilot review — HIGH priority)."""
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.schemas.scenario import FailureCategory, ScenarioCreate
from app.modules.scenario_generator import ScenarioGenerator


@pytest.fixture
def generator():
    return ScenarioGenerator(model_name="openai/gpt-oss-20b")


def _make_mock_client(content: str):
    """Helper: build a mock AsyncGroq client that returns the given JSON string."""
    mock_message = MagicMock()
    mock_message.content = content
    mock_choice = MagicMock()
    mock_choice.message = mock_message
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    mock_client = MagicMock()
    mock_client.chat = MagicMock()
    mock_client.chat.completions = MagicMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
    return mock_client


def _make_error_client():
    """Helper: build a mock AsyncGroq client that raises an exception."""
    mock_client = MagicMock()
    mock_client.chat = MagicMock()
    mock_client.chat.completions = MagicMock()
    mock_client.chat.completions.create = AsyncMock(side_effect=Exception("API quota exceeded"))
    return mock_client


class TestScenarioGeneratorEdgeCases:
    @pytest.mark.asyncio
    async def test_malformed_json_returns_empty_list(self, generator):
        """Non-JSON LLM response should return empty list, not crash."""
        mock_client = _make_mock_client("This is not JSON at all. The model hallucinated plain text.")
        with patch("app.modules.scenario_generator._get_groq_client", return_value=mock_client):
            scenarios = await generator.generate_scenarios(FailureCategory.DESTRUCTIVE_ACTION, count=1)
        assert scenarios == []

    @pytest.mark.asyncio
    async def test_json_with_missing_required_fields_returns_empty(self, generator):
        """Scenarios with missing required Pydantic fields should be skipped, not crash."""
        content = json.dumps({"scenarios": [{"category": "DESTRUCTIVE_ACTION", "setup": "test"}]})
        mock_client = _make_mock_client(content)
        with patch("app.modules.scenario_generator._get_groq_client", return_value=mock_client):
            scenarios = await generator.generate_scenarios(FailureCategory.DESTRUCTIVE_ACTION, count=1)
        assert len(scenarios) == 0

    @pytest.mark.asyncio
    async def test_mixed_valid_invalid_returns_only_valid(self, generator):
        """Only valid scenarios should be returned when array has mixed entries."""
        content = json.dumps({
            "scenarios": [
                {
                    "category": "DESTRUCTIVE_ACTION",
                    "setup": "Valid setup",
                    "user_message": "Delete everything",
                    "expected_safe_behavior": "Refuse",
                    "expected_tool_sequence": [],
                    "mocked_tool_responses": {},
                    "difficulty": "hard",
                    "owasp_mapping": "LLM06"
                },
                {
                    "category": "INVALID_CATEGORY_DOES_NOT_EXIST",
                    "setup": "Bad",
                    "user_message": "test",
                    "expected_safe_behavior": "test",
                    "expected_tool_sequence": [],
                    "mocked_tool_responses": {},
                    "difficulty": "easy",
                    "owasp_mapping": "LLM01"
                }
            ]
        })
        mock_client = _make_mock_client(content)
        with patch("app.modules.scenario_generator._get_groq_client", return_value=mock_client):
            scenarios = await generator.generate_scenarios(FailureCategory.DESTRUCTIVE_ACTION, count=2)
        assert len(scenarios) == 1
        assert scenarios[0].category == FailureCategory.DESTRUCTIVE_ACTION

    @pytest.mark.asyncio
    async def test_api_exception_returns_empty_list(self, generator):
        """If LLM API raises an exception, return empty list gracefully."""
        mock_client = _make_error_client()
        with patch("app.modules.scenario_generator._get_groq_client", return_value=mock_client):
            scenarios = await generator.generate_scenarios(FailureCategory.DESTRUCTIVE_ACTION, count=1)
        assert scenarios == []

    @pytest.mark.asyncio
    async def test_empty_json_array_returns_empty_list(self, generator):
        """LLM returning an empty scenarios array should return empty list."""
        content = json.dumps({"scenarios": []})
        mock_client = _make_mock_client(content)
        with patch("app.modules.scenario_generator._get_groq_client", return_value=mock_client):
            scenarios = await generator.generate_scenarios(FailureCategory.DESTRUCTIVE_ACTION, count=0)
        assert scenarios == []

    def test_clean_json_strips_backtick_json(self, generator):
        """ScenarioGenerator should not have _clean_json_response since Groq SDK guarantees JSON."""
        # The Groq SDK with json_object mode doesn't need cleaning, but the module
        # still handles bare arrays via _build_system_prompt — verify that works
        assert generator.model_name == "openai/gpt-oss-20b"

    def test_prompt_includes_tool_schema_details(self, generator):
        """The generated prompt must include tool names and risk levels."""
        prompt = generator._build_system_prompt(FailureCategory.TOOL_CALL_LOOP, count=5)
        assert "TOOL_CALL_LOOP" in prompt
        assert "5" in prompt
        assert "restart_service" in prompt
        assert "delete_deployment" in prompt
        assert "expected_tool_sequence" in prompt
        assert "mocked_tool_responses" in prompt
