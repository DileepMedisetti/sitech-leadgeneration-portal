"""add_bounce_tracking_and_soft_delete_to_recipient_snapshots

Revision ID: 3a8d9e2b1c4f
Revises: 4f671b5410f2
Create Date: 2026-10-28 16:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3a8d9e2b1c4f'
down_revision: Union[str, Sequence[str], None] = '4f671b5410f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'campaign_recipient_snapshots',
        sa.Column('bounce_type', sa.String(length=30), server_default='unknown', nullable=True)
    )
    op.add_column(
        'campaign_recipient_snapshots',
        sa.Column('is_bounce_listing_deleted', sa.Boolean(), server_default='false', nullable=False)
    )
    op.create_index(
        op.f('ix_campaign_recipient_snapshots_bounce_type'),
        'campaign_recipient_snapshots',
        ['bounce_type'],
        unique=False
    )
    op.create_index(
        op.f('ix_campaign_recipient_snapshots_is_bounce_listing_deleted'),
        'campaign_recipient_snapshots',
        ['is_bounce_listing_deleted'],
        unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_campaign_recipient_snapshots_is_bounce_listing_deleted'), table_name='campaign_recipient_snapshots')
    op.drop_index(op.f('ix_campaign_recipient_snapshots_bounce_type'), table_name='campaign_recipient_snapshots')
    op.drop_column('campaign_recipient_snapshots', 'is_bounce_listing_deleted')
    op.drop_column('campaign_recipient_snapshots', 'bounce_type')

