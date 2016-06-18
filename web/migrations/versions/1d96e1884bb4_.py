"""Add 'note' table.

Revision ID: 1d96e1884bb4
Revises: 4473c5fbc50e
Create Date: 2015-11-20 23:10:59.012679

"""

# revision identifiers, used by Alembic.
revision = '1d96e1884bb4'
down_revision = '4473c5fbc50e'

from alembic import op
import sqlalchemy as sa


def upgrade():
    with op.batch_alter_table('user') as batch_op:
        batch_op.drop_column('notes')

    op.create_table('note',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('raw_contents', sa.Text(), nullable=True),
            sa.Column('user_id', sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
            sa.PrimaryKeyConstraint('id')
    )

def downgrade():
    with op.batch_alter_table('user') as batch_op:
        batch_op.add_column(sa.Column('notes', sa.Text(), nullable=True))

    op.drop_table('note')
