"""Regression checks for the core LocalHealth Pro API flows."""

import unittest
import csv
from datetime import datetime
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.database import get_db
from backend.app.main import CORSAwareFastAPI, app
from backend.app.models.models import Base
from backend.import_usda_foundation import load_foundation_rows


class CoreApiRegressionTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.TestSession = sessionmaker(
            autocommit=False, autoflush=False, bind=self.engine
        )
        Base.metadata.create_all(bind=self.engine)

        def override_get_db():
            db = self.TestSession()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=self.engine)
        self.engine.dispose()

    def test_health_endpoint_reports_online(self):
        response = self.client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")

    def test_cors_header_is_preserved_on_backend_errors(self):
        error_app = CORSAwareFastAPI(
            title="CORS error test", cors_allowed_origins=["http://localhost:5173"]
        )

        @error_app.get("/raises")
        def raise_error():
            raise RuntimeError("test error")

        client = TestClient(error_app, raise_server_exceptions=False)
        response = client.get("/raises", headers={"Origin": "http://localhost:5173"})
        client.close()

        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.headers.get("access-control-allow-origin"), "http://localhost:5173")

    def test_nutrition_requires_complete_reviewable_values(self):
        response = self.client.post(
            "/logs", json={"category": "nutrition", "note": "100 g apple"}
        )

        self.assertEqual(response.status_code, 422)

    def test_food_draft_understands_joined_100g_apple_quantity(self):
        from backend.app.models.models import FoodItem

        db = self.TestSession()
        db.add(FoodItem(name="Apple", calories=52, protein=0.3, carbs=14,
                        fats=0.2, fiber=2.4, serving_size="100g"))
        db.commit()
        db.close()

        response = self.client.post("/ai/food-draft", json={"text": "one 100gmapple"})

        self.assertEqual(response.status_code, 200)
        draft = response.json()
        self.assertEqual(draft["status"], "ready")
        self.assertEqual(draft["calories"], 52)
        self.assertIn("100 g Apple", draft["food_description"])

    def test_confirmed_corrected_food_description_replaces_the_typo_context(self):
        from backend.app.models.models import FoodItem

        db = self.TestSession()
        db.add(FoodItem(name="Apple", calories=52, protein=0.3, carbs=14,
                        fats=0.2, fiber=2.4, serving_size="100g"))
        db.commit()
        db.close()

        response = self.client.post("/ai/food-draft", json={
            "text": "yes, one 100 gm apple",
            "context": "one 100gmapple",
            "clarification_type": "confirm_food",
            "previous_question": "Did you mean one apple weighing 100 g?",
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ready")
        self.assertEqual(response.json()["calories"], 52)

    def test_no_more_food_answer_is_passed_to_ai_as_resolved_context(self):
        ready_result = {
            "status": "ready", "question": "", "items": [
                {"food_description": "one mini gongura biryani", "calories": 360,
                 "protein": 10, "carbs": 52, "fats": 11, "fiber": 4,
                 "source": "AI-estimated"}
            ], "corrections": [],
        }
        with patch("backend.app.main.ai_engine.create_food_draft", new_callable=AsyncMock) as create_draft:
            create_draft.return_value = ready_result
            response = self.client.post("/ai/food-draft", json={
                "text": "not yet anything",
                "context": "one mini gongura biryani with bread halwa and badam milk",
                "clarification_type": "more_foods",
                "previous_question": "What else have you eaten?",
            })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ready")
        create_draft.assert_awaited_once_with(
            "one mini gongura biryani with bread halwa and badam milk",
            clarification_resolution="no_more_food",
        )

    def test_yes_confirmation_is_passed_to_ai_without_the_yes_as_food_text(self):
        ready_result = {
            "status": "ready", "question": "", "items": [
                {"food_description": "100 g apple", "calories": 52,
                 "protein": 0.3, "carbs": 14, "fats": 0.2, "fiber": 2.4,
                 "source": "AI-estimated"}
            ], "corrections": [],
        }
        with patch("backend.app.main.ai_engine.create_food_draft", new_callable=AsyncMock) as create_draft:
            create_draft.return_value = ready_result
            response = self.client.post("/ai/food-draft", json={
                "text": "yes",
                "context": "one 100gmapple",
                "clarification_type": "confirm_food",
                "previous_question": "Did you mean one apple weighing 100 g?",
            })

        self.assertEqual(response.status_code, 200)
        create_draft.assert_awaited_once_with(
            "one 100 gm apple",
            clarification_resolution="confirmed_food",
        )

    def test_repeated_ai_question_is_replaced_with_a_specific_portion_question(self):
        repeated_question = "Could you please specify what you mean by 'one 100gmapple'? Are you referring to one apple that weighs 100g?"
        with patch("backend.app.main.ai_engine.create_food_draft", new_callable=AsyncMock) as create_draft:
            create_draft.return_value = {
                "status": "clarification", "question": repeated_question,
                "items": [], "corrections": [],
            }
            response = self.client.post("/ai/food-draft", json={
                "text": "yes",
                "context": "one 100gmapple",
                "clarification_type": "confirm_food",
                "previous_question": repeated_question,
            })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "clarification")
        self.assertNotEqual(response.json()["question"], repeated_question)
        self.assertIn("portion", response.json()["question"])

    def test_food_search_resolves_common_indian_aliases(self):
        from backend.app.models.models import FoodItem

        db = self.TestSession()
        db.add(FoodItem(name="Roti", calories=85, protein=3, carbs=18, fats=0.5,
                        fiber=2.7, serving_size="1 piece"))
        db.commit()
        db.close()

        response = self.client.get("/search-food", params={"q": "chapati"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual([food["name"] for food in response.json()], ["Roti"])

    def test_food_can_be_favorited_and_unfavorited(self):
        from backend.app.models.models import FoodItem

        db = self.TestSession()
        food = FoodItem(name="Banana", calories=89, protein=1.1, carbs=23,
                        fats=0.3, fiber=2.6, serving_size="100g")
        db.add(food)
        db.commit()
        food_id = food.id
        db.close()

        saved = self.client.put(f"/foods/{food_id}/favorite")
        repeated = self.client.put(f"/foods/{food_id}/favorite")
        favorites = self.client.get("/foods/favorites")
        removed = self.client.delete(f"/foods/{food_id}/favorite")
        empty = self.client.get("/foods/favorites")

        self.assertEqual(saved.json()["is_favorite"], True)
        self.assertEqual(repeated.status_code, 200)
        self.assertEqual([item["id"] for item in favorites.json()], [food_id])
        self.assertEqual(removed.json()["is_favorite"], False)
        self.assertEqual(empty.json(), [])

    def test_recent_catalog_foods_derive_from_linked_food_logs(self):
        from backend.app.models.models import FoodItem

        db = self.TestSession()
        food = FoodItem(name="Idli", calories=58, protein=2, carbs=12,
                        fats=0.2, fiber=0.8, serving_size="1 piece")
        db.add(food)
        db.commit()
        food_id = food.id
        db.close()

        logged = self.client.post("/logs", json={
            "category": "nutrition", "note": "2 × Idli (1 piece)",
            "source": "database", "food_item_id": food_id,
            "calories": 116, "protein": 4, "carbs": 24, "fats": 0.4, "fiber": 1.6,
        })
        recent = self.client.get("/foods/recent")

        self.assertEqual(logged.status_code, 200)
        self.assertEqual([item["id"] for item in recent.json()], [food_id])

    def test_usda_parser_imports_only_foundation_foods_with_complete_core_values(self):
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            with (root / "food.csv").open("w", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=["fdc_id", "data_type", "description"])
                writer.writeheader()
                writer.writerows([
                    {"fdc_id": "100", "data_type": "Foundation", "description": "Apple, raw"},
                    {"fdc_id": "200", "data_type": "Branded", "description": "Brand cereal"},
                ])
            with (root / "food_nutrient.csv").open("w", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=["fdc_id", "nutrient_id", "amount"])
                writer.writeheader()
                writer.writerows([
                    {"fdc_id": "100", "nutrient_id": "1008", "amount": "52"},
                    {"fdc_id": "100", "nutrient_id": "1003", "amount": "0.3"},
                    {"fdc_id": "100", "nutrient_id": "1005", "amount": "14"},
                    {"fdc_id": "100", "nutrient_id": "1004", "amount": "0.2"},
                    {"fdc_id": "100", "nutrient_id": "1079", "amount": "2.4"},
                    {"fdc_id": "200", "nutrient_id": "1008", "amount": "400"},
                ])

            rows, skipped = load_foundation_rows(root)

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0][0:2], ("100", "Apple, raw"))
        self.assertEqual(rows[0][2]["fiber"], 2.4)
        self.assertEqual(skipped, 0)

    def test_workout_templates_and_equipment_filtered_exercise_library(self):
        templates = self.client.get("/workouts/templates", params={"equipment": "Dumbbells"})
        exercises = self.client.get("/exercises", params={"equipment": "Dumbbells"})

        self.assertEqual(templates.status_code, 200)
        self.assertEqual([item["workout_name"] for item in templates.json()], ["Dumbbell Full Body"])
        self.assertTrue(exercises.json())
        self.assertTrue(all(item["equipment"] == "Dumbbells" for item in exercises.json()))

    def test_completed_workout_sets_are_saved_and_returned_in_history(self):
        from backend.app.models.models import Exercise

        db = self.TestSession()
        exercise = Exercise(
            name="Goblet Squat", muscle_group="Legs", equipment="Dumbbells",
            difficulty="Beginner", instructions="Hold weight close and squat under control.",
            common_mistakes="Rushing the movement.",
        )
        db.add(exercise)
        db.commit()
        exercise_id = exercise.id
        db.close()

        saved = self.client.post("/workouts/log", json={
            "workout_type": "Dumbbell session", "duration_mins": 32,
            "sets": [{"exercise_id": exercise_id, "set_number": 1, "reps": 10, "weight": 12.5, "rpe": 7}],
        })
        history = self.client.get("/workouts/sessions")

        self.assertEqual(saved.status_code, 200)
        self.assertEqual(history.status_code, 200)
        self.assertEqual(history.json()[0]["sets"][0]["exercise_name"], "Goblet Squat")
        self.assertEqual(history.json()[0]["sets"][0]["weight"], 12.5)

    def test_profile_calculates_targets_and_returns_ist_week_plan(self):
        saved = self.client.post("/profile", json={
            "age": 30, "sex": "male", "height": 175, "weight": 80,
            "activity_level": "sedentary", "diet_type": "veg", "goal": "lose",
            "target_weight_kg": 72, "work_start_time": "09:15", "work_end_time": "18:15",
            "breakfast_time": "08:10", "lunch_time": "12:45", "snack_time": "16:30",
            "dinner_time": "20:15",
        })
        self.assertEqual(saved.status_code, 200)
        profile = saved.json()
        self.assertEqual(profile["routine_timezone"], "Asia/Kolkata")
        self.assertEqual(profile["bmr"], 1749)
        self.assertEqual(profile["maintenance_calories"], 2099)
        self.assertEqual(profile["calorie_target"], 1784)
        self.assertEqual(profile["daily_deficit"], 315)
        self.assertEqual(profile["weight_to_goal_kg"], 8)
        self.assertEqual(profile["lunch_time"], "12:45:00")

        plan = self.client.get("/profile/weekly-plan")
        self.assertEqual(plan.status_code, 200)
        self.assertEqual(plan.json()["timezone"], "Asia/Kolkata")
        self.assertEqual(len(plan.json()["days"]), 7)
        self.assertTrue(all(day["calories"] == 1784 for day in plan.json()["days"]))
        self.assertEqual(plan.json()["activity_summary"]["aerobic_minutes"], 100)
        self.assertEqual(plan.json()["work_schedule"], {"start": "09:15", "end": "18:15"})
        self.assertTrue(any(item == {"meal": "Lunch", "time": "12:45"} for item in plan.json()["meal_schedule"]))

        weigh_in = self.client.post("/tracking/weight", json={"weight_kg": 74})
        refreshed_profile = self.client.get("/profile").json()
        self.assertEqual(weigh_in.status_code, 200)
        self.assertEqual(refreshed_profile["weight"], 74)
        self.assertEqual(refreshed_profile["weight_to_goal_kg"], 2)

    def test_profile_requires_weight_loss_target_below_current_weight(self):
        payload = {
            "age": 30, "sex": "female", "height": 165, "weight": 65,
            "activity_level": "light", "diet_type": "veg", "goal": "lose",
            "target_weight_kg": 65,
        }
        response = self.client.post("/profile", json=payload)

        self.assertEqual(response.status_code, 422)

    def test_insights_aggregate_recent_logs_in_ist(self):
        profile = self.client.post("/profile", json={
            "age": 30, "sex": "male", "height": 175, "weight": 80,
            "activity_level": "sedentary", "diet_type": "veg", "goal": "lose",
            "target_weight_kg": 72,
        })
        logged = self.client.post("/logs", json={
            "category": "nutrition", "note": "Lunch", "meal": "Lunch",
            "source": "user-edited", "calories": 1700, "protein": 90,
            "carbs": 180, "fats": 50, "fiber": 20,
        })
        water = self.client.post("/tracking/water", json={"amount_ml": 400})

        insights = self.client.get("/insights", params={"days": 7})
        payload = insights.json()

        self.assertEqual(profile.status_code, 200)
        self.assertEqual(logged.status_code, 200)
        self.assertEqual(water.status_code, 200)
        self.assertEqual(insights.status_code, 200)
        self.assertEqual(payload["timezone"], "Asia/Kolkata")
        self.assertEqual(len(payload["daily"]), 7)
        self.assertEqual(payload["summary"]["logged_days"], 1)
        self.assertEqual(payload["summary"]["average_calories"], 1700)
        self.assertEqual(payload["summary"]["goal_days"], 1)
        self.assertEqual(payload["summary"]["average_water_ml"], 400)

    def test_nutrition_log_updates_daily_summary_and_can_be_deleted(self):
        payload = {
            "category": "nutrition",
            "note": "100 g apple",
            "meal": "Snack",
            "source": "AI-estimated",
            "calories": 52,
            "protein": 0.3,
            "carbs": 14,
            "fats": 0.2,
            "fiber": 2.4,
        }
        created = self.client.post("/logs", json=payload)
        self.assertEqual(created.status_code, 200)
        log_id = created.json()["id"]

        utc_today = datetime.utcnow().date().isoformat()
        summary = self.client.get("/summary", params={"date_filter": utc_today})
        self.assertEqual(summary.status_code, 200)
        self.assertEqual(summary.json()["total_calories"], 52)
        self.assertEqual(summary.json()["by_meal"]["Snack"]["fiber"], 2.4)

        deleted = self.client.delete(f"/logs/{log_id}")
        self.assertEqual(deleted.status_code, 200)
        self.assertEqual(deleted.json(), {"status": "deleted", "id": log_id})
        missing = self.client.delete(f"/logs/{log_id}")
        self.assertEqual(missing.status_code, 404)

    def test_water_and_weight_entries_appear_in_daily_tracking(self):
        water = self.client.post("/tracking/water", json={"amount_ml": 350})
        weight = self.client.post("/tracking/weight", json={"weight_kg": 68.5})

        self.assertEqual(water.status_code, 200)
        self.assertEqual(weight.status_code, 200)

        daily = self.client.get(
            "/tracking/daily", params={"date_filter": datetime.utcnow().date().isoformat()}
        )
        self.assertEqual(daily.status_code, 200)
        self.assertEqual(daily.json()["water_total_ml"], 350)
        self.assertEqual(daily.json()["latest_weight_kg"], 68.5)


if __name__ == "__main__":
    unittest.main()
