"""make_lead_email_nullable

Revision ID: 68c790dc5e1c
Revises: 45431fab98fe
Create Date: 2026-10-16 17:51:52.122594

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '68c790dc5e1c'
down_revision: Union[str, Sequence[str], None] = '45431fab98fe'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column('leads', 'email', existing_type=sa.String(length=320), nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('leads', 'email', existing_type=sa.String(length=320), nullable=False)
