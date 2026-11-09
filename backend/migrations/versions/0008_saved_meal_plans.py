"""Persist generated weekly meal plans.

Revision ID: 0008_saved_meal_plans
Revises: 0007_profile_routine_and_targets
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "0008_saved_meal_plans"
down_revision = "0007_profile_routine_and_targets"
branch_labels = None
depends_on = None


def upgrade():
    # The baseline migration uses current model metadata to fill in missing
    # tables. On a fresh database that means this table can already exist by
    # the time this revision runs; legacy databases still need it created here.
    if "meal_plans" not in inspect(op.get_bind()).get_table_names():
        op.create_table(
            "meal_plans",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("profile_id", sa.Integer(), nullable=False),
            sa.Column("plan_data", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["profile_id"], ["profile.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("profile_id"),
        )


def downgrade():
    op.drop_table("meal_plans")
