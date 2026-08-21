"""Tests for DevOps Assistant Agent."""
import pytest
from app.agents.devops_agent import (
    create_devops_agent,
    TOOL_DEFINITIONS,
    HIGH_RISK_TOOLS,
)
from app.agents.agent_versions import AGENT_VERSIONS


class TestToolDefinitions:
    def test_has_five_tools(self):
        assert len(TOOL_DEFINITIONS) == 5

    def test_tool_names(self):
        names = {t["name"] for t in TOOL_DEFINITIONS}
        expected = {"get_service_status", "restart_service", "query_logs", "delete_deployment", "send_alert"}
        assert names == expected

    def test_each_tool_has_description(self):
        for tool in TOOL_DEFINITIONS:
            assert "description" in tool
            assert len(tool["description"]) > 0

    def test_each_tool_has_parameters(self):
        for tool in TOOL_DEFINITIONS:
            assert "parameters" in tool


class TestHighRiskTools:
    def test_restart_service_is_high_risk(self):
        assert "restart_service" in HIGH_RISK_TOOLS

    def test_delete_deployment_is_high_risk(self):
        assert "delete_deployment" in HIGH_RISK_TOOLS

    def test_send_alert_is_high_risk(self):
        assert "send_alert" in HIGH_RISK_TOOLS

    def test_query_logs_is_not_high_risk(self):
        assert "query_logs" not in HIGH_RISK_TOOLS

    def test_get_service_status_is_not_high_risk(self):
        assert "get_service_status" not in HIGH_RISK_TOOLS


class TestAgentVersions:
    def test_has_three_versions(self):
        assert len(AGENT_VERSIONS) == 3

    def test_v1_exists(self):
        assert "v1" in AGENT_VERSIONS

    def test_v2_exists(self):
        assert "v2" in AGENT_VERSIONS

    def test_v3_exists(self):
        assert "v3" in AGENT_VERSIONS

    def test_each_version_has_system_prompt(self):
        for version in AGENT_VERSIONS.values():
            assert "system_prompt" in version
            assert len(version["system_prompt"]) > 0

    def test_v2_prompt_mentions_confirmation(self):
        prompt = AGENT_VERSIONS["v2"]["system_prompt"].lower()
        assert "confirm" in prompt


class TestCreateAgent:
    def test_create_agent_returns_compiled_graph(self, monkeypatch):
        from app.config import settings
        monkeypatch.setattr(settings, "gemini_api_key", "dummy-key-for-testing")
        agent = create_devops_agent(
            system_prompt="You are a test assistant.",
            mock_responses={"get_service_status": {"status": "ok"}},
        )
        assert agent is not None
