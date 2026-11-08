"""Deterministic nutrition drafts for foods already in the local catalog."""

import re

from sqlalchemy.orm import Session

from .models.models import FoodItem


NUMBER_WORDS = {
    "a": 1.0, "an": 1.0, "one": 1.0, "two": 2.0, "three": 3.0,
    "four": 4.0, "five": 5.0, "six": 6.0, "seven": 7.0,
    "eight": 8.0, "nine": 9.0, "ten": 10.0, "half": 0.5,
    "quarter": 0.25,
}

AMOUNT_PATTERN = re.compile(
    r"(?<![a-z0-9])(?P<amount>\d+(?:[.,]\d+)?|half|quarter|one|two|three|four|five|six|seven|eight|nine|ten|a|an)"
    r"\s*(?P<size>small|medium|large)?\s*"
    r"(?P<unit>kilograms?|kgs?|kg|grams?|grammes?|grms?|gms?|gm|g|"
    r"milliliters?|millilitres?|ml|liters?|litres?|l|pieces?|pcs|"
    r"cups?|katoris?|bowls?|servings?|slices?|plates?|glasses?|"
    r"tablespoons?|tbsp|teaspoons?|tsp|handfuls?)?\b",
    re.IGNORECASE,
)

UNIT_ALIASES = {
    "kilogram": "kg", "kilograms": "kg", "kgs": "kg",
    "gram": "g", "grams": "g", "gramme": "g", "grammes": "g",
    "grm": "g", "grms": "g", "gm": "g", "gms": "g",
    "milliliter": "ml", "milliliters": "ml", "millilitre": "ml", "millilitres": "ml",
    "liter": "l", "liters": "l", "litre": "l", "litres": "l",
    "piece": "piece", "pieces": "piece", "pc": "piece", "pcs": "piece",
    "cup": "cup", "cups": "cup", "katori": "katori", "katoris": "katori",
    "bowl": "bowl", "bowls": "bowl", "serving": "serving", "servings": "serving",
    "slice": "slice", "slices": "slice", "plate": "plate", "plates": "plate",
    "glass": "glass", "glasses": "glass", "tablespoon": "tbsp", "tablespoons": "tbsp",
    "tbsp": "tbsp", "teaspoon": "tsp", "teaspoons": "tsp", "tsp": "tsp",
    "handful": "handful", "handfuls": "handful",
}

FRUIT_EDIBLE_WEIGHT_G = {
    "apple": {"small": 149, "medium": 182, "large": 223},
    "banana": {"small": 101, "medium": 118, "large": 136},
    "orange": {"small": 96, "medium": 131, "large": 184},
}

FILLER_WORDS = {
    "i", "had", "ate", "eaten", "eat", "consumed", "logged", "log",
    "today", "just", "of", "the", "my", "please", "food", "for",
    "breakfast", "lunch", "dinner", "snack", "meal", "at", "around",
    "additional", "details",
}


def _normalized(text: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9]+", " ", text.lower()).split())


def _amount_value(raw: str) -> float:
    raw = raw.lower().replace(",", ".")
    if raw in NUMBER_WORDS:
        return NUMBER_WORDS[raw]
    return float(raw)


def _unit(raw: str) -> str:
    value = (raw or "").lower().strip()
    return UNIT_ALIASES.get(value, value)


def _unit_amount(text: str):
    matches = list(AMOUNT_PATTERN.finditer(text))
    if len(matches) > 1:
        measured = [
            match for match in matches
            if match.group("unit") or match.group("size")
            or match.group("amount").lower() not in {"a", "an"}
        ]
        if len(measured) == 1 and len(measured) + sum(
            match.group("amount").lower() in {"a", "an"} and not match.group("unit") and not match.group("size")
            for match in matches
        ) == len(matches):
            matches = measured
    if len(matches) != 1:
        return None
    match = matches[0]
    unit = _unit(match.group("unit"))
    size = (match.group("size") or "").lower()
    suffix = text[match.end():].lstrip()
    if not unit and suffix.startswith(("am ", "pm ")):
        return None
    return {
        "value": _amount_value(match.group("amount")),
        "unit": unit,
        "size": size,
        "start": match.start(),
        "end": match.end(),
        "label": " ".join(part for part in (match.group("amount"), size, unit) if part),
    }


def _food_matches(text: str, items, aliases):
    matches = []
    for item in items:
        terms = [item.name, *aliases.get(item.name, ())]
        for term in terms:
            normalized_term = _normalized(term)
            if not normalized_term:
                continue
            words = re.escape(normalized_term).replace(r"\ ", r"\s+")
            plural = "" if normalized_term.endswith("s") else "s?"
            pattern = re.compile(rf"(?<![a-z0-9]){words}{plural}(?![a-z0-9])")
            for found in pattern.finditer(text):
                matches.append((found.start(), found.end(), item))

    if not matches:
        return []
    # Prefer the longest phrase at each position, so "brown rice" wins over
    # a generic "rice" alias if the catalog contains both entries.
    selected = []
    for match in matches:
        start, end, _item = match
        if any(other[0] == start and other[1] > end for other in matches):
            continue
        selected.append(match)
    return selected


def _serving_multiplier(item: FoodItem, amount):
    serving = _normalized(item.serving_size or "")
    base_match = re.match(r"^(\d+(?:\.\d+)?)\s*([a-z]+)$", serving)
    if not base_match:
        return None, None
    base_value = float(base_match.group(1))
    base_unit = _unit(base_match.group(2))
    value = amount["value"]
    input_unit = amount["unit"]
    item_name = item.name.lower()
    fruit_name = next((name for name in FRUIT_EDIBLE_WEIGHT_G if name in item_name), None)

    if not input_unit:
        if amount["size"] or fruit_name:
            input_unit = "piece"
        elif value >= 10:
            input_unit = "g"
        elif base_unit in {"piece", "cup", "katori", "bowl", "serving", "slice", "plate", "glass"}:
            input_unit = base_unit
        else:
            return None, None

    if input_unit == "serving":
        return value, None
    if input_unit == base_unit:
        return value / base_value, None
    if input_unit == "kg" and base_unit == "g":
        return value * 1000 / base_value, None
    if input_unit == "g" and base_unit == "kg":
        return value / 1000 / base_value, None
    if input_unit == "l" and base_unit == "ml":
        return value * 1000 / base_value, None
    if input_unit == "ml" and base_unit == "l":
        return value / 1000 / base_value, None

    if fruit_name and input_unit == "piece":
        size = amount["size"] or "medium"
        grams_per_piece = FRUIT_EDIBLE_WEIGHT_G[fruit_name][size]
        if base_unit == "g":
            return value * grams_per_piece / base_value, f"{size} {fruit_name}, {grams_per_piece} g edible per piece"
        if base_unit == "piece":
            return value / base_value, f"{size} {fruit_name}"
    if fruit_name and input_unit == "g" and base_unit == "piece":
        size = amount["size"] or "medium"
        grams_per_piece = FRUIT_EDIBLE_WEIGHT_G[fruit_name][size]
        return value / grams_per_piece / base_value, f"{size} {fruit_name}, {grams_per_piece} g edible per piece"

    return None, None


def catalog_food_draft(text: str, db: Session, aliases: dict):
    """Build a scaled draft for one unambiguous catalog food and quantity.

    Return None when the text is a mixed meal or uses a unit that cannot be
    reliably converted. Those entries go through the AI clarification flow.
    """
    normalized_text = _normalized(text)
    catalog_names = list(aliases)
    items = db.query(FoodItem).filter(FoodItem.name.in_(catalog_names)).all()
    matches = _food_matches(normalized_text, items, aliases)
    item_ids = {item.id for _start, _end, item in matches}
    if len(item_ids) != 1:
        return None

    item = next(item for _start, _end, item in matches)
    amount = _unit_amount(normalized_text)

    # Remove the detected food and quantity before deciding whether modifiers
    # such as "fried", "juice", or a second ingredient make catalog scaling unsafe.
    remaining = list(normalized_text)
    spans = [(start, end) for start, end, _ in matches]
    if amount:
        spans.append((amount["start"], amount["end"]))
    for start, end in spans:
        for index in range(start, end):
            remaining[index] = " "
    extra_words = [word for word in "".join(remaining).split() if word not in FILLER_WORDS]
    if extra_words:
        return None

    if amount is None:
        return {
            "status": "clarification",
            "question": f"How much {item.name.lower()} did you have? For example, {item.serving_size} or a specific number of pieces.",
            "food_description": item.name,
            "calories": 0,
            "protein": 0,
            "carbs": 0,
            "fats": 0,
            "fiber": 0,
            "source": "database",
            "confidence": "needs amount",
        }

    multiplier, serving_assumption = _serving_multiplier(item, amount)
    if multiplier is None or multiplier <= 0:
        return None

    if amount["unit"]:
        display_unit = amount["unit"]
        if display_unit == "piece" and amount["value"] != 1:
            display_unit = "pieces"
        quantity_label = f"{amount['value']:g} {display_unit} {item.name}"
    elif amount["size"] or serving_assumption:
        quantity_label = f"{amount['value']:g} × {item.name}"
    elif amount["value"] >= 10:
        quantity_label = f"{amount['value']:g} g {item.name}"
    else:
        quantity_label = f"{amount['value']:g} × {item.name}"
    description = quantity_label
    if serving_assumption:
        description += f" (assumed {serving_assumption})"
    description += f" · catalog serving {item.serving_size}"
    return {
        "status": "ready",
        "question": "",
        "food_description": description,
        "calories": round(float(item.calories or 0) * multiplier, 1),
        "protein": round(float(item.protein or 0) * multiplier, 1),
        "carbs": round(float(item.carbs or 0) * multiplier, 1),
        "fats": round(float(item.fats or 0) * multiplier, 1),
        "fiber": round(float(item.fiber or 0) * multiplier, 1),
        "source": "database",
        "confidence": "catalog values",
        "food_item_id": item.id,
    }
