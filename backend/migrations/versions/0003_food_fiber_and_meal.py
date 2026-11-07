"""Add fiber to reference foods and meal grouping to food logs.

Revision ID: 0003_food_fiber_and_meal
Revises: 0002_health_log_fiber
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0003_food_fiber_and_meal"
down_revision = "0002_health_log_fiber"
branch_labels = None
depends_on = None


def upgrade():
    inspector = inspect(op.get_bind())
    food_columns = {column["name"] for column in inspector.get_columns("food_items")}
    log_columns = {column["name"] for column in inspector.get_columns("health_logs")}
    if "fiber" not in food_columns:
        op.add_column("food_items", sa.Column("fiber", sa.Float(), nullable=False, server_default="0"))
    if "meal" not in log_columns:
        op.add_column("health_logs", sa.Column("meal", sa.String(), nullable=False, server_default="Snack"))


def downgrade():
    # Keep additive nutrition data when rolling back.
    pass
