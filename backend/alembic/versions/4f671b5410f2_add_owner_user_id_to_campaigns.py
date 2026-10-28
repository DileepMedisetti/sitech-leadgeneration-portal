"""add_owner_user_id_to_campaigns

Revision ID: 4f671b5410f2
Revises: 0d0de05d87df
Create Date: 2026-10-28 11:21:51.500747

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4f671b5410f2'
down_revision: Union[str, Sequence[str], None] = '0d0de05d87df'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('campaigns', sa.Column('owner_user_id', sa.BigInteger(), nullable=True))
    op.create_index(op.f('ix_campaigns_owner_user_id'), 'campaigns', ['owner_user_id'], unique=False)
    op.create_foreign_key(
        'fk_campaigns_owner_user_id',
        'campaigns',
        'users',
        ['owner_user_id'],
        ['id'],
        ondelete='SET NULL',
    )
    # Backfill owner_user_id from email_accounts if associated, or from first user in users table
    op.execute(
        """
        UPDATE campaigns c
        SET owner_user_id = ea.owner_user_id
        FROM email_accounts ea
        WHERE c.email_account_id = ea.id AND c.owner_user_id IS NULL;
        """
    )
    op.execute(
        """
        UPDATE campaigns
        SET owner_user_id = (SELECT id FROM users ORDER BY id ASC LIMIT 1)
        WHERE owner_user_id IS NULL AND (SELECT id FROM users LIMIT 1) IS NOT NULL;
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_campaigns_owner_user_id', 'campaigns', type_='foreignkey')
    op.drop_index(op.f('ix_campaigns_owner_user_id'), table_name='campaigns')
    op.drop_column('campaigns', 'owner_user_id')
