"""Curated, catalog-backed Indian meal plans and grocery aggregation."""

from copy import deepcopy
from datetime import date, timedelta
import math
import re


MEAL_SHARES = {"Breakfast": 0.25, "Lunch": 0.35, "Snack": 0.15, "Dinner": 0.25}

# Amounts describe the prepared foods used for nutrition calculation. Grocery
# equivalents convert selected cooked foods to practical shopping quantities.
RECIPES = [
    {
        "id": "breakfast-oats-banana",
        "name": "Banana peanut oats",
        "meal_type": "Breakfast",
        "diet": "vegan",
        "ingredients": [
            {"food": "Oats, dry", "amount": 55, "unit": "g", "grocery": "Rolled oats", "grocery_factor": 1, "grocery_unit": "g", "category": "Grains and staples"},
            {"food": "Banana", "amount": 80, "unit": "g", "grocery": "Bananas", "grocery_factor": 1, "grocery_unit": "g", "category": "Fruit"},
            {"food": "Peanut butter", "amount": 12, "unit": "g", "grocery": "Peanut butter", "grocery_factor": 1, "grocery_unit": "g", "category": "Pantry"},
        ],
    },
    {
        "id": "breakfast-idli-sambar",
        "name": "Idli with sambar",
        "meal_type": "Breakfast",
        "diet": "vegan",
        "ingredients": [
            {"food": "Idli", "amount": 4, "unit": "piece", "grocery": "Idli or dosa batter", "grocery_factor": 40, "grocery_unit": "g", "category": "Grains and staples"},
            {"food": "Sambar", "amount": 2, "unit": "katori", "grocery": "Sambar ingredients", "grocery_factor": 50, "grocery_unit": "g", "category": "Grains and staples"},
        ],
    },
    {
        "id": "breakfast-poha",
        "name": "Poha with tomato and cucumber",
        "meal_type": "Breakfast",
        "diet": "vegan",
        "ingredients": [
            {"food": "Poha", "amount": 180, "unit": "g", "grocery": "Flattened rice (poha)", "grocery_factor": 0.5, "grocery_unit": "g", "category": "Grains and staples"},
            {"food": "Tomato", "amount": 50, "unit": "g", "grocery": "Tomatoes", "grocery_factor": 1, "grocery_unit": "g", "category": "Vegetables"},
            {"food": "Cucumber", "amount": 60, "unit": "g", "grocery": "Cucumber", "grocery_factor": 1, "grocery_unit": "g", "category": "Vegetables"},
        ],
    },
    {
        "id": "breakfast-tofu-roti",
        "name": "Tofu roti plate",
        "meal_type": "Breakfast",
        "diet": "vegan",
        "ingredients": [
            {"food": "Tofu, firm", "amount": 100, "unit": "g", "grocery": "Firm tofu", "grocery_factor": 1, "grocery_unit": "g", "category": "Protein and pulses"},
            {"food": "Roti", "amount": 2, "unit": "piece", "grocery": "Whole wheat atta", "grocery_factor": 30, "grocery_unit": "g", "category": "Grains and staples"},
            {"food": "Tomato", "amount": 50, "unit": "g", "grocery": "Tomatoes", "grocery_factor": 1, "grocery_unit": "g", "category": "Vegetables"},
        ],
    },
    {
        "id": "breakfast-dosa-sambar",
        "name": "Dosa with sambar",
        "meal_type": "Breakfast",
        "diet": "vegan",
        "ingredients": [
            {"food": "Dosa", "amount": 2, "unit": "medium", "grocery": "Idli or dosa batter", "grocery_factor": 80, "grocery_unit": "g", "category": "Grains and staples"},
            {"food": "Sambar", "amount": 1.5, "unit": "katori", "grocery": "Sambar ingredients", "grocery_factor": 50, "grocery_unit": "g", "category": "Grains and staples"},
        ],
    },
    {
        "id": "breakfast-oats-milk",
        "name": "Milk oats with banana and almonds",
        "meal_type": "Breakfast",
        "diet": "vegetarian",
        "ingredients": [
            {"food": "Oats, dry", "amount": 55, "unit": "g", "grocery": "Rolled oats", "grocery_factor": 1, "grocery_unit": "g", "category": "Grains and staples"},
            {"food": "Milk", "amount": 200, "unit": "ml", "grocery": "Milk", "grocery_factor": 1, "grocery_unit": "ml", "category": "Dairy and alternatives"},
            {"food": "Banana", "amount": 60, "unit": "g", "grocery": "Bananas", "grocery_factor": 1, "grocery_unit": "g", "category": "Fruit"},
            {"food": "Almonds", "amount": 8, "unit": "g", "grocery": "Almonds", "grocery_factor": 1, "grocery_unit": "g", "category": "Pantry"},
        ],
    },
    {
        "id": "breakfast-egg-roti",
        "name": "Egg and roti breakfast",
        "meal_type": "Breakfast",
        "diet": "egg",
        "ingredients": [
            {"food": "Egg", "amount": 2, "unit": "piece", "grocery": "Eggs", "grocery_factor": 1, "grocery_unit": "piece", "category": "Protein and pulses"},
            {"food": "Roti", "amount": 2, "unit": "piece", "grocery": "Whole wheat atta", "grocery_factor": 30, "grocery_unit": "g", "category": "Grains and staples"},
            {"food": "Tomato", "amount": 50, "unit": "g", "grocery": "Tomatoes", "grocery_factor": 1, "grocery_unit": "g", "category": "Vegetables"},
        ],
    },
    {
        "id": "lunch-dal-rice",
        "name": "Dal, rice and cucumber",
        "meal_type": "Lunch",
        "diet": "vegan",
        "ingredients": [
            {"food": "Dal", "amount": 1.5, "unit": "katori", "grocery": "Dry dal or lentils", "grocery_factor": 35, "grocery_unit": "g", "category": "Protein and pulses"},
            {"food": "Cooked white rice", "amount": 180, "unit": "g", "grocery": "Rice (dry)", "grocery_factor": 0.35, "grocery_unit": "g", "category": "Grains and staples"},
            {"food": "Cucumber", "amount": 100, "unit": "g", "grocery": "Cucumber", "grocery_factor": 1, "grocery_unit": "g", "category": "Vegetables"},
        ],
    },
    {
        "id": "lunch-chana-roti",
        "name": "Chickpea roti bowl",
        "meal_type": "Lunch",
        "diet": "vegan",
        "ingredients": [
            {"food": "Chickpeas, cooked", "amount": 160, "unit": "g", "grocery": "Dry chickpeas", "grocery_factor": 0.4, "grocery_unit": "g", "category": "Protein and pulses"},
            {"food": "Roti", "amount": 2, "unit": "piece", "grocery": "Whole wheat atta", "grocery_factor": 30, "grocery_unit": "g", "category": "Grains and staples"},
            {"food": "Cucumber", "amount": 80, "unit": "g", "grocery": "Cucumber", "grocery_factor": 1, "grocery_unit": "g", "category": "Vegetables"},
        ],
    },
    {
        "id": "lunch-paneer-roti",
        "name": "Paneer roti with greens",
        "meal_type": "Lunch",
        "diet": "vegetarian",
        "ingredients": [
            {"food": "Paneer", "amount": 100, "unit": "g", "grocery": "Paneer", "grocery_factor": 1, "grocery_unit": "g", "category": "Dairy and alternatives"},
            {"food": "Roti", "amount": 2, "unit": "piece", "grocery": "Whole wheat atta", "grocery_factor": 30, "grocery_unit": "g", "category": "Grains and staples"},
            {"food": "Spinach, cooked", "amount": 60, "unit": "g", "grocery": "Fresh spinach", "grocery_factor": 2.5, "grocery_unit": "g", "category": "Vegetables"},
            {"food": "Tomato", "amount": 50, "unit": "g", "grocery": "Tomatoes", "grocery_factor": 1, "grocery_unit": "g", "category": "Vegetables"},
        ],
    },
    {
        "id": "lunch-chicken-rice",
        "name": "Chicken rice bowl with greens",
        "meal_type": "Lunch",
        "diet": "non-veg",
        "ingredients": [
            {"food": "Chicken breast", "amount": 140, "unit": "g", "grocery": "Chicken breast (raw)", "grocery_factor": 1.25, "grocery_unit": "g", "category": "Protein and pulses"},
            {"food": "Cooked white rice", "amount": 160, "unit": "g", "grocery": "Rice (dry)", "grocery_factor": 0.35, "grocery_unit": "g", "category": "Grains and staples"},
            {"food": "Spinach, cooked", "amount": 60, "unit": "g", "grocery": "Fresh spinach", "grocery_factor": 2.5, "grocery_unit": "g", "category": "Vegetables"},
            {"food": "Tomato", "amount": 50, "unit": "g", "grocery": "Tomatoes", "grocery_factor": 1, "grocery_unit": "g", "category": "Vegetables"},
        ],
    },
    {
        "id": "lunch-tofu-rice",
        "name": "Tofu rice bowl",
        "meal_type": "Lunch",
        "diet": "vegan",
        "ingredients": [
            {"food": "Tofu, firm", "amount": 150, "unit": "g", "grocery": "Firm tofu", "grocery_factor": 1, "grocery_unit": "g", "category": "Protein and pulses"},
            {"food": "Cooked white rice", "amount": 160, "unit": "g", "grocery": "Rice (dry)", "grocery_factor": 0.35, "grocery_unit": "g", "category": "Grains and staples"},
            {"food": "Spinach, cooked", "amount": 60, "unit": "g", "grocery": "Fresh spinach", "grocery_factor": 2.5, "grocery_unit": "g", "category": "Vegetables"},
            {"food": "Tomato", "amount": 50, "unit": "g", "grocery": "Tomatoes", "grocery_factor": 1, "grocery_unit": "g", "category": "Vegetables"},
        ],
    },
    {
        "id": "lunch-egg-rice",
        "name": "Egg rice bowl",
        "meal_type": "Lunch",
        "diet": "egg",
        "ingredients": [
            {"food": "Egg", "amount": 2, "unit": "piece", "grocery": "Eggs", "grocery_factor": 1, "grocery_unit": "piece", "category": "Protein and pulses"},
            {"food": "Cooked white rice", "amount": 180, "unit": "g", "grocery": "Rice (dry)", "grocery_factor": 0.35, "grocery_unit": "g", "category": "Grains and staples"},
            {"food": "Tomato", "amount": 60, "unit": "g", "grocery": "Tomatoes", "grocery_factor": 1, "grocery_unit": "g", "category": "Vegetables"},
            {"food": "Cucumber", "amount": 80, "unit": "g", "grocery": "Cucumber", "grocery_factor": 1, "grocery_unit": "g", "category": "Vegetables"},
        ],
    },
    {
        "id": "snack-apple-almonds",
        "name": "Apple and almonds",
        "meal_type": "Snack",
        "diet": "vegan",
        "ingredients": [
            {"food": "Apple", "amount": 150, "unit": "g", "grocery": "Apples", "grocery_factor": 1, "grocery_unit": "g", "category": "Fruit"},
            {"food": "Almonds", "amount": 10, "unit": "g", "grocery": "Almonds", "grocery_factor": 1, "grocery_unit": "g", "category": "Pantry"},
        ],
    },
    {
        "id": "snack-curd-banana",
        "name": "Curd with banana",
        "meal_type": "Snack",
        "diet": "vegetarian",
        "ingredients": [
            {"food": "Curd, plain", "amount": 180, "unit": "g", "grocery": "Plain curd", "grocery_factor": 1, "grocery_unit": "g", "category": "Dairy and alternatives"},
            {"food": "Banana", "amount": 80, "unit": "g", "grocery": "Bananas", "grocery_factor": 1, "grocery_unit": "g", "category": "Fruit"},
        ],
    },
    {
        "id": "snack-yogurt-apple",
        "name": "Greek yogurt with apple",
        "meal_type": "Snack",
        "diet": "vegetarian",
        "ingredients": [
            {"food": "Greek yogurt, plain", "amount": 150, "unit": "g", "grocery": "Plain Greek yogurt", "grocery_factor": 1, "grocery_unit": "g", "category": "Dairy and alternatives"},
            {"food": "Apple", "amount": 100, "unit": "g", "grocery": "Apples", "grocery_factor": 1, "grocery_unit": "g", "category": "Fruit"},
        ],
    },
    {
        "id": "snack-peanut-banana",
        "name": "Banana with peanut butter",
        "meal_type": "Snack",
        "diet": "vegan",
        "ingredients": [
            {"food": "Banana", "amount": 100, "unit": "g", "grocery": "Bananas", "grocery_factor": 1, "grocery_unit": "g", "category": "Fruit"},
            {"food": "Peanut butter", "amount": 15, "unit": "g", "grocery": "Peanut butter", "grocery_factor": 1, "grocery_unit": "g", "category": "Pantry"},
        ],
    },
    {
        "id": "snack-orange-almonds",
        "name": "Orange and almonds",
        "meal_type": "Snack",
        "diet": "vegan",
        "ingredients": [
            {"food": "Orange", "amount": 150, "unit": "g", "grocery": "Oranges", "grocery_factor": 1, "grocery_unit": "g", "category": "Fruit"},
            {"food": "Almonds", "amount": 10, "unit": "g", "grocery": "Almonds", "grocery_factor": 1, "grocery_unit": "g", "category": "Pantry"},
        ],
    },
    {
        "id": "dinner-dal-roti",
        "name": "Dal, roti and spinach",
        "meal_type": "Dinner",
        "diet": "vegan",
        "ingredients": [
            {"food": "Dal", "amount": 1.5, "unit": "katori", "grocery": "Dry dal or lentils", "grocery_factor": 35, "grocery_unit": "g", "category": "Protein and pulses"},
            {"food": "Roti", "amount": 3, "unit": "piece", "grocery": "Whole wheat atta", "grocery_factor": 30, "grocery_unit": "g", "category": "Grains and staples"},
            {"food": "Spinach, cooked", "amount": 70, "unit": "g", "grocery": "Fresh spinach", "grocery_factor": 2.5, "grocery_unit": "g", "category": "Vegetables"},
        ],
    },
    {
        "id": "dinner-chickpea-rice",
        "name": "Chickpea rice with vegetables",
        "meal_type": "Dinner",
        "diet": "vegan",
        "ingredients": [
            {"food": "Chickpeas, cooked", "amount": 150, "unit": "g", "grocery": "Dry chickpeas", "grocery_factor": 0.4, "grocery_unit": "g", "category": "Protein and pulses"},
            {"food": "Cooked white rice", "amount": 120, "unit": "g", "grocery": "Rice (dry)", "grocery_factor": 0.35, "grocery_unit": "g", "category": "Grains and staples"},
            {"food": "Tomato", "amount": 60, "unit": "g", "grocery": "Tomatoes", "grocery_factor": 1, "grocery_unit": "g", "category": "Vegetables"},
            {"food": "Cucumber", "amount": 80, "unit": "g", "grocery": "Cucumber", "grocery_factor": 1, "grocery_unit": "g", "category": "Vegetables"},
        ],
    },
    {
        "id": "dinner-paneer-rice",
        "name": "Paneer rice with spinach",
        "meal_type": "Dinner",
        "diet": "vegetarian",
        "ingredients": [
            {"food": "Paneer", "amount": 90, "unit": "g", "grocery": "Paneer", "grocery_factor": 1, "grocery_unit": "g", "category": "Dairy and alternatives"},
            {"food": "Cooked white rice", "amount": 130, "unit": "g", "grocery": "Rice (dry)", "grocery_factor": 0.35, "grocery_unit": "g", "category": "Grains and staples"},
            {"food": "Spinach, cooked", "amount": 70, "unit": "g", "grocery": "Fresh spinach", "grocery_factor": 2.5, "grocery_unit": "g", "category": "Vegetables"},
            {"food": "Tomato", "amount": 50, "unit": "g", "grocery": "Tomatoes", "grocery_factor": 1, "grocery_unit": "g", "category": "Vegetables"},
        ],
    },
    {
        "id": "dinner-tofu-sweet-potato",
        "name": "Tofu and sweet potato plate",
        "meal_type": "Dinner",
        "diet": "vegan",
        "ingredients": [
            {"food": "Tofu, firm", "amount": 140, "unit": "g", "grocery": "Firm tofu", "grocery_factor": 1, "grocery_unit": "g", "category": "Protein and pulses"},
            {"food": "Sweet potato, boiled", "amount": 180, "unit": "g", "grocery": "Sweet potatoes", "grocery_factor": 1.15, "grocery_unit": "g", "category": "Vegetables"},
            {"food": "Cucumber", "amount": 80, "unit": "g", "grocery": "Cucumber", "grocery_factor": 1, "grocery_unit": "g", "category": "Vegetables"},
        ],
    },
    {
        "id": "dinner-chicken-roti",
        "name": "Chicken roti with greens",
        "meal_type": "Dinner",
        "diet": "non-veg",
        "ingredients": [
            {"food": "Chicken breast", "amount": 120, "unit": "g", "grocery": "Chicken breast (raw)", "grocery_factor": 1.25, "grocery_unit": "g", "category": "Protein and pulses"},
            {"food": "Roti", "amount": 2, "unit": "piece", "grocery": "Whole wheat atta", "grocery_factor": 30, "grocery_unit": "g", "category": "Grains and staples"},
            {"food": "Spinach, cooked", "amount": 60, "unit": "g", "grocery": "Fresh spinach", "grocery_factor": 2.5, "grocery_unit": "g", "category": "Vegetables"},
            {"food": "Tomato", "amount": 50, "unit": "g", "grocery": "Tomatoes", "grocery_factor": 1, "grocery_unit": "g", "category": "Vegetables"},
        ],
    },
    {
        "id": "dinner-idli-sambar",
        "name": "Idli with sambar",
        "meal_type": "Dinner",
        "diet": "vegan",
        "ingredients": [
            {"food": "Idli", "amount": 3, "unit": "piece", "grocery": "Idli or dosa batter", "grocery_factor": 40, "grocery_unit": "g", "category": "Grains and staples"},
            {"food": "Sambar", "amount": 2, "unit": "katori", "grocery": "Sambar ingredients", "grocery_factor": 50, "grocery_unit": "g", "category": "Grains and staples"},
            {"food": "Cucumber", "amount": 80, "unit": "g", "grocery": "Cucumber", "grocery_factor": 1, "grocery_unit": "g", "category": "Vegetables"},
        ],
    },
]

_UNIT_ALIASES = {
    "grams": "g", "gram": "g", "grm": "g", "gm": "g",
    "kilogram": "kg", "kilograms": "kg", "mls": "ml",
    "pieces": "piece", "medium": "piece", "small": "piece", "large": "piece",
    "katoris": "katori", "servings": "serving",
}
_MEAL_TIMES = {"Breakfast": "08:00", "Lunch": "13:00", "Snack": "16:30", "Dinner": "20:00"}


def required_food_names():
    return sorted({ingredient["food"] for recipe in RECIPES for ingredient in recipe["ingredients"]})


def _normalize_unit(unit):
    value = (unit or "").strip().lower()
    return _UNIT_ALIASES.get(value, value)


def _basis(item):
    match = re.match(r"^\s*(\d+(?:\.\d+)?)\s*([a-zA-Z]+)\s*$", item.serving_size or "")
    if not match:
        return None
    return float(match.group(1)), _normalize_unit(match.group(2))


def _ingredient_multiplier(item, amount, unit):
    basis = _basis(item)
    if not basis:
        raise ValueError(f"Unsupported catalog serving for {item.name}: {item.serving_size}")
    basis_amount, basis_unit = basis
    ingredient_unit = _normalize_unit(unit)
    if ingredient_unit == basis_unit:
        return amount / basis_amount
    if ingredient_unit == "kg" and basis_unit == "g":
        return amount * 1000 / basis_amount
    if ingredient_unit == "g" and basis_unit == "kg":
        return amount / 1000 / basis_amount
    if ingredient_unit == "l" and basis_unit == "ml":
        return amount * 1000 / basis_amount
    if ingredient_unit == "ml" and basis_unit == "l":
        return amount / 1000 / basis_amount
    raise ValueError(f"Cannot scale {item.name} from {item.serving_size} to {amount:g} {unit}.")


def _nutrition_totals(ingredients):
    fields = ("calories", "protein", "carbs", "fats", "fiber")
    return {field: round(sum(item["nutrition"][field] for item in ingredients), 1) for field in fields}


def _allowed(recipe, diet_type):
    if diet_type == "vegan":
        return recipe["diet"] == "vegan"
    if diet_type == "veg":
        return recipe["diet"] in {"vegan", "vegetarian"}
    if diet_type == "eggetarian":
        return recipe["diet"] in {"vegan", "vegetarian", "egg"}
    return recipe["diet"] in {"vegan", "vegetarian", "egg", "non-veg"}


def _recipe_base(recipe, foods):
    entries = []
    for ingredient in recipe["ingredients"]:
        food = foods.get(ingredient["food"])
        if not food:
            raise ValueError(f"Food catalog is missing {ingredient['food']}.")
        multiplier = _ingredient_multiplier(food, ingredient["amount"], ingredient["unit"])
        entries.append({
            "food_item_id": food.id,
            "name": food.name,
            "amount": float(ingredient["amount"]),
            "unit": ingredient["unit"],
            "grocery_name": ingredient["grocery"],
            "grocery_factor": float(ingredient["grocery_factor"]),
            "grocery_unit": ingredient["grocery_unit"],
            "category": ingredient["category"],
            "nutrition": {
                "calories": float(food.calories or 0) * multiplier,
                "protein": float(food.protein or 0) * multiplier,
                "carbs": float(food.carbs or 0) * multiplier,
                "fats": float(food.fats or 0) * multiplier,
                "fiber": float(food.fiber or 0) * multiplier,
            },
        })
    return entries


def _make_meal(recipe, foods, target_calories, meal_time):
    base_entries = _recipe_base(recipe, foods)
    base_totals = _nutrition_totals(base_entries)
    factor = max(0.65, min(1.8, target_calories / max(base_totals["calories"], 1)))
    factor = round(factor, 2)
    ingredients = []
    for entry in base_entries:
        ingredients.append({
            "food_item_id": entry["food_item_id"],
            "name": entry["name"],
            "amount": round(entry["amount"] * factor, 1),
            "unit": entry["unit"],
            "nutrition": {key: round(value * factor, 1) for key, value in entry["nutrition"].items()},
            "grocery_name": entry["grocery_name"],
            "grocery_amount": round(entry["amount"] * entry["grocery_factor"] * factor, 1),
            "grocery_unit": entry["grocery_unit"],
            "category": entry["category"],
        })
    return {
        "meal_type": recipe["meal_type"],
        "time": meal_time,
        "recipe_id": recipe["id"],
        "name": recipe["name"],
        "diet": recipe["diet"],
        "target_calories": round(target_calories),
        "portion_factor": factor,
        "nutrition": _nutrition_totals(ingredients),
        "ingredients": ingredients,
        "swap_options": [],
        "logged": False,
        "log_id": None,
    }


def _refresh_day_totals(day):
    day["totals"] = _nutrition_totals([{
        "nutrition": meal["nutrition"]
    } for meal in day["meals"]])


def _build_grocery_list(plan):
    grouped = {}
    for day in plan["days"]:
        for meal in day["meals"]:
            for ingredient in meal["ingredients"]:
                key = (ingredient["grocery_name"], ingredient["grocery_unit"])
                item = grouped.setdefault(key, {
                    "name": ingredient["grocery_name"],
                    "amount": 0.0,
                    "unit": ingredient["grocery_unit"],
                    "category": ingredient["category"],
                })
                item["amount"] += ingredient["grocery_amount"]
    result = []
    for item in grouped.values():
        amount = item["amount"]
        if item["unit"] == "piece":
            amount = math.ceil(amount)
        else:
            amount = round(amount, 1)
        result.append({**item, "amount": amount})
    return sorted(result, key=lambda item: (item["category"], item["name"]))


def _meal_options(meal_type, diet_type):
    return [
        {"id": recipe["id"], "name": recipe["name"]}
        for recipe in RECIPES
        if recipe["meal_type"] == meal_type and _allowed(recipe, diet_type)
    ]


def generate_weekly_plan(profile, food_items, start_date: date):
    foods = {item.name: item for item in food_items}
    missing = sorted(set(required_food_names()) - set(foods))
    if missing:
        raise ValueError("The local food catalog is missing planner ingredients: " + ", ".join(missing))

    diet_type = profile.diet_type or "non-veg"
    target_calories = round(profile.calorie_target or profile.maintenance_calories or 0)
    if target_calories <= 0:
        raise ValueError("Save a calorie target in Profile before creating a meal plan.")
    recipes = [recipe for recipe in RECIPES if _allowed(recipe, diet_type)]
    meal_times = {
        "Breakfast": str(profile.breakfast_time or _MEAL_TIMES["Breakfast"])[:5],
        "Lunch": str(profile.lunch_time or _MEAL_TIMES["Lunch"])[:5],
        "Snack": str(profile.snack_time or _MEAL_TIMES["Snack"])[:5],
        "Dinner": str(profile.dinner_time or _MEAL_TIMES["Dinner"])[:5],
    }

    plan = {
        "version": 1,
        "timezone": profile.routine_timezone or "Asia/Kolkata",
        "start_date": start_date.isoformat(),
        "end_date": (start_date + timedelta(days=6)).isoformat(),
        "diet_type": diet_type,
        "goal": profile.goal or "maintain",
        "daily_target_calories": target_calories,
        "meal_times": meal_times,
        "days": [],
        "grocery_list": [],
    }
    for day_index in range(7):
        plan_date = start_date + timedelta(days=day_index)
        meals = []
        for meal_index, meal_type in enumerate(MEAL_SHARES):
            choices = [recipe for recipe in recipes if recipe["meal_type"] == meal_type]
            if not choices:
                raise ValueError(f"No {meal_type.lower()} recipes are available for the {diet_type} preference.")
            recipe = choices[(day_index + meal_index * 2) % len(choices)]
            meal_target = target_calories * MEAL_SHARES[meal_type]
            meal = _make_meal(recipe, foods, meal_target, meal_times[meal_type])
            meal["swap_options"] = _meal_options(meal_type, diet_type)
            meals.append(meal)
        day = {
            "date": plan_date.isoformat(),
            "day": plan_date.strftime("%A"),
            "target_calories": target_calories,
            "meals": meals,
        }
        _refresh_day_totals(day)
        plan["days"].append(day)
    plan["grocery_list"] = _build_grocery_list(plan)
    return plan


def preserve_logged_meals(plan, previous_plan):
    """Keep meals already logged when the user regenerates an overlapping week."""
    updated = deepcopy(plan)
    logged = {
        (day["date"], meal["meal_type"]): meal
        for day in previous_plan.get("days", [])
        for meal in day.get("meals", [])
        if meal.get("logged")
    }
    for day in updated["days"]:
        for index, meal in enumerate(day["meals"]):
            previous = logged.get((day["date"], meal["meal_type"]))
            if previous:
                day["meals"][index] = deepcopy(previous)
        _refresh_day_totals(day)
    updated["grocery_list"] = _build_grocery_list(updated)
    return updated


def swap_planned_meal(plan_data, meal_date, meal_type, recipe_id, food_items):
    plan = deepcopy(plan_data)
    day = next((item for item in plan["days"] if item["date"] == meal_date), None)
    if not day:
        raise ValueError("That date is not part of the saved meal plan.")
    meal = next((item for item in day["meals"] if item["meal_type"] == meal_type), None)
    if not meal:
        raise ValueError("That meal is not part of the saved plan.")
    if meal["logged"]:
        raise ValueError("A meal already added to your log cannot be swapped.")

    recipe = next((item for item in RECIPES if item["id"] == recipe_id), None)
    if not recipe or recipe["meal_type"] != meal_type or not _allowed(recipe, plan["diet_type"]):
        raise ValueError("Choose a meal option that matches your saved diet preference.")
    foods = {item.name: item for item in food_items}
    replacement = _make_meal(recipe, foods, meal["target_calories"], meal["time"])
    replacement["swap_options"] = _meal_options(meal_type, plan["diet_type"])
    index = day["meals"].index(meal)
    day["meals"][index] = replacement
    _refresh_day_totals(day)
    plan["grocery_list"] = _build_grocery_list(plan)
    return plan


def adjust_planned_meal_portion(plan_data, meal_date, meal_type, portion_factor):
    if portion_factor < 0.5 or portion_factor > 2.5:
        raise ValueError("Portion size must be between 0.5× and 2.5×.")
    plan = deepcopy(plan_data)
    day = next((item for item in plan["days"] if item["date"] == meal_date), None)
    if not day:
        raise ValueError("That date is not part of the saved meal plan.")
    meal = next((item for item in day["meals"] if item["meal_type"] == meal_type), None)
    if not meal:
        raise ValueError("That meal is not part of the saved plan.")
    if meal["logged"]:
        raise ValueError("A meal already added to your log cannot be resized.")

    current_factor = meal["portion_factor"]
    ratio = portion_factor / current_factor
    for ingredient in meal["ingredients"]:
        ingredient["amount"] = round(ingredient["amount"] * ratio, 1)
        ingredient["grocery_amount"] = round(ingredient["grocery_amount"] * ratio, 1)
        ingredient["nutrition"] = {
            key: round(value * ratio, 1)
            for key, value in ingredient["nutrition"].items()
        }
    meal["portion_factor"] = round(portion_factor, 2)
    meal["nutrition"] = _nutrition_totals(meal["ingredients"])
    _refresh_day_totals(day)
    plan["grocery_list"] = _build_grocery_list(plan)
    return plan
