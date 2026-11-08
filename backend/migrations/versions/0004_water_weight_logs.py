"""Add water and weight tracking tables.

Revision ID: 0004_water_weight_logs
Revises: 0003_food_fiber_and_meal
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0004_water_weight_logs"
down_revision = "0003_food_fiber_and_meal"
branch_labels = None
depends_on = None


def upgrade():
    tables = set(inspect(op.get_bind()).get_table_names())
    if "water_logs" not in tables:
        op.create_table(
        "water_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("amount_ml", sa.Integer(), nullable=False),
        sa.Column("timestamp", sa.DateTime(), nullable=True),
    )
    if "weight_logs" not in tables:
        op.create_table(
        "weight_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("weight_kg", sa.Float(), nullable=False),
        sa.Column("timestamp", sa.DateTime(), nullable=True),
    )
    inspector = inspect(op.get_bind())
    if "ix_water_logs_id" not in {index["name"] for index in inspector.get_indexes("water_logs")}:
        op.create_index("ix_water_logs_id", "water_logs", ["id"])
    if "ix_water_logs_timestamp" not in {index["name"] for index in inspector.get_indexes("water_logs")}:
        op.create_index("ix_water_logs_timestamp", "water_logs", ["timestamp"])
    if "ix_weight_logs_id" not in {index["name"] for index in inspector.get_indexes("weight_logs")}:
        op.create_index("ix_weight_logs_id", "weight_logs", ["id"])
    if "ix_weight_logs_timestamp" not in {index["name"] for index in inspector.get_indexes("weight_logs")}:
        op.create_index("ix_weight_logs_timestamp", "weight_logs", ["timestamp"])


def downgrade():
    op.drop_index("ix_weight_logs_timestamp", table_name="weight_logs")
    op.drop_index("ix_weight_logs_id", table_name="weight_logs")
    op.drop_table("weight_logs")
    op.drop_index("ix_water_logs_timestamp", table_name="water_logs")
    op.drop_index("ix_water_logs_id", table_name="water_logs")
    op.drop_table("water_logs")
