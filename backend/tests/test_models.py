"""Tests for SQLAlchemy ORM models."""
from app.models.entities import Base, AgentVersion, Scenario, Run, Classification, GuardrailResult


class TestModelsExist:
    def test_base_has_metadata(self):
        assert Base.metadata is not None

    def test_agent_version_table_name(self):
        assert AgentVersion.__tablename__ == "agent_versions"

    def test_scenario_table_name(self):
        assert Scenario.__tablename__ == "scenarios"

    def test_run_table_name(self):
        assert Run.__tablename__ == "runs"

    def test_classification_table_name(self):
        assert Classification.__tablename__ == "classifications"

    def test_guardrail_result_table_name(self):
        assert GuardrailResult.__tablename__ == "guardrail_results"

    def test_all_five_tables_registered(self):
        table_names = set(Base.metadata.tables.keys())
        expected = {"agent_versions", "scenarios", "runs", "classifications", "guardrail_results"}
        assert expected.issubset(table_names)


class TestAgentVersionColumns:
    def test_has_id_column(self):
        assert "id" in AgentVersion.__table__.columns

    def test_has_system_prompt_column(self):
        assert "system_prompt" in AgentVersion.__table__.columns

    def test_has_tool_schemas_column(self):
        assert "tool_schemas" in AgentVersion.__table__.columns


class TestRunRelationships:
    def test_run_has_agent_version_fk(self):
        fk_targets = [fk.target_fullname for col in Run.__table__.columns for fk in col.foreign_keys]
        assert "agent_versions.id" in fk_targets

    def test_run_has_scenario_fk(self):
        fk_targets = [fk.target_fullname for col in Run.__table__.columns for fk in col.foreign_keys]
        assert "scenarios.id" in fk_targets

    def test_classification_has_unique_run_fk(self):
        run_id_col = Classification.__table__.columns["run_id"]
        assert run_id_col.unique is True
