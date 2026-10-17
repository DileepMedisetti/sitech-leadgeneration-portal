"""add lead enrichment fields and query cache

Revision ID: 45431fab98fe
Revises: 1bcac77aa890
Create Date: 2026-10-16 13:42:48.807836

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '45431fab98fe'
down_revision: Union[str, Sequence[str], None] = '1bcac77aa890'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'search_query_cache',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('query_hash', sa.String(length=64), nullable=False),
        sa.Column('query', sa.Text(), nullable=False),
        sa.Column('results_json', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_search_query_cache_query_hash'), 'search_query_cache', ['query_hash'], unique=True)
    op.add_column('leads', sa.Column('department', sa.String(length=255), nullable=True))
    op.add_column('leads', sa.Column('research_specialization', sa.Text(), nullable=True))
    op.add_column('leads', sa.Column('qualification_status', sa.String(length=30), server_default='qualified', nullable=False))
    op.add_column('leads', sa.Column('confidence_score', sa.Float(), nullable=True))
    op.add_column('leads', sa.Column('qualification_reason', sa.Text(), nullable=True))
    op.add_column('leads', sa.Column('evidence', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('leads', sa.Column('search_job_id', sa.BigInteger(), nullable=True))
    op.create_index('ix_leads_created_at', 'leads', ['created_at'], unique=False)
    op.create_index('ix_leads_qualification_status', 'leads', ['qualification_status'], unique=False)
    op.create_index('ix_leads_search_job_id', 'leads', ['search_job_id'], unique=False)
    op.create_foreign_key('fk_leads_search_job_id', 'leads', 'search_jobs', ['search_job_id'], ['id'], ondelete='SET NULL')
    op.add_column('search_results', sa.Column('retry_count', sa.Integer(), server_default='0', nullable=False))
    op.add_column('search_results', sa.Column('candidate_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.drop_constraint('search_results_lead_id_fkey', 'search_results', type_='foreignkey')
    op.create_foreign_key('fk_search_results_lead_id', 'search_results', 'leads', ['lead_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_search_results_lead_id', 'search_results', type_='foreignkey')
    op.create_foreign_key('search_results_lead_id_fkey', 'search_results', 'leads', ['lead_id'], ['id'], ondelete='RESTRICT')
    op.drop_column('search_results', 'candidate_data')
    op.drop_column('search_results', 'retry_count')
    op.drop_constraint('fk_leads_search_job_id', 'leads', type_='foreignkey')
    op.drop_index('ix_leads_search_job_id', table_name='leads')
    op.drop_index('ix_leads_qualification_status', table_name='leads')
    op.drop_index('ix_leads_created_at', table_name='leads')
    op.drop_column('leads', 'search_job_id')
    op.drop_column('leads', 'evidence')
    op.drop_column('leads', 'qualification_reason')
    op.drop_column('leads', 'confidence_score')
    op.drop_column('leads', 'qualification_status')
    op.drop_column('leads', 'research_specialization')
    op.drop_column('leads', 'department')
    op.drop_index(op.f('ix_search_query_cache_query_hash'), table_name='search_query_cache')
    op.drop_table('search_query_cache')
