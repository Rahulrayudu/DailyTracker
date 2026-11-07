"""Create any missing LocalHealth Pro tables as the initial schema baseline.

Revision ID: 0001_baseline
Revises:
"""
from pathlib import Path
import sys

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from app.models.models import Base

revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Safe for databases created before Alembic: existing tables are preserved.
    Base.metadata.create_all(bind=op.get_bind(), checkfirst=True)


def downgrade():
    # The baseline may represent user data; intentionally do not drop tables.
    pass
