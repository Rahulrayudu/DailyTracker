"""Import USDA FoodData Central Foundation Foods CSV data into SQLite.

Download and extract a Foundation Foods CSV release from USDA before running
this module. It imports only foods with complete core nutrient data, keyed by
FDC ID so rerunning or importing an updated release refreshes rows in place.
"""
import argparse
import csv
from collections import defaultdict
from pathlib import Path

from .app.database import init_db, SessionLocal
from .app.models.models import FoodItem


SOURCE = "USDA FoodData Central — Foundation Foods"
NUTRIENT_IDS = {
    "protein": (1003,),
    "fats": (1004,),
    "carbs": (1005,),
    "fiber": (1079,),
    "calories": (1008, 2047, 2048),
}


def find_csv(root: Path, filename: str) -> Path:
    matches = list(root.rglob(filename))
    if not matches:
        raise FileNotFoundError(f"Could not find {filename} under {root}")
    if len(matches) > 1:
        raise ValueError(f"Found multiple {filename} files under {root}; pass the dataset folder")
    return matches[0]


def read_rows(path: Path):
    # USDA states the downloadable Foundation CSV is ASCII/ISO-8859-1.
    with path.open("r", encoding="latin-1", newline="") as handle:
        yield from csv.DictReader(handle)


def load_foundation_rows(root: Path):
    foods_file = find_csv(root, "food.csv")
    nutrients_file = find_csv(root, "food_nutrient.csv")

    foods = {}
    for row in read_rows(foods_file):
        if row.get("data_type", "").strip().lower() == "foundation":
            foods[row["fdc_id"]] = row.get("description", "").strip()

    values = defaultdict(lambda: defaultdict(list))
    for row in read_rows(nutrients_file):
        fdc_id = row.get("fdc_id")
        if fdc_id not in foods:
            continue
        try:
            nutrient_id = int(row["nutrient_id"])
            amount = float(row["amount"])
        except (KeyError, TypeError, ValueError):
            continue
        values[fdc_id][nutrient_id].append(amount)

    complete = []
    missing_core = 0
    for fdc_id, name in foods.items():
        per_food = values.get(fdc_id, {})
        selected = {}
        for nutrient, candidates in NUTRIENT_IDS.items():
            available = next((per_food[nid] for nid in candidates if per_food.get(nid)), None)
            if available is None:
                break
            selected[nutrient] = sum(available) / len(available)
        if len(selected) != len(NUTRIENT_IDS) or not name:
            missing_core += 1
            continue
        complete.append((fdc_id, name, selected))
    return complete, missing_core


def import_dataset(root: Path, version: str):
    rows, skipped = load_foundation_rows(root)
    init_db()
    db = SessionLocal()
    inserted = 0
    updated = 0
    try:
        for fdc_id, name, nutrients in rows:
            item = (
                db.query(FoodItem)
                .filter(FoodItem.source == SOURCE, FoodItem.external_id == fdc_id)
                .first()
            )
            if item is None:
                item = FoodItem(source=SOURCE, external_id=fdc_id)
                db.add(item)
                inserted += 1
            else:
                updated += 1
            item.name = name
            item.source_version = version
            item.calories = nutrients["calories"]
            item.protein = nutrients["protein"]
            item.carbs = nutrients["carbs"]
            item.fats = nutrients["fats"]
            item.fiber = nutrients["fiber"]
            item.serving_size = "100 g"
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
    return {"inserted": inserted, "updated": updated, "skipped_incomplete": skipped}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dataset_dir", type=Path, help="Extracted USDA Foundation Foods CSV directory")
    parser.add_argument("--version", required=True, help="Dataset release label, e.g. 2026-10")
    args = parser.parse_args()
    if not args.dataset_dir.is_dir():
        parser.error(f"Dataset directory does not exist: {args.dataset_dir}")
    result = import_dataset(args.dataset_dir, args.version)
    print(
        "USDA Foundation import complete: "
        f"{result['inserted']} inserted, {result['updated']} updated, "
        f"{result['skipped_incomplete']} skipped (missing one or more core nutrients)."
    )


if __name__ == "__main__":
    main()
