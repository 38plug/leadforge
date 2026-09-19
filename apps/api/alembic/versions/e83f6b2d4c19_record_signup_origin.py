"""record the origin an account was created from

Revision ID: e83f6b2d4c19
Revises: d72e5c1a8f40
Create Date: 2026-09-20 11:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e83f6b2d4c19'
down_revision: Union[str, None] = 'd72e5c1a8f40'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nullable, with no backfill: accounts that already exist were created
    # before this was recorded, and inventing a value for them would make the
    # limit count them against whoever signs up next from a hash they never
    # came from. They simply do not count towards anyone's limit.
    op.add_column('users', sa.Column('signup_ip_hash', sa.String(length=64), nullable=True))
    op.create_index(op.f('ix_users_signup_ip_hash'), 'users', ['signup_ip_hash'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_users_signup_ip_hash'), table_name='users')
    op.drop_column('users', 'signup_ip_hash')
