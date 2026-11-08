"""Persist generated weekly meal plans.

Revision ID: 0008_saved_meal_plans
Revises: 0007_profile_routine_and_targets
"""
from alembic import op
import sqlalchemy as sa


revision = "0008_saved_meal_plans"
down_revision = "0007_profile_routine_and_targets"
branch_labels = None
depends_on = None


def upgrade():
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
