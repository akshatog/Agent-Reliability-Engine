"""Pydantic schemas for run classifications."""
from __future__ import annotations
import enum
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field
from app.schemas.scenario import FailureCategory


class Severity(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class Verdict(str, enum.Enum):
    PASS = "PASS"
    FAIL = "FAIL"


class ClassificationCreate(BaseModel):
    run_id: UUID | str
    verdict: Verdict
    failure_category: FailureCategory | None = None
    severity: Severity | None = None
    confidence: float = Field(ge=0.0, le=1.0)
    justification: str
    owasp_mapping: str | None = None


class ClassificationRead(ClassificationCreate):
    id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}
