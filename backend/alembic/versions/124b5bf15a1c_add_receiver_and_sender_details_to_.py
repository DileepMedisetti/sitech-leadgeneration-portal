"""add_receiver_and_sender_details_to_email_accounts_and_campaigns

Revision ID: 124b5bf15a1c
Revises: b0e850922c3c
Create Date: 2026-10-26 15:53:33.639836

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '124b5bf15a1c'
down_revision: Union[str, Sequence[str], None] = 'b0e850922c3c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('campaign_contents', sa.Column('receiver_name', sa.String(length=255), nullable=True))
    op.add_column('campaign_contents', sa.Column('receiver_email', sa.String(length=320), nullable=True))
    op.add_column('campaigns', sa.Column('email_account_id', sa.BigInteger(), nullable=True))
    op.create_index(op.f('ix_campaigns_email_account_id'), 'campaigns', ['email_account_id'], unique=False)
    op.create_foreign_key(
        'fk_campaigns_email_account_id',
        'campaigns',
        'email_accounts',
        ['email_account_id'],
        ['id'],
        ondelete='SET NULL',
    )
    op.add_column('email_accounts', sa.Column('receiver_name', sa.String(length=255), nullable=True))
    op.add_column('email_accounts', sa.Column('receiver_email', sa.String(length=320), nullable=True))
    op.add_column('email_accounts', sa.Column('reply_to', sa.String(length=320), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('email_accounts', 'reply_to')
    op.drop_column('email_accounts', 'receiver_email')
    op.drop_column('email_accounts', 'receiver_name')
    op.drop_constraint('fk_campaigns_email_account_id', 'campaigns', type_='foreignkey')
    op.drop_index(op.f('ix_campaigns_email_account_id'), table_name='campaigns')
    op.drop_column('campaigns', 'email_account_id')
    op.drop_column('campaign_contents', 'receiver_email')
    op.drop_column('campaign_contents', 'receiver_name')
