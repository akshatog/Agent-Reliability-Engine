"""Pydantic schemas for agent versions."""
from __future__ import annotations
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field


class AgentVersionCreate(BaseModel):
    name: str
    description: str = ""
    system_prompt: str
    tool_schemas: dict = Field(default_factory=dict)


class AgentVersionRead(AgentVersionCreate):
    id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}
