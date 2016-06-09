"""empty message

Revision ID: 15b8f4c0da5a
Revises: 1d96e1884bb4
Create Date: 2016-06-08 09:42:31.779520

"""

# revision identifiers, used by Alembic.
revision = '15b8f4c0da5a'
down_revision = '1d96e1884bb4'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('tab', sa.Column('visible', sa.Boolean, default=True))
    op.add_column('tab', sa.Column('external_name', sa.String, unique=True))
    op.create_unique_constraint('uq_user_tab', 'tabs', ['tab_name', 'user_id'])
