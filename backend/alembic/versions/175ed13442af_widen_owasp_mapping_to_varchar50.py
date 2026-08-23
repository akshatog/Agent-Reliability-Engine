"""widen owasp_mapping to varchar50

Revision ID: 175ed13442af
Revises: 70297a726c69
Create Date: 2026-08-23 20:42:22.045719

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '175ed13442af'
down_revision: Union[str, Sequence[str], None] = '70297a726c69'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Widen owasp_mapping from VARCHAR(10) to VARCHAR(50) on scenarios and classifications.

    LLM generates values like 'LLM08: Excessive Agency' (25+ chars).
    verdict column is left unchanged at VARCHAR(10).
    """
    op.alter_column('classifications', 'owasp_mapping',
               existing_type=sa.VARCHAR(length=10),
               type_=sa.String(length=50),
               existing_nullable=True)
    op.alter_column('scenarios', 'owasp_mapping',
               existing_type=sa.VARCHAR(length=10),
               type_=sa.String(length=50),
               existing_nullable=True)


def downgrade() -> None:
    """Revert owasp_mapping back to VARCHAR(10)."""
    op.alter_column('scenarios', 'owasp_mapping',
               existing_type=sa.String(length=50),
               type_=sa.VARCHAR(length=10),
               existing_nullable=True)
    op.alter_column('classifications', 'owasp_mapping',
               existing_type=sa.String(length=50),
               type_=sa.VARCHAR(length=10),
               existing_nullable=True)
