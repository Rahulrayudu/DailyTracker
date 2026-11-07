try:
    from .app.database import SessionLocal, init_db
    from .app.models.models import FoodItem
except ImportError:  # Allows running this script from inside backend/ as well.
    from app.database import SessionLocal, init_db
    from app.models.models import FoodItem

def seed_nutrition_db(initialize_schema=True):
    if initialize_schema:
        init_db()
    db = SessionLocal()
    
    # Standard reference estimates per serving shown; values remain editable in the app.
    # Format: (name, calories, protein, carbs, fats, fiber, serving)
    foods = [
        ("Roti", 85, 3, 18, 0.5, 2.7, "1 piece"),
        ("Dal", 116, 9, 20, 0.5, 8, "1 katori"),
        ("Cooked white rice", 130, 2.7, 28, 0.3, 0.4, "100g"),
        ("Cooked brown rice", 123, 2.7, 25.6, 1, 1.6, "100g"),
        ("Chicken breast", 165, 31, 0, 3.6, 0, "100g"),
        ("Egg", 78, 6, 0.6, 5, 0, "1 piece"),
        ("Banana", 89, 1.1, 23, 0.3, 2.6, "100g"),
        ("Apple", 52, 0.3, 14, 0.2, 2.4, "100g"),
        ("Paneer", 265, 18, 4, 20, 0, "100g"),
        ("Milk", 42, 3.4, 5, 1, 0, "100ml"),
        ("Almonds", 579, 21, 22, 50, 12.5, "100g"),
        ("Oats, dry", 389, 16.9, 66.3, 6.9, 10.6, "100g"),
        ("Greek yogurt, plain", 97, 9, 3.9, 5, 0, "100g"),
        ("Curd, plain", 61, 3.5, 4.7, 3.3, 0, "100g"),
        ("Orange", 47, 0.9, 11.8, 0.1, 2.4, "100g"),
        ("Avocado", 160, 2, 8.5, 14.7, 6.7, "100g"),
        ("Sweet potato, boiled", 76, 1.4, 17.7, 0.1, 2.5, "100g"),
        ("Potato, boiled", 87, 1.9, 20.1, 0.1, 1.8, "100g"),
        ("Tofu, firm", 144, 17.3, 2.8, 8.7, 2.3, "100g"),
        ("Chickpeas, cooked", 164, 8.9, 27.4, 2.6, 7.6, "100g"),
        ("Peanut butter", 588, 25, 20, 50, 6, "100g"),
        ("Idli", 58, 2, 12, 0.2, 0.8, "1 piece"),
        ("Dosa", 168, 4, 29, 3, 1.5, "1 medium"),
        ("Sambar", 75, 4, 12, 1.5, 3, "1 katori"),
        ("Upma", 132, 3, 22, 3.5, 2, "100g"),
        ("Poha", 130, 2.5, 25, 2.5, 1.5, "100g"),
        ("Spinach, cooked", 23, 3, 3.8, 0.3, 2.4, "100g"),
        ("Tomato", 18, 0.9, 3.9, 0.2, 1.2, "100g"),
        ("Cucumber", 15, 0.7, 3.6, 0.1, 0.5, "100g"),
    ]

    try:
        for name, calories, protein, carbs, fats, fiber, serving in foods:
            item = db.query(FoodItem).filter(FoodItem.name == name).first()
            if item is None:
                db.add(FoodItem(name=name, calories=calories, protein=protein, carbs=carbs,
                                fats=fats, fiber=fiber, serving_size=serving))
            else:
                item.calories, item.protein, item.carbs, item.fats = calories, protein, carbs, fats
                item.fiber, item.serving_size = fiber, serving
        db.commit()
    finally:
        db.close()
    print("✅ Nutrition database seeded successfully!")

if __name__ == "__main__":
    seed_nutrition_db()
