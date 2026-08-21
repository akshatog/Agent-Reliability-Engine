"""Extended edge-case tests for ORM models (Copilot review recommendations)."""
import pytest
from sqlalchemy.dialects.postgresql import UUID as PGUUID, JSONB
from app.models.entities import (
    Base, AgentVersion, Scenario, Run, Classification, GuardrailResult,
)

ALL_MODELS = [AgentVersion, Scenario, Run, Classification, GuardrailResult]


class TestModelConstraints:
    def test_classification_run_id_is_unique(self):
        """Classification.run_id must have a unique constraint — one verdict per run."""
        run_id_col = Classification.__table__.columns["run_id"]
        assert run_id_col.unique is True

    def test_all_timestamps_have_timezone(self):
        """All DateTime columns must store timezone info."""
        for model_cls in ALL_MODELS:
            for col in model_cls.__table__.columns:
                if col.type.__class__.__name__ == "DateTime":
                    assert col.type.timezone is True, (
                        f"{model_cls.__name__}.{col.name} is missing timezone=True"
                    )

    def test_json_columns_are_jsonb(self):
        """Key JSON columns should use PostgreSQL JSONB, not plain JSON."""
        assert isinstance(AgentVersion.__table__.columns["tool_schemas"].type, JSONB)
        assert isinstance(Scenario.__table__.columns["expected_tool_sequence"].type, JSONB)
        assert isinstance(Run.__table__.columns["trace"].type, JSONB)

    def test_all_primary_keys_are_pguuid(self):
        """All primary keys should be native PostgreSQL UUID."""
        for model_cls in ALL_MODELS:
            pk_col = model_cls.__table__.columns["id"]
            assert pk_col.primary_key
            assert isinstance(pk_col.type, PGUUID), (
                f"{model_cls.__name__}.id is not PGUUID"
            )

    def test_scenario_category_is_string_not_enum(self):
        """Scenario.category is a String column for DB flexibility."""
        col = Scenario.__table__.columns["category"]
        assert col.type.__class__.__name__ == "String"

    def test_run_status_column_length_sufficient(self):
        """Run.status must fit all expected values like TIMED_OUT, ERRORED, COMPLETED."""
        status_col = Run.__table__.columns["status"]
        assert status_col.type.length >= 20

    def test_guardrail_tool_name_column_length_sufficient(self):
        """GuardrailResult.high_risk_tool_called must fit real tool names."""
        tool_col = GuardrailResult.__table__.columns["high_risk_tool_called"]
        assert tool_col.type.length >= 50

    def test_all_models_have_created_at_column(self):
        """Every table should have a created_at timestamp column."""
        for model_cls in ALL_MODELS:
            assert "created_at" in model_cls.__table__.columns, (
                f"{model_cls.__name__} is missing created_at column"
            )
