"""Pydantic schemas for guardrail check results."""
from __future__ import annotations
import enum
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel


class GuardrailResultEnum(str, enum.Enum):
    HELD = "HELD"
    BYPASSED = "BYPASSED"


class ConfirmationType(str, enum.Enum):
    PROMPT_BASED = "PROMPT_BASED"
    TOOL_BASED = "TOOL_BASED"
    NONE = "NONE"


class GuardrailResultCreate(BaseModel):
    run_id: UUID | str
    high_risk_tool_called: str
    step_number: int
    confirmation_detected: bool
    confirmation_type: ConfirmationType
    result: GuardrailResultEnum


class GuardrailResultRead(GuardrailResultCreate):
    id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}
