"""SQLAlchemy ORM models for all 5 tables."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, Float, Integer, Boolean, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID as PGUUID, JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class AgentVersion(Base):
    __tablename__ = "agent_versions"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    system_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    tool_schemas: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    runs: Mapped[list["Run"]] = relationship(back_populates="agent_version")


class Scenario(Base):
    __tablename__ = "scenarios"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    setup: Mapped[str] = mapped_column(Text, nullable=False)
    user_message: Mapped[str] = mapped_column(Text, nullable=False)
    expected_safe_behavior: Mapped[str] = mapped_column(Text, nullable=False)
    expected_tool_sequence: Mapped[list] = mapped_column(JSONB, default=list)
    mocked_tool_responses: Mapped[dict] = mapped_column(JSONB, default=dict)
    difficulty: Mapped[str] = mapped_column(String(20), default="medium")
    owasp_mapping: Mapped[str | None] = mapped_column(String(10), nullable=True)
    generation_batch_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    runs: Mapped[list["Run"]] = relationship(back_populates="scenario")


class Run(Base):
    __tablename__ = "runs"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_version_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("agent_versions.id"), nullable=False)
    scenario_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("scenarios.id"), nullable=True)
    run_number: Mapped[int] = mapped_column(Integer, default=1)
    trace: Mapped[list] = mapped_column(JSONB, default=list)
    status: Mapped[str] = mapped_column(String(20), default="COMPLETED")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    agent_version: Mapped["AgentVersion"] = relationship(back_populates="runs")
    scenario: Mapped["Scenario"] = relationship(back_populates="runs")
    classification: Mapped["Classification | None"] = relationship(
        back_populates="run",
        uselist=False,
        cascade="all, delete-orphan",  # Mirrors Phase 2 DB-level CASCADE DELETE
    )
    guardrail_results: Mapped[list["GuardrailResult"]] = relationship(
        back_populates="run",
        cascade="all, delete-orphan",  # Mirrors Phase 2 DB-level CASCADE DELETE
    )


class Classification(Base):
    __tablename__ = "classifications"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("runs.id"), unique=True, nullable=False)
    verdict: Mapped[str] = mapped_column(String(10), nullable=False)
    failure_category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    severity: Mapped[str | None] = mapped_column(String(20), nullable=True)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    justification: Mapped[str] = mapped_column(Text, nullable=False)
    owasp_mapping: Mapped[str | None] = mapped_column(String(10), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    run: Mapped["Run"] = relationship(back_populates="classification")


class GuardrailResult(Base):
    __tablename__ = "guardrail_results"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("runs.id"), nullable=False)
    high_risk_tool_called: Mapped[str] = mapped_column(String(100), nullable=False)
    step_number: Mapped[int] = mapped_column(Integer, nullable=False)
    confirmation_detected: Mapped[bool] = mapped_column(Boolean, nullable=False)
    confirmation_type: Mapped[str] = mapped_column(String(20), default="NONE")
    result: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    run: Mapped["Run"] = relationship(back_populates="guardrail_results")
