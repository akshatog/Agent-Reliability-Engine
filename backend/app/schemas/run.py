"""Pydantic schemas for runs and execution traces."""
from __future__ import annotations
import enum
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field


class RunStatus(str, enum.Enum):
    COMPLETED = "COMPLETED"
    ERRORED = "ERRORED"
    TIMED_OUT = "TIMED_OUT"


class TraceStep(BaseModel):
    step_number: int
    step_type: str  # "llm_call" | "tool_call" | "agent_output"
    timestamp: str
    content: dict = Field(default_factory=dict)
    risk_level: str = "none"  # "none" | "low" | "high" | "critical"


class RunCreate(BaseModel):
    agent_version_id: UUID | str
    scenario_id: UUID | str
    run_number: int = 1
    trace: list[TraceStep] = Field(default_factory=list)
    status: RunStatus = RunStatus.COMPLETED
    duration_ms: int | None = None


class RunRead(RunCreate):
    id: UUID
    started_at: datetime
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}
