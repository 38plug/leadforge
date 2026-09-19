"""add credit purchases and period-scoped unlocks

Revision ID: c41d7a9e0b52
Revises: f9ae75bd61e8
Create Date: 2026-09-19 10:12:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c41d7a9e0b52'
down_revision: Union[str, None] = 'f9ae75bd61e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'credit_purchases',
        sa.Column('workspace_id', sa.String(length=36), nullable=False),
        sa.Column('credits', sa.Integer(), nullable=False),
        sa.Column('amount_cents', sa.Integer(), nullable=False),
        sa.Column('currency', sa.String(length=10), nullable=False, server_default='usd'),
        sa.Column('stripe_session_id', sa.String(length=255), nullable=True),
        sa.Column('purchased_by_user_id', sa.String(length=36), nullable=True),
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['purchased_by_user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_credit_purchases_workspace_id'), 'credit_purchases', ['workspace_id'], unique=False
    )
    op.create_index(
        op.f('ix_credit_purchases_purchased_by_user_id'),
        'credit_purchases',
        ['purchased_by_user_id'],
        unique=False,
    )
    # Unique, so a webhook delivered twice for one payment cannot grant the
    # credits twice. This is the whole of the idempotency guarantee.
    op.create_index(
        op.f('ix_credit_purchases_stripe_session_id'),
        'credit_purchases',
        ['stripe_session_id'],
        unique=True,
    )

    # server_default is required, not cosmetic: the existing unlock rows would
    # otherwise need a NULL in a NOT NULL column. Every unlock made before
    # packs existed came out of a plan allowance, so false is the truthful
    # value as well as the safe one.
    op.add_column(
        'lead_reveals',
        sa.Column('from_credit', sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    # Unlocks are now scoped to the week they were bought in, so the same lead
    # can legitimately be unlocked again in a later week. The old key would
    # reject that as a duplicate. batch_alter_table is what makes this work on
    # SQLite, which cannot drop a constraint in place; on Postgres it is a
    # plain ALTER. No row is read or deleted either way.
    with op.batch_alter_table('lead_reveals') as batch:
        batch.drop_constraint('uq_reveal_workspace_lead', type_='unique')
        batch.create_unique_constraint(
            'uq_reveal_workspace_lead_period', ['workspace_id', 'lead_id', 'period']
        )


def downgrade() -> None:
    with op.batch_alter_table('lead_reveals') as batch:
        batch.drop_constraint('uq_reveal_workspace_lead_period', type_='unique')
        batch.create_unique_constraint('uq_reveal_workspace_lead', ['workspace_id', 'lead_id'])
    op.drop_column('lead_reveals', 'from_credit')
    op.drop_index(op.f('ix_credit_purchases_stripe_session_id'), table_name='credit_purchases')
    op.drop_index(op.f('ix_credit_purchases_purchased_by_user_id'), table_name='credit_purchases')
    op.drop_index(op.f('ix_credit_purchases_workspace_id'), table_name='credit_purchases')
    op.drop_table('credit_purchases')
