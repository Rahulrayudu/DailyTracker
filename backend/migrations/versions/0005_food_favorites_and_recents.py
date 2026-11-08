"""Add favorites and catalog links for recent foods.

Revision ID: 0005_food_favorites_and_recents
Revises: 0004_water_weight_logs
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0005_food_favorites_and_recents"
down_revision = "0004_water_weight_logs"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    tables = set(inspect(bind).get_table_names())

    if "health_logs" in tables:
        columns = {column["name"] for column in inspect(bind).get_columns("health_logs")}
        if "food_item_id" not in columns:
            with op.batch_alter_table("health_logs") as batch:
                batch.add_column(sa.Column("food_item_id", sa.Integer(), nullable=True))
                batch.create_foreign_key(
                    "fk_health_logs_food_item_id_food_items",
                    "food_items",
                    ["food_item_id"],
                    ["id"],
                )
        indexes = {index["name"] for index in inspect(bind).get_indexes("health_logs")}
        if "ix_health_logs_food_item_id" not in indexes:
            op.create_index("ix_health_logs_food_item_id", "health_logs", ["food_item_id"])

    if "food_favorites" not in tables:
        op.create_table(
            "food_favorites",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "food_item_id",
                sa.Integer(),
                sa.ForeignKey("food_items.id"),
                nullable=False,
                unique=True,
            ),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp()),
        )


def downgrade():
    bind = op.get_bind()
    tables = set(inspect(bind).get_table_names())
    if "food_favorites" in tables:
        op.drop_table("food_favorites")
    if "health_logs" in tables:
        columns = {column["name"] for column in inspect(bind).get_columns("health_logs")}
        if "food_item_id" in columns:
            indexes = {index["name"] for index in inspect(bind).get_indexes("health_logs")}
            if "ix_health_logs_food_item_id" in indexes:
                op.drop_index("ix_health_logs_food_item_id", table_name="health_logs")
            with op.batch_alter_table("health_logs") as batch:
                batch.drop_column("food_item_id")
