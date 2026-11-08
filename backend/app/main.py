import os
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import httpx
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, model_validator
from typing import Literal, Optional
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo
from math import floor
from .database import get_db, init_db
from .models.models import Profile, HealthLog, FoodItem, FoodFavorite, Exercise, WorkoutSession, WorkoutSet, WaterLog, WeightLog
from .ai_engine import ai_engine
from .workout_service import workout_service
from ..seed_db import seed_nutrition_db
import uvicorn

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    seed_nutrition_db(initialize_schema=False)
    yield

app = FastAPI(title="LocalHealth Pro", lifespan=lifespan)

cors_origins = [origin.strip() for origin in os.getenv(
    "LOCALHEALTH_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Search aliases map familiar regional names to the catalog's canonical entry.
# They affect discovery only; the item's serving and nutrition remain visible
# for review before anything is logged.
FOOD_SEARCH_ALIASES = {
    "Roti": ("chapati", "chapathi", "phulka", "fulka"),
    "Dal": ("daal", "lentils", "pappu", "parippu"),
    "Cooked white rice": ("chawal", "cooked rice", "white rice"),
    "Cooked brown rice": ("brown rice",),
    "Chicken breast": ("chicken",),
    "Egg": ("eggs", "anda", "andaa"),
    "Banana": ("kela", "kele"),
    "Apple": ("seb", "saib"),
    "Paneer": ("cottage cheese",),
    "Milk": ("doodh", "dudh"),
    "Almonds": ("almond", "badam"),
    "Curd, plain": ("dahi", "curd", "plain yogurt", "yoghurt"),
    "Greek yogurt, plain": ("greek yoghurt",),
    "Chickpeas, cooked": ("chickpea", "garbanzo", "chana"),
    "Idli": ("idly", "idlis"),
    "Dosa": ("dosai", "dosas"),
    "Sambar": ("sambhar",),
    "Upma": ("uppittu",),
    "Poha": ("flattened rice", "aval", "atukulu"),
}

class ProfileUpdate(BaseModel):
    age: int = Field(ge=18, le=100)
    sex: Literal["male", "female"]
    height: float = Field(gt=100, le=250)
    weight: float = Field(ge=30, le=350)
    activity_level: Literal["sedentary", "light", "moderate", "active", "very_active"]
    diet_type: Literal["veg", "eggetarian", "non-veg", "vegan"] = "non-veg"
    goal: Literal["lose", "maintain", "gain"]
    target_weight_kg: Optional[float] = Field(default=None, ge=20, le=350)
    routine_timezone: Literal["Asia/Kolkata"] = "Asia/Kolkata"
    wake_time: time = time(6, 30)
    work_start_time: time = time(9, 0)
    work_end_time: time = time(18, 0)
    breakfast_time: time = time(8, 0)
    lunch_time: time = time(13, 0)
    snack_time: time = time(16, 30)
    dinner_time: time = time(20, 0)
    sleep_time: time = time(22, 30)

    @model_validator(mode="after")
    def validate_goal_weight(self):
        if self.goal == "lose":
            if self.target_weight_kg is None:
                raise ValueError("Set a target weight to calculate a weight-loss plan.")
            if self.target_weight_kg >= self.weight:
                raise ValueError("Weight-loss target must be lower than current weight.")
        if self.goal == "gain" and self.target_weight_kg is not None and self.target_weight_kg <= self.weight:
            raise ValueError("Muscle-gain target must be higher than current weight.")
        return self

class LogCreate(BaseModel):
    category: str
    value: Optional[float] = None
    note: Optional[str] = None
    calories: Optional[float] = Field(default=None, ge=0)
    protein: Optional[float] = Field(default=None, ge=0)
    carbs: Optional[float] = Field(default=None, ge=0)
    fats: Optional[float] = Field(default=None, ge=0)
    fiber: Optional[float] = Field(default=None, ge=0)
    source: Optional[str] = None
    meal: Optional[str] = None
    food_item_id: Optional[int] = Field(default=None, gt=0)

class FoodDraftRequest(BaseModel):
    text: str

class WaterCreate(BaseModel):
    amount_ml: int = Field(gt=0, le=5000)

class WeightCreate(BaseModel):
    weight_kg: float = Field(gt=0, le=700)

class WorkoutSetCreate(BaseModel):
    exercise_id: int = Field(gt=0)
    set_number: int = Field(ge=1, le=50)
    weight: Optional[float] = Field(default=None, ge=0, le=2000)
    reps: int = Field(ge=0, le=1000)
    rpe: Optional[int] = Field(default=None, ge=1, le=10)

class WorkoutLogCreate(BaseModel):
    workout_type: str = Field(min_length=1, max_length=120)
    duration_mins: int = Field(ge=1, le=1000)
    calories: Optional[float] = Field(default=None, ge=0, le=10000)
    note: Optional[str] = Field(default=None, max_length=2000)
    sets: list[WorkoutSetCreate] = Field(default_factory=list, max_length=300)

class WorkoutPlanRequest(BaseModel):
    equipment: str = "Home"
    duration: int = Field(default=45, ge=10, le=180)

@app.get("/")
def read_root(): return {"status": "Online"}

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "LocalHealth Pro"}


def calculate_profile_targets(data: ProfileUpdate):
    """Return transparent, general-purpose estimates for an adult profile."""
    sex_adjustment = 5 if data.sex == "male" else -161
    bmr = (10 * data.weight) + (6.25 * data.height) - (5 * data.age) + sex_adjustment
    activity_multipliers = {
        "sedentary": 1.2,
        "light": 1.375,
        "moderate": 1.55,
        "active": 1.725,
        "very_active": 1.9,
    }
    maintenance = bmr * activity_multipliers[data.activity_level]
    if data.goal == "lose":
        # A modest starting estimate, capped at 500 kcal/day; adjust from trends.
        daily_deficit = min(500, maintenance * 0.15)
        calorie_target = maintenance - daily_deficit
    elif data.goal == "gain":
        calorie_target = maintenance + min(250, maintenance * 0.10)
    else:
        calorie_target = maintenance

    bmi = data.weight / ((data.height / 100) ** 2)
    nearest_int = lambda value: floor(value + 0.5)
    calorie_target = nearest_int(calorie_target)
    return {
        "bmr": nearest_int(bmr),
        "maintenance_calories": nearest_int(maintenance),
        "calorie_target": calorie_target,
        "daily_deficit": nearest_int(max(0, maintenance - calorie_target)),
        "bmi": round(bmi, 1),
        # General calorie-share estimates; the user can treat these as starting points.
        "protein_target": round(calorie_target * 0.25 / 4, 1),
        "carb_target": round(calorie_target * 0.45 / 4, 1),
        "fat_target": round(calorie_target * 0.30 / 9, 1),
        "weight_to_goal_kg": (
            round(max(0, data.weight - data.target_weight_kg), 1)
            if data.target_weight_kg is not None and data.goal == "lose"
            else None
        ),
    }


def profile_response(profile: Profile):
    if not profile:
        return None
    response = {column.name: getattr(profile, column.name) for column in Profile.__table__.columns}
    if profile.age and profile.height and profile.weight:
        calculation_input = ProfileUpdate.model_construct(
            age=profile.age,
            sex=profile.sex if profile.sex in {"male", "female"} else "male",
            height=profile.height,
            weight=profile.weight,
            activity_level=profile.activity_level if profile.activity_level in {
                "sedentary", "light", "moderate", "active", "very_active"
            } else "sedentary",
            diet_type=profile.diet_type if profile.diet_type in {"veg", "eggetarian", "non-veg", "vegan"} else "non-veg",
            goal=profile.goal if profile.goal in {"lose", "maintain", "gain"} else "maintain",
            target_weight_kg=profile.target_weight_kg,
        )
        calculated = calculate_profile_targets(calculation_input)
        response.update(calculated)
    response["daily_deficit"] = round(max(
        0, (response.get("maintenance_calories") or 0) - (response.get("calorie_target") or 0)
    ))
    return response


@app.get("/profile")
def get_profile(db: Session = Depends(get_db)):
    return profile_response(db.query(Profile).first())

@app.post("/profile")
def update_profile(data: ProfileUpdate, db: Session = Depends(get_db)):
    targets = calculate_profile_targets(data)
    profile = db.query(Profile).first() or Profile(id=1)
    for field in (
        "age", "sex", "height", "weight", "activity_level", "diet_type", "goal",
        "target_weight_kg", "routine_timezone", "wake_time", "work_start_time",
        "work_end_time", "breakfast_time", "lunch_time", "snack_time", "dinner_time",
        "sleep_time",
    ):
        setattr(profile, field, getattr(data, field))
    profile.bmr = targets["bmr"]
    profile.maintenance_calories = targets["maintenance_calories"]
    profile.calorie_target = targets["calorie_target"]
    profile.bmi = targets["bmi"]
    profile.protein_target = targets["protein_target"]
    profile.carb_target = targets["carb_target"]
    profile.fat_target = targets["fat_target"]
    db.add(profile); db.commit(); db.refresh(profile)
    return profile_response(profile)


@app.get("/profile/weekly-plan")
def get_profile_weekly_plan(db: Session = Depends(get_db)):
    profile = db.query(Profile).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Save your profile to build a weekly plan.")

    timezone = ZoneInfo(profile.routine_timezone or "Asia/Kolkata")
    start_date = datetime.now(timezone).date()
    walk_minutes = 20 if profile.activity_level == "sedentary" else 30
    weekly_activities = [
        ("Brisk walk", walk_minutes, 0, "Start at a comfortable pace."),
        ("Walk + beginner strength", walk_minutes, 20, "Keep strength work controlled and light."),
        ("Brisk walk", walk_minutes, 0, "Choose a pace that still lets you speak in short sentences."),
        ("Recovery and mobility", 0, 15, "Gentle stretching or an easy recovery walk."),
        ("Walk + beginner strength", walk_minutes, 20, "Repeat the simple strength session; rest between sets."),
        ("Brisk walk", walk_minutes, 0, "Keep this session easy if the week felt tiring."),
        ("Rest day", 0, 0, "Rest, or take a relaxed walk if it feels good."),
    ]
    days = []
    for offset, (activity, aerobic_minutes, strength_minutes, focus) in enumerate(weekly_activities):
        plan_date = start_date.fromordinal(start_date.toordinal() + offset)
        days.append({
            "date": plan_date.isoformat(),
            "day": plan_date.strftime("%A"),
            "calories": round(profile.calorie_target or profile.maintenance_calories or 0),
            "activity": activity,
            "aerobic_minutes": aerobic_minutes,
            "strength_minutes": strength_minutes,
            "focus": focus,
        })

    meal_schedule = [
        {"meal": "Wake", "time": str(profile.wake_time or time(6, 30))[:5]},
        {"meal": "Breakfast", "time": str(profile.breakfast_time or time(8, 0))[:5]},
        {"meal": "Lunch", "time": str(profile.lunch_time or time(13, 0))[:5]},
        {"meal": "Snack", "time": str(profile.snack_time or time(16, 30))[:5]},
        {"meal": "Dinner", "time": str(profile.dinner_time or time(20, 0))[:5]},
        {"meal": "Sleep", "time": str(profile.sleep_time or time(22, 30))[:5]},
    ]
    aerobic_total = sum(day["aerobic_minutes"] for day in days)
    return {
        "timezone": profile.routine_timezone or "Asia/Kolkata",
        "week_start": start_date.isoformat(),
        "days": days,
        "meal_schedule": meal_schedule,
        "work_schedule": {
            "start": str(profile.work_start_time or time(9, 0))[:5],
            "end": str(profile.work_end_time or time(18, 0))[:5],
        },
        "activity_summary": {
            "aerobic_minutes": aerobic_total,
            "strength_sessions": sum(1 for day in days if day["strength_minutes"] > 0),
            "guidance": (
                "Starter week: build gradually toward at least 150 minutes of moderate activity weekly."
                if aerobic_total < 150
                else "Plan includes at least 150 minutes of moderate aerobic activity and two strength sessions."
            ),
        },
    }

@app.get("/search-food")
def search_food(
    q: str,
    db: Session = Depends(get_db),
    limit: int = Query(default=30, ge=1, le=100),
):
    query = " ".join(q.strip().lower().split())
    if len(query) < 2:
        return []

    alias_targets = [
        canonical
        for canonical, aliases in FOOD_SEARCH_ALIASES.items()
        if any(query in alias or alias in query for alias in aliases)
    ]
    filters = [FoodItem.name.ilike(f"%{query}%")]
    filters.extend(FoodItem.name.ilike(f"%{name}%") for name in alias_targets)
    candidates = db.query(FoodItem).filter(or_(*filters)).all()

    def relevance(item):
        name = item.name.lower()
        if name == query:
            return (0, name)
        if name.startswith(query):
            return (1, name)
        if query in name:
            return (2, name)
        return (3, name)

    return sorted(candidates, key=relevance)[:limit]

@app.get("/foods/favorites")
def get_favorite_foods(db: Session = Depends(get_db)):
    return (
        db.query(FoodItem)
        .join(FoodFavorite, FoodFavorite.food_item_id == FoodItem.id)
        .order_by(FoodFavorite.created_at.desc())
        .all()
    )

@app.put("/foods/{food_id}/favorite")
def add_food_favorite(food_id: int, db: Session = Depends(get_db)):
    food = db.query(FoodItem).filter(FoodItem.id == food_id).first()
    if not food:
        raise HTTPException(status_code=404, detail="Food not found.")
    favorite = db.query(FoodFavorite).filter(FoodFavorite.food_item_id == food_id).first()
    if not favorite:
        db.add(FoodFavorite(food_item_id=food_id))
        db.commit()
    return {"food_id": food_id, "is_favorite": True}

@app.delete("/foods/{food_id}/favorite")
def remove_food_favorite(food_id: int, db: Session = Depends(get_db)):
    food = db.query(FoodItem).filter(FoodItem.id == food_id).first()
    if not food:
        raise HTTPException(status_code=404, detail="Food not found.")
    favorite = db.query(FoodFavorite).filter(FoodFavorite.food_item_id == food_id).first()
    if favorite:
        db.delete(favorite)
        db.commit()
    return {"food_id": food_id, "is_favorite": False}

@app.get("/foods/recent")
def get_recent_foods(
    db: Session = Depends(get_db),
    limit: int = Query(default=12, ge=1, le=50),
):
    latest_logs = (
        db.query(
            HealthLog.food_item_id.label("food_item_id"),
            func.max(HealthLog.timestamp).label("last_logged_at"),
        )
        .filter(HealthLog.category == "nutrition", HealthLog.food_item_id.isnot(None))
        .group_by(HealthLog.food_item_id)
        .order_by(func.max(HealthLog.timestamp).desc())
        .limit(limit)
        .subquery()
    )
    return (
        db.query(FoodItem)
        .join(latest_logs, latest_logs.c.food_item_id == FoodItem.id)
        .order_by(latest_logs.c.last_logged_at.desc())
        .all()
    )

@app.post("/logs")
async def create_log(log: LogCreate, db: Session = Depends(get_db)):
    calories, protein, carbs, fats, fiber, source = 0, 0, 0, 0, 0, "user"
    if log.category == "nutrition":
        if not log.note or not log.note.strip():
            raise HTTPException(status_code=422, detail="Add a food description before saving.")
        nutrient_values = (log.calories, log.protein, log.carbs, log.fats, log.fiber)
        if any(value is None for value in nutrient_values):
            raise HTTPException(status_code=422, detail="Enter all nutrition values, or review and confirm an AI estimate before saving.")
        calories, protein, carbs, fats, fiber = nutrient_values
        source = log.source or "user-edited"
        if source not in {"database", "AI-estimated", "user-edited"}:
            raise HTTPException(status_code=422, detail="Nutrition source must be database, AI-estimated, or user-edited.")
        if log.food_item_id is not None:
            if source != "database":
                raise HTTPException(status_code=422, detail="Only catalog foods can be linked to a catalog item.")
            if not db.query(FoodItem.id).filter(FoodItem.id == log.food_item_id).first():
                raise HTTPException(status_code=404, detail="Food not found.")
    elif log.food_item_id is not None:
        raise HTTPException(status_code=422, detail="Catalog food links are only valid for nutrition logs.")

    db_log = HealthLog(category=log.category, value=log.value, note=log.note, food_item_id=log.food_item_id, calories=calories, protein=protein, carbs=carbs, fats=fats, fiber=fiber, meal=(log.meal or "Snack").strip(), source=source)
    db.add(db_log); db.commit(); db.refresh(db_log)
    return db_log

@app.delete("/logs/{log_id}")
def delete_log(log_id: int, db: Session = Depends(get_db)):
    log = db.query(HealthLog).filter(HealthLog.id == log_id).first()
    if not log: 
        raise HTTPException(status_code=404, detail=f"Log with ID {log_id} not found")
    db.delete(log)
    db.commit()
    return {"status": "deleted", "id": log_id}

@app.get("/logs")
def get_logs(db: Session = Depends(get_db), date_filter: Optional[date] = None):
    query = db.query(HealthLog)
    if date_filter:
        query = query.filter(func.date(HealthLog.timestamp) == date_filter)
    return query.order_by(HealthLog.timestamp.desc()).all()

@app.get("/summary")
def get_summary(db: Session = Depends(get_db), date_filter: Optional[date] = None):
    query = db.query(HealthLog).filter(HealthLog.category == "nutrition")
    if date_filter:
        query = query.filter(func.date(HealthLog.timestamp) == date_filter)
    
    logs = query.all()
    by_meal = {}
    for log in logs:
        meal = log.meal or "Snack"
        totals = by_meal.setdefault(meal, {"calories": 0, "protein": 0, "carbs": 0, "fats": 0, "fiber": 0})
        totals["calories"] += log.calories or 0
        totals["protein"] += log.protein or 0
        totals["carbs"] += log.carbs or 0
        totals["fats"] += log.fats or 0
        totals["fiber"] += log.fiber or 0
    return {
        "total_calories": sum(l.calories or 0 for l in logs),
        "total_protein": sum(l.protein or 0 for l in logs),
        "total_carbs": sum(l.carbs or 0 for l in logs),
        "total_fats": sum(l.fats or 0 for l in logs),
        "total_fiber": sum(l.fiber or 0 for l in logs),
        "by_meal": by_meal
    }


@app.get("/insights")
def get_insights(days: int = Query(default=7, ge=7, le=90), db: Session = Depends(get_db)):
    local_zone = ZoneInfo("Asia/Kolkata")
    today = datetime.now(local_zone).date()
    first_day = today - timedelta(days=days - 1)
    range_start = datetime.combine(first_day, time.min, tzinfo=local_zone).astimezone(timezone.utc).replace(tzinfo=None)
    range_end = datetime.combine(today + timedelta(days=1), time.min, tzinfo=local_zone).astimezone(timezone.utc).replace(tzinfo=None)
    profile = db.query(Profile).first()
    profile_data = profile_response(profile) if profile else None
    calorie_target = round((profile_data or {}).get("calorie_target") or 0)

    daily_by_date = {}
    for offset in range(days):
        day = first_day + timedelta(days=offset)
        daily_by_date[day.isoformat()] = {
            "date": day.isoformat(), "day": day.strftime("%a"), "calories": 0,
            "protein": 0, "carbs": 0, "fats": 0, "fiber": 0, "water_ml": 0,
            "weight_kg": None, "workout_minutes": 0, "workout_count": 0,
            "target_calories": calorie_target,
        }

    nutrition_logs = db.query(HealthLog).filter(
        HealthLog.timestamp >= range_start,
        HealthLog.timestamp < range_end,
    ).all()
    for log in nutrition_logs:
        local_date = log.timestamp.replace(tzinfo=timezone.utc).astimezone(local_zone).date().isoformat()
        day = daily_by_date.get(local_date)
        if day is None or log.category != "nutrition":
            continue
        for field in ("calories", "protein", "carbs", "fats", "fiber"):
            day[field] += getattr(log, field) or 0

    water_logs = db.query(WaterLog).filter(
        WaterLog.timestamp >= range_start,
        WaterLog.timestamp < range_end,
    ).all()
    for log in water_logs:
        local_date = log.timestamp.replace(tzinfo=timezone.utc).astimezone(local_zone).date().isoformat()
        if local_date in daily_by_date:
            daily_by_date[local_date]["water_ml"] += log.amount_ml or 0

    weight_logs = db.query(WeightLog).filter(
        WeightLog.timestamp >= range_start,
        WeightLog.timestamp < range_end,
    ).order_by(WeightLog.timestamp.asc()).all()
    for log in weight_logs:
        local_date = log.timestamp.replace(tzinfo=timezone.utc).astimezone(local_zone).date().isoformat()
        if local_date in daily_by_date:
            daily_by_date[local_date]["weight_kg"] = log.weight_kg

    workout_sessions = db.query(WorkoutSession).filter(
        WorkoutSession.date >= range_start,
        WorkoutSession.date < range_end,
    ).all()
    for session in workout_sessions:
        local_date = session.date.replace(tzinfo=timezone.utc).astimezone(local_zone).date().isoformat()
        day = daily_by_date.get(local_date)
        if day is not None:
            day["workout_minutes"] += session.duration_mins or 0
            day["workout_count"] += 1

    daily = list(daily_by_date.values())
    logged_days = [day for day in daily if day["calories"] > 0]
    average_calories = round(sum(day["calories"] for day in logged_days) / len(logged_days)) if logged_days else 0
    goal = (profile_data or {}).get("goal", "maintain")
    if goal == "lose":
        goal_label = "Logged days at or below target"
        goal_days = sum(1 for day in logged_days if day["calories"] <= calorie_target)
    elif goal == "gain":
        goal_label = "Logged days at or above target"
        goal_days = sum(1 for day in logged_days if day["calories"] >= calorie_target)
    else:
        goal_label = "Logged days within 10% of target"
        goal_days = sum(
            1 for day in logged_days
            if calorie_target and abs(day["calories"] - calorie_target) <= calorie_target * 0.1
        )

    weight_series = [
        {"date": day["date"], "weight_kg": day["weight_kg"]}
        for day in daily if day["weight_kg"] is not None
    ]
    total_workouts = sum(day["workout_count"] for day in daily)
    total_workout_minutes = sum(day["workout_minutes"] for day in daily)
    total_water_days = [day["water_ml"] for day in daily if day["water_ml"] > 0]
    return {
        "timezone": "Asia/Kolkata",
        "days": days,
        "goal": goal,
        "daily": daily,
        "weight_series": weight_series,
        "summary": {
            "calorie_target": calorie_target,
            "average_calories": average_calories,
            "logged_days": len(logged_days),
            "goal_days": goal_days,
            "goal_label": goal_label,
            "workout_count": total_workouts,
            "workout_minutes": total_workout_minutes,
            "average_water_ml": round(sum(total_water_days) / len(total_water_days)) if total_water_days else 0,
            "weight_change_kg": round(weight_series[-1]["weight_kg"] - weight_series[0]["weight_kg"], 1) if len(weight_series) > 1 else None,
        },
    }

@app.get("/tracking/daily")
def get_daily_tracking(date_filter: Optional[date] = None, db: Session = Depends(get_db)):
    water_query = db.query(WaterLog)
    weight_query = db.query(WeightLog)
    if date_filter:
        water_query = water_query.filter(func.date(WaterLog.timestamp) == date_filter)
        weight_query = weight_query.filter(func.date(WeightLog.timestamp) == date_filter)
    water_logs = water_query.order_by(WaterLog.timestamp.desc()).all()
    weight_logs = weight_query.order_by(WeightLog.timestamp.desc()).all()
    return {
        "water_total_ml": sum(log.amount_ml for log in water_logs),
        "water_logs": water_logs,
        "weight_logs": weight_logs,
        "latest_weight_kg": weight_logs[0].weight_kg if weight_logs else None,
    }

@app.post("/tracking/water")
def add_water(data: WaterCreate, db: Session = Depends(get_db)):
    log = WaterLog(amount_ml=data.amount_ml)
    db.add(log); db.commit(); db.refresh(log)
    return log

@app.post("/tracking/weight")
def add_weight(data: WeightCreate, db: Session = Depends(get_db)):
    log = WeightLog(weight_kg=data.weight_kg)
    profile = db.query(Profile).first()
    if profile:
        profile.weight = data.weight_kg
        if profile.age and profile.height:
            calculation_input = ProfileUpdate.model_construct(
                age=profile.age,
                sex=profile.sex if profile.sex in {"male", "female"} else "male",
                height=profile.height,
                weight=data.weight_kg,
                activity_level=profile.activity_level if profile.activity_level in {
                    "sedentary", "light", "moderate", "active", "very_active"
                } else "sedentary",
                diet_type=profile.diet_type or "non-veg",
                goal=profile.goal if profile.goal in {"lose", "maintain", "gain"} else "maintain",
                target_weight_kg=profile.target_weight_kg,
            )
            targets = calculate_profile_targets(calculation_input)
            profile.bmr = targets["bmr"]
            profile.maintenance_calories = targets["maintenance_calories"]
            profile.calorie_target = targets["calorie_target"]
            profile.bmi = targets["bmi"]
            profile.protein_target = targets["protein_target"]
            profile.carb_target = targets["carb_target"]
            profile.fat_target = targets["fat_target"]
    db.add(log); db.commit(); db.refresh(log)
    return log

# WORKOUT ENDPOINTS
@app.get("/exercises")
def get_exercises(
    q: Optional[str] = None,
    equipment: Optional[str] = None,
    muscle_group: Optional[str] = None,
    db: Session = Depends(get_db),
):
    workout_service.seed_library(db)
    query = db.query(Exercise)
    if q and q.strip():
        query = query.filter(Exercise.name.ilike(f"%{q.strip()}%"))
    if equipment and equipment != "Any":
        query = query.filter(Exercise.equipment == equipment)
    if muscle_group and muscle_group != "Any":
        query = query.filter(Exercise.muscle_group == muscle_group)
    return query.order_by(Exercise.muscle_group, Exercise.name).all()

@app.get("/workouts/templates")
def get_workout_templates(equipment: str = "Any", db: Session = Depends(get_db)):
    workout_service.seed_library(db)
    if equipment not in {"Any", "Gym", "Dumbbells", "None", "Home"}:
        raise HTTPException(status_code=422, detail="Choose Gym, Dumbbells, None, or Any equipment.")
    return workout_service.get_templates(db, "None" if equipment == "Home" else equipment)

@app.post("/workouts/plan")
async def plan_workout(prefs: WorkoutPlanRequest, db: Session = Depends(get_db)):
    if prefs.equipment not in {"Gym", "Home", "Dumbbells", "None"}:
        raise HTTPException(status_code=422, detail="Choose Gym, Home, Dumbbells, or None equipment.")
    profile = db.query(Profile).first()
    if not profile: raise HTTPException(status_code=404, detail="Profile not found")
    workout_service.seed_library(db)
    equipment_map = {
        "Gym": {"Gym", "Dumbbells", "Home", "None"},
        "Home": {"Home", "None"},
        "Dumbbells": {"Dumbbells", "None"},
        "None": {"None"},
    }
    exercise_library = db.query(Exercise).filter(Exercise.equipment.in_(equipment_map[prefs.equipment])).all()
    plan = await workout_service.generate_ai_workout(profile, prefs.model_dump(), exercise_library)
    if not plan: raise HTTPException(status_code=500, detail="AI failed to generate plan")
    return plan

@app.post("/workouts/log")
def log_workout(session: WorkoutLogCreate, db: Session = Depends(get_db)):
    if not session.sets and not (session.note or "").strip():
        raise HTTPException(status_code=422, detail="Add at least one completed set or a workout note.")
    exercise_ids = {item.exercise_id for item in session.sets}
    available_ids = {
        exercise_id
        for (exercise_id,) in db.query(Exercise.id).filter(Exercise.id.in_(exercise_ids)).all()
    } if exercise_ids else set()
    if exercise_ids - available_ids:
        raise HTTPException(status_code=422, detail="A workout set references an unknown exercise.")

    new_session = WorkoutSession(
        workout_type=session.workout_type.strip(),
        duration_mins=session.duration_mins,
        calories_burned=session.calories or 0,
        note=session.note or "",
    )
    db.add(new_session)
    db.flush()
    for item in session.sets:
        db.add(WorkoutSet(
            session_id=new_session.id,
            exercise_id=item.exercise_id,
            set_number=item.set_number,
            weight=item.weight,
            reps=item.reps,
            rpe=item.rpe,
        ))
    db.commit()
    return {"status": "saved", "session_id": new_session.id}

@app.get("/workouts/sessions")
def get_workout_sessions(
    limit: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    sessions = db.query(WorkoutSession).order_by(WorkoutSession.date.desc()).limit(limit).all()
    result = []
    for session in sessions:
        set_rows = (
            db.query(WorkoutSet, Exercise.name)
            .outerjoin(Exercise, Exercise.id == WorkoutSet.exercise_id)
            .filter(WorkoutSet.session_id == session.id)
            .order_by(WorkoutSet.set_number)
            .all()
        )
        result.append({
            "id": session.id,
            "workout_type": session.workout_type,
            "date": session.date,
            "duration_mins": session.duration_mins,
            "calories_burned": session.calories_burned,
            "note": session.note,
            "sets": [
                {"exercise_name": name, "set_number": item.set_number, "reps": item.reps,
                 "weight": item.weight, "rpe": item.rpe}
                for item, name in set_rows
            ],
        })
    return result

@app.get("/ai/parse-live")
async def parse_live(text: str):
    return await ai_engine.parse_food_live(text)

@app.post("/ai/food-draft")
async def food_draft(request: FoodDraftRequest):
    if not request.text.strip():
        raise HTTPException(status_code=422, detail="Describe the food and amount first.")
    try:
        return await ai_engine.create_food_draft(request.text.strip())
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Nutrition estimate unavailable: {e}")

@app.post("/coach/chat")
async def chat_with_coach(message: dict, db: Session = Depends(get_db)):
    user_query = message.get("text", "")
    logs = db.query(HealthLog).all()
    logs_str = "\n".join([f"{l.category}: {l.value} {l.note}" for l in logs[-20:]])
    profile = db.query(Profile).first()
    prompt = f"User Profile: {profile}\nRecent Logs:\n{logs_str}\n\nUser asks: {user_query}\nAnswer as a professional health coach."
    async def stream_response():
        try:
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream(
                    "POST",
                    f"{ai_engine.ollama_url}/api/chat",
                    json={
                        "model": ai_engine.model_name,
                        "messages": [{"role": "user", "content": prompt}],
                        "stream": True,
                        "keep_alive": "10m",
                        "options": {"num_predict": 512},
                    },
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        chunk = json.loads(line)
                        token = chunk.get("message", {}).get("content", "")
                        if token:
                            yield f"data: {json.dumps({'token': token})}\n\n"
                        if chunk.get("done"):
                            yield "data: [DONE]\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': f'Coach response failed: {exc}'})}\n\n"

    return StreamingResponse(
        stream_response(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
