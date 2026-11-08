"""Store profile goals, health estimates, and daily routine times.

Revision ID: 0007_profile_routine_and_targets
Revises: 0006_food_data_provenance
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0007_profile_routine_and_targets"
down_revision = "0006_food_data_provenance"
branch_labels = None
depends_on = None


PROFILE_COLUMNS = (
    sa.Column("target_weight_kg", sa.Float(), nullable=True),
    sa.Column("bmr", sa.Float(), nullable=True),
    sa.Column("maintenance_calories", sa.Float(), nullable=True),
    sa.Column("bmi", sa.Float(), nullable=True),
    sa.Column("routine_timezone", sa.String(), nullable=False, server_default="Asia/Kolkata"),
    sa.Column("wake_time", sa.Time(), nullable=True),
    sa.Column("work_start_time", sa.Time(), nullable=True),
    sa.Column("work_end_time", sa.Time(), nullable=True),
    sa.Column("breakfast_time", sa.Time(), nullable=True),
    sa.Column("lunch_time", sa.Time(), nullable=True),
    sa.Column("snack_time", sa.Time(), nullable=True),
    sa.Column("dinner_time", sa.Time(), nullable=True),
    sa.Column("sleep_time", sa.Time(), nullable=True),
)


def upgrade():
    bind = op.get_bind()
    tables = set(inspect(bind).get_table_names())
    if "profile" not in tables:
        return

    existing = {column["name"] for column in inspect(bind).get_columns("profile")}
    additions = [column for column in PROFILE_COLUMNS if column.name not in existing]
    if additions:
        with op.batch_alter_table("profile") as batch:
            for column in additions:
                batch.add_column(column)


def downgrade():
    bind = op.get_bind()
    if "profile" not in set(inspect(bind).get_table_names()):
        return
    existing = {column["name"] for column in inspect(bind).get_columns("profile")}
    removals = [column.name for column in PROFILE_COLUMNS if column.name in existing]
    if removals:
        with op.batch_alter_table("profile") as batch:
            for name in reversed(removals):
                batch.drop_column(name)
