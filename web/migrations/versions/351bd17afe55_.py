"""Add config column to Tab

Revision ID: 351bd17afe55
Revises: 15b8f4c0da5a
Create Date: 2016-07-04 12:06:02.093421

"""

# revision identifiers, used by Alembic.
revision = '351bd17afe55'
down_revision = '15b8f4c0da5a'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('tab', sa.Column('config', sa.JSON))
