"""lead unlocks outlive the leads they were spent on

Revision ID: d72e5c1a8f40
Revises: c41d7a9e0b52
Create Date: 2026-09-20 09:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd72e5c1a8f40'
down_revision: Union[str, None] = 'c41d7a9e0b52'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Postgres names a foreign key it generates; SQLite does not name one at all,
# so the same batch operation cannot address the constraint on both. The two
# are therefore written separately rather than through one abstraction that
# would only work on the database nobody deploys.
PG_FK = 'lead_reveals_lead_id_fkey'


def upgrade() -> None:
    # A lead_reveal records that an unlock was spent. Deleting the lead
    # afterwards does not un-spend it - the customer already read the contact
    # details - so the row has to survive with its lead_id emptied.
    #
    # Before this, deleting a lead that had ever been unlocked raised a
    # foreign key violation and the request failed outright. Cascading instead
    # would have been worse than the crash: it hands the allowance back, so
    # the weekly limit could be defeated by opening a lead, copying the number
    # and deleting it.
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.alter_column('lead_reveals', 'lead_id', existing_type=sa.String(length=36), nullable=True)
        op.drop_constraint(PG_FK, 'lead_reveals', type_='foreignkey')
        op.create_foreign_key(PG_FK, 'lead_reveals', 'leads', ['lead_id'], ['id'], ondelete='SET NULL')
    else:
        # SQLite rewrites the table; `copy_from` gives batch the shape to
        # rebuild it with, since it cannot introspect an unnamed constraint.
        with op.batch_alter_table('lead_reveals', copy_from=_lead_reveals_table()) as batch:
            batch.alter_column('lead_id', existing_type=sa.String(length=36), nullable=True)
            batch.create_foreign_key(PG_FK, 'leads', ['lead_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    # Rows whose lead is gone cannot be made non-null again without inventing
    # a lead id, so they are removed. That loses usage history, which is what
    # makes this the lossy direction.
    op.execute('DELETE FROM lead_reveals WHERE lead_id IS NULL')
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.drop_constraint(PG_FK, 'lead_reveals', type_='foreignkey')
        op.create_foreign_key(PG_FK, 'lead_reveals', 'leads', ['lead_id'], ['id'])
        op.alter_column('lead_reveals', 'lead_id', existing_type=sa.String(length=36), nullable=False)
    else:
        with op.batch_alter_table('lead_reveals', copy_from=_lead_reveals_table(nullable=True)) as batch:
            batch.alter_column('lead_id', existing_type=sa.String(length=36), nullable=False)


def _lead_reveals_table(nullable: bool = False) -> sa.Table:
    """The table as it stands before the change, for SQLite's rebuild."""
    return sa.Table(
        'lead_reveals',
        sa.MetaData(),
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('workspace_id', sa.String(length=36), sa.ForeignKey('workspaces.id'), nullable=False),
        sa.Column('lead_id', sa.String(length=36), sa.ForeignKey('leads.id'), nullable=nullable),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('period', sa.String(length=20), nullable=False),
        sa.Column('from_credit', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('workspace_id', 'lead_id', 'period', name='uq_reveal_workspace_lead_period'),
    )
