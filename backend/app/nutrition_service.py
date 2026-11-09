"""Deterministic nutrition drafts for foods already in the local catalog."""

import re
from difflib import get_close_matches

from sqlalchemy.orm import Session

from .models.models import FoodItem


NUMBER_WORDS = {
    "a": 1.0, "an": 1.0, "one": 1.0, "two": 2.0, "three": 3.0,
    "four": 4.0, "five": 5.0, "six": 6.0, "seven": 7.0,
    "eight": 8.0, "nine": 9.0, "ten": 10.0, "half": 0.5,
    "quarter": 0.25, "single": 1.0,
}

AMOUNT_PATTERN = re.compile(
    r"(?<![a-z0-9])(?P<amount>\d+(?:[.,]\d+)?|half|quarter|one|two|three|four|five|six|seven|eight|nine|ten|single|a|an)"
    r"\s*(?P<size>mini|small|medium|regular|large|jumbo|single|extra[\s-]?large)?\s*"
    r"(?P<unit>kilograms?|kgs?|kg|grams?|grammes?|grms?|gms?|gm|g|"
    r"milliliters?|millilitres?|ml|liters?|litres?|l|pieces?|pcs|"
    r"cups?|katoris?|bowls?|servings?|portions?|slices?|plates?|glasses?|"
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
    "portion": "portion", "portions": "portion",
    "slice": "slice", "slices": "slice", "plate": "plate", "plates": "plate",
    "glass": "glass", "glasses": "glass", "tablespoon": "tbsp", "tablespoons": "tbsp",
    "tbsp": "tbsp", "teaspoon": "tsp", "teaspoons": "tsp", "tsp": "tsp",
    "handful": "handful", "handfuls": "handful",
}

FRUIT_EDIBLE_WEIGHT_G = {
    "apple": {"mini": 100, "small": 149, "medium": 182, "regular": 182, "large": 223, "jumbo": 260},
    "banana": {"mini": 70, "small": 101, "medium": 118, "regular": 118, "large": 136, "jumbo": 160},
    "orange": {"mini": 70, "small": 96, "medium": 131, "regular": 131, "large": 184, "jumbo": 220},
}

PORTION_FACTORS = {"mini": 0.5, "small": 0.75, "medium": 1.0, "regular": 1.0, "single": 1.0, "large": 1.5, "jumbo": 2.0, "extralarge": 2.0, "extra-large": 2.0}
PORTION_UNIT_EQUIVALENTS = {"cup": 1.0, "bowl": 1.0, "katori": 0.75, "serving": 1.0, "portion": 1.0, "glass": 1.0, "plate": 1.5}
HOUSEHOLD_UNIT_G = {"cup": 240, "bowl": 240, "katori": 150, "glass": 250, "plate": 300}
HOUSEHOLD_UNIT_ML = {"cup": 240, "bowl": 240, "katori": 180, "glass": 250}

FILLER_WORDS = {
    "i", "had", "ate", "eaten", "eat", "consumed", "logged", "log",
    "today", "just", "of", "the", "my", "please", "food", "for",
    "breakfast", "lunch", "dinner", "snack", "meal", "at", "around",
    "additional", "details", "some", "about", "roughly", "approximately", "approx", "size", "sized", "one", "single",
    "and", "with", "plus", "along",
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


def normalize_attached_measurements(text: str) -> str:
    """Separate typed-together quantities such as ``100gmapple``."""
    unit = r"kilograms?|kgs?|kg|grams?|grammes?|grms?|gms?|gm|g|milliliters?|millilitres?|ml|liters?|litres?|l"
    return re.sub(
        rf"(?i)(\d+(?:[.,]\d+)?)({unit})(?=[a-z])",
        r"\1 \2 ",
        text,
    )


def _food_vocabulary(items, aliases):
    words = set()
    for item in items:
        for term in (item.name, *aliases.get(item.name, ())):
            words.update(_normalized(term).split())
    return words


def correct_food_spelling(text: str, items, aliases):
    text = normalize_attached_measurements(text)
    vocabulary = _food_vocabulary(items, aliases)
    corrections = []

    def correct(match):
        word = match.group(0)
        lowered = word.lower()
        if len(lowered) < 4 or lowered in vocabulary:
            return word
        candidates = sorted(candidate for candidate in vocabulary if abs(len(candidate) - len(lowered)) <= 1)
        close = get_close_matches(lowered, candidates, n=1, cutoff=0.82)
        if not close:
            return word
        corrected = close[0]
        if not any(item["original"].casefold() == lowered for item in corrections):
            corrections.append({"original": word, "corrected": corrected})
        return corrected

    return re.sub(r"[A-Za-z]+", correct, text), corrections


def _unit_amount(text: str):
    matches = list(AMOUNT_PATTERN.finditer(text))
    if len(matches) > 1:
        measured = [
            match for match in matches
            if match.group("unit") or match.group("size")
            or match.group("amount").lower() not in {"a", "an", "one"}
        ]
        unmeasured_are_determiners = all(
            match in measured or (
                match.group("amount").lower() in {"a", "an", "one"}
                and not match.group("unit")
                and not match.group("size")
            )
            for match in matches
        )
        if len(measured) == 1 and unmeasured_are_determiners:
            matches = measured
    if len(matches) != 1:
        if matches:
            return None
        portion = re.search(
            r"(?<![a-z0-9])(?P<size>mini|small|medium|regular|large|jumbo|single)\s*"
            r"(?P<unit>bowls?|plates?|cups?|katoris?|servings?|portions?|slices?|glasses?|pieces?)?\b",
            text,
        )
        if not portion:
            return None
        return {
            "value": 1.0,
            "unit": _unit(portion.group("unit")),
            "size": portion.group("size").lower(),
            "start": portion.start(),
            "end": portion.end(),
            "label": portion.group(0).strip(),
        }
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

    size = (amount["size"] or "").lower().replace(" ", "").replace("_", "-")
    if not input_unit:
        if fruit_name:
            input_unit = "piece"
        elif size and base_unit in {"g", "kg", "ml", "l"}:
            input_unit = "serving"
        elif size and base_unit in {"piece", "cup", "katori", "bowl", "serving", "portion", "slice", "plate", "glass"}:
            input_unit = base_unit
        elif value >= 10:
            input_unit = "g"
        elif base_unit in {"piece", "cup", "katori", "bowl", "serving", "slice", "plate", "glass"}:
            input_unit = base_unit
        else:
            return None, None

    size_factor = PORTION_FACTORS.get(size, 1.0)
    if input_unit in {"serving", "portion"} and base_unit in {"serving", "portion"}:
        return (value / base_value) * size_factor, f"{size} portion size" if size else None
    if input_unit in {"serving", "portion"}:
        return value * size_factor, f"{size} catalog serving" if size else "one catalog serving"
    if input_unit == base_unit:
        return (value / base_value) * size_factor, f"{size} portion size" if size else None
    if input_unit in HOUSEHOLD_UNIT_G and base_unit == "g":
        assumed_grams = HOUSEHOLD_UNIT_G[input_unit] * size_factor
        return value * assumed_grams / base_value, f"{size or 'standard'} {input_unit} (~{assumed_grams:g} g)"
    if input_unit in HOUSEHOLD_UNIT_ML and base_unit == "ml":
        assumed_ml = HOUSEHOLD_UNIT_ML[input_unit] * size_factor
        return value * assumed_ml / base_value, f"{size or 'standard'} {input_unit} (~{assumed_ml:g} ml)"
    if input_unit in PORTION_UNIT_EQUIVALENTS and base_unit in PORTION_UNIT_EQUIVALENTS:
        multiplier = value * PORTION_UNIT_EQUIVALENTS[input_unit] / (base_value * PORTION_UNIT_EQUIVALENTS[base_unit])
        return multiplier * size_factor, f"{size} serving size" if size else "household serving conversion"
    if input_unit == "kg" and base_unit == "g":
        return value * 1000 / base_value, None
    if input_unit == "g" and base_unit == "kg":
        return value / 1000 / base_value, None
    if input_unit == "l" and base_unit == "ml":
        return value * 1000 / base_value, None
    if input_unit == "ml" and base_unit == "l":
        return value / 1000 / base_value, None

    if fruit_name and input_unit == "piece":
        size = size if size in FRUIT_EDIBLE_WEIGHT_G[fruit_name] else "medium"
        grams_per_piece = FRUIT_EDIBLE_WEIGHT_G[fruit_name][size]
        if base_unit == "g":
            return value * grams_per_piece / base_value, f"{size} {fruit_name}, {grams_per_piece} g edible per piece"
        if base_unit == "piece":
            return value / base_value, f"{size} {fruit_name}"
    if fruit_name and input_unit == "g" and base_unit == "piece":
        size = size if size in FRUIT_EDIBLE_WEIGHT_G[fruit_name] else "medium"
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
        size_label = f" {amount['size']}" if amount["size"] else ""
        quantity_label = f"{amount['value']:g}{size_label} {display_unit} {item.name}"
    elif amount["size"] and not serving_assumption:
        quantity_label = f"1 {amount['size']} portion of {item.name}"
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


def catalog_food_drafts(text: str, db: Session, aliases: dict):
    """Resolve clear catalog foods independently and retain spelling fixes."""
    items = db.query(FoodItem).filter(FoodItem.name.in_(list(aliases))).all()
    text = normalize_attached_measurements(text)
    sections = re.split(r"\nadditional details:\s*", text, flags=re.IGNORECASE)
    corrected_text, corrections = correct_food_spelling(sections[0], items, aliases)
    portion_sections = []
    for section in sections[1:]:
        corrected_section, section_corrections = correct_food_spelling(section, items, aliases)
        portion_sections.append(corrected_section)
        corrections.extend(section_corrections)
    split_pattern = r"\s*(?:;|\+|(?<!\d),(?!\d)|\balong\s+with\b|\band\b|\bwith\b|\bplus\b)\s*"
    parts = [part.strip() for part in re.split(split_pattern, corrected_text, flags=re.IGNORECASE) if part.strip()]
    drafts = [catalog_food_draft(part, db, aliases) for part in parts]
    if not drafts or any(draft is None for draft in drafts):
        return None

    clarifications = [draft for draft in drafts if draft["status"] == "clarification"]
    if clarifications and portion_sections:
        universal_single_portion = any(
            re.search(r"\b(?:everything|all(?: of them)?|each|every(?:thing| item| food))\b.*\b(?:single|one|1)\s+(?:portion|serving)\b", section, re.IGNORECASE)
            or re.fullmatch(r"\s*(?:single|one|1)\s+(?:portion|serving)\s+(?:each|for each)\s*", section, re.IGNORECASE)
            for section in portion_sections
        )
        portion_parts = [
            part.strip()
            for section in portion_sections
            for part in re.split(split_pattern, section, flags=re.IGNORECASE)
            if part.strip()
        ]
        if universal_single_portion:
            portion_parts = ["single portion"] * len(clarifications)
        if len(portion_parts) == len(clarifications):
            clarification_index = 0
            for index, draft in enumerate(drafts):
                if draft["status"] != "clarification":
                    continue
                completed = catalog_food_draft(f"{portion_parts[clarification_index]} {draft['food_description']}", db, aliases)
                if completed and completed["status"] == "ready":
                    drafts[index] = completed
                clarification_index += 1
            clarifications = [draft for draft in drafts if draft["status"] == "clarification"]

    if clarifications:
        foods_needing_portions = ", ".join(draft["food_description"].lower() for draft in clarifications)
        question = clarifications[0]["question"] if len(clarifications) == 1 else (
            f"What portion sizes did you have for {foods_needing_portions}? "
            "You can say ‘one small bowl’ or ‘two pieces’ for each."
        )
        return {"status": "clarification", "question": question, "clarification_type": "missing_portion", "corrections": corrections}

    if len(drafts) == 1:
        return {**drafts[0], "items": drafts, "corrections": corrections}
    return {"status": "ready", "question": "", "items": drafts, "corrections": corrections}
