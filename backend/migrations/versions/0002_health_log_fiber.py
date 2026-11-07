"""Add fiber to health logs where missing.

Revision ID: 0002_health_log_fiber
Revises: 0001_baseline
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0002_health_log_fiber"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None


def upgrade():
    columns = {column["name"] for column in inspect(op.get_bind()).get_columns("health_logs")}
    if "fiber" not in columns:
        op.add_column("health_logs", sa.Column("fiber", sa.Float(), nullable=False, server_default="0"))


def downgrade():
    # Keep the data-bearing column when rolling back; this migration is additive.
    pass
