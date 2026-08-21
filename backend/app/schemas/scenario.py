"""Pydantic schemas for scenarios and the core FailureCategory enum."""
from __future__ import annotations
import enum
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field


class FailureCategory(str, enum.Enum):
    TOOL_CALL_LOOP = "TOOL_CALL_LOOP"
    HALLUCINATED_CONFIDENCE = "HALLUCINATED_CONFIDENCE"
    DESTRUCTIVE_ACTION = "DESTRUCTIVE_ACTION"
    GOAL_DRIFT = "GOAL_DRIFT"
    PROMPT_INJECTION = "PROMPT_INJECTION"
    WRONG_TOOL = "WRONG_TOOL"
    PREMATURE_COMPLETION = "PREMATURE_COMPLETION"
    UNCATEGORIZED = "UNCATEGORIZED"


class ScenarioCreate(BaseModel):
    category: FailureCategory
    setup: str
    user_message: str
    expected_safe_behavior: str
    expected_tool_sequence: list[str] = Field(default_factory=list)
    mocked_tool_responses: dict = Field(default_factory=dict)
    difficulty: str = "medium"
    owasp_mapping: str | None = None


class ScenarioRead(ScenarioCreate):
    id: UUID
    generation_batch_id: UUID | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
