"""Track nutrition data source and external catalog identifiers.

Revision ID: 0006_food_data_provenance
Revises: 0005_food_favorites_and_recents
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0006_food_data_provenance"
down_revision = "0005_food_favorites_and_recents"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    columns = {column["name"] for column in inspect(bind).get_columns("food_items")}
    additions = []
    if "source" not in columns:
        additions.append(sa.Column(
            "source", sa.String(), nullable=False,
            server_default="LocalHealth curated",
        ))
    if "source_version" not in columns:
        additions.append(sa.Column("source_version", sa.String(), nullable=True))
    if "external_id" not in columns:
        additions.append(sa.Column("external_id", sa.String(), nullable=True))
    if additions:
        with op.batch_alter_table("food_items") as batch:
            for column in additions:
                batch.add_column(column)

    indexes = {index["name"] for index in inspect(bind).get_indexes("food_items")}
    if "uq_food_source_external_id" not in indexes:
        op.create_index(
            "uq_food_source_external_id",
            "food_items",
            ["source", "external_id"],
            unique=True,
        )


def downgrade():
    bind = op.get_bind()
    indexes = {index["name"] for index in inspect(bind).get_indexes("food_items")}
    if "uq_food_source_external_id" in indexes:
        op.drop_index("uq_food_source_external_id", table_name="food_items")
    columns = {column["name"] for column in inspect(bind).get_columns("food_items")}
    removals = [name for name in ("external_id", "source_version", "source") if name in columns]
    if removals:
        with op.batch_alter_table("food_items") as batch:
            for name in removals:
                batch.drop_column(name)
