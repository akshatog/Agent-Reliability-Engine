"""Phase 2: Add indexes, CHECK constraints, and CASCADE deletes

Revision ID: a1b2c3d4e5f6
Revises: c8dde7e7e051
Create Date: 2026-08-21

Addresses Copilot DB schema analysis:
- Issue 1: Add CASCADE delete on Classifications and GuardrailResults
- Issue 3: Add CHECK constraints for enum-like string columns
- Issue 4: Add indexes on all foreign key columns
- Issue 5: Add GIN index for JSONB trace queries
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'c8dde7e7e051'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Issue 4: Indexes on foreign key columns ──────────────────────────────
    op.create_index('ix_runs_agent_version_id', 'runs', ['agent_version_id'])
    op.create_index('ix_runs_scenario_id', 'runs', ['scenario_id'])
    op.create_index('ix_classifications_run_id', 'classifications', ['run_id'])
    op.create_index('ix_guardrail_results_run_id', 'guardrail_results', ['run_id'])

    # Timestamp indexes for common dashboard queries (Run uses started_at, others use created_at)
    op.create_index('ix_runs_started_at', 'runs', ['started_at'])
    op.create_index('ix_scenarios_created_at', 'scenarios', ['created_at'])

    # ── Issue 5: GIN index for JSONB trace queries ───────────────────────────
    op.create_index(
        'ix_runs_trace_gin',
        'runs',
        ['trace'],
        postgresql_using='gin'
    )

    # ── Issue 3: CHECK constraints for enum-like string columns ──────────────
    op.execute("""
        ALTER TABLE classifications
        ADD CONSTRAINT valid_verdict
        CHECK (verdict IN ('PASS', 'FAIL'));
    """)
    op.execute("""
        ALTER TABLE classifications
        ADD CONSTRAINT valid_severity
        CHECK (severity IS NULL OR severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'));
    """)
    op.execute("""
        ALTER TABLE guardrail_results
        ADD CONSTRAINT valid_confirmation_type
        CHECK (confirmation_type IN ('PROMPT_BASED', 'TOOL_BASED', 'NONE'));
    """)
    op.execute("""
        ALTER TABLE guardrail_results
        ADD CONSTRAINT valid_result
        CHECK (result IN ('HELD', 'BYPASSED'));
    """)
    op.execute("""
        ALTER TABLE scenarios
        ADD CONSTRAINT valid_category
        CHECK (category IN (
            'TOOL_CALL_LOOP', 'HALLUCINATED_CONFIDENCE', 'DESTRUCTIVE_ACTION',
            'GOAL_DRIFT', 'PROMPT_INJECTION', 'WRONG_TOOL', 'PREMATURE_COMPLETION',
            'UNCATEGORIZED'
        ));
    """)

    # ── Issue 1: CASCADE delete for child records ─────────────────────────────
    # Recreate FK on classifications with CASCADE
    op.drop_constraint('classifications_run_id_fkey', 'classifications', type_='foreignkey')
    op.create_foreign_key(
        'classifications_run_id_fkey',
        'classifications', 'runs',
        ['run_id'], ['id'],
        ondelete='CASCADE'
    )

    # Recreate FK on guardrail_results with CASCADE
    op.drop_constraint('guardrail_results_run_id_fkey', 'guardrail_results', type_='foreignkey')
    op.create_foreign_key(
        'guardrail_results_run_id_fkey',
        'guardrail_results', 'runs',
        ['run_id'], ['id'],
        ondelete='CASCADE'
    )


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_runs_agent_version_id', table_name='runs')
    op.drop_index('ix_runs_scenario_id', table_name='runs')
    op.drop_index('ix_classifications_run_id', table_name='classifications')
    op.drop_index('ix_guardrail_results_run_id', table_name='guardrail_results')
    op.drop_index('ix_runs_started_at', table_name='runs')
    op.drop_index('ix_scenarios_created_at', table_name='scenarios')
    op.drop_index('ix_runs_trace_gin', table_name='runs')

    # Drop CHECK constraints
    op.drop_constraint('valid_verdict', 'classifications', type_='check')
    op.drop_constraint('valid_severity', 'classifications', type_='check')
    op.drop_constraint('valid_confirmation_type', 'guardrail_results', type_='check')
    op.drop_constraint('valid_result', 'guardrail_results', type_='check')
    op.drop_constraint('valid_category', 'scenarios', type_='check')

    # Revert CASCADE → RESTRICT
    op.drop_constraint('classifications_run_id_fkey', 'classifications', type_='foreignkey')
    op.create_foreign_key(
        'classifications_run_id_fkey',
        'classifications', 'runs',
        ['run_id'], ['id']
    )
    op.drop_constraint('guardrail_results_run_id_fkey', 'guardrail_results', type_='foreignkey')
    op.create_foreign_key(
        'guardrail_results_run_id_fkey',
        'guardrail_results', 'runs',
        ['run_id'], ['id']
    )
