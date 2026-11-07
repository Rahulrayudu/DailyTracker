import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional
from datetime import date
from .database import get_db, init_db
from .models.models import Profile, HealthLog, FoodItem, Exercise, WorkoutSession, WorkoutSet
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

class ProfileUpdate(BaseModel):
    age: int; sex: str; height: float; weight: float; activity_level: str; diet_type: str; goal: str

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

class FoodDraftRequest(BaseModel):
    text: str

@app.get("/")
def read_root(): return {"status": "Online"}

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "LocalHealth Pro"}

@app.get("/profile")
def get_profile(db: Session = Depends(get_db)):
    return db.query(Profile).first()

@app.post("/profile")
def update_profile(data: ProfileUpdate, db: Session = Depends(get_db)):
    if data.sex.lower() == "male":
        bmr = (10 * data.weight) + (6.25 * data.height) - (5 * data.age) + 5
    else:
        bmr = (10 * data.weight) + (6.25 * data.height) - (5 * data.age) - 161
    multipliers = {"sedentary": 1.2, "light": 1.375, "moderate": 1.55, "active": 1.725, "very_active": 1.9}
    tdee = bmr * multipliers.get(data.activity_level, 1.2)
    goal_adj = {"lose": -500, "maintain": 0, "gain": 500}
    target_cal = tdee + goal_adj.get(data.goal, 0)
    
    profile = db.query(Profile).first() or Profile(id=1)
    profile.age, profile.sex, profile.height, profile.weight = data.age, data.sex, data.height, data.weight
    profile.activity_level, profile.diet_type, profile.goal = data.activity_level, data.diet_type, data.goal
    profile.calorie_target, profile.protein_target, profile.carb_target, profile.fat_target = target_cal, (target_cal*0.3/4), (target_cal*0.4/4), (target_cal*0.3/9)
    db.add(profile); db.commit(); db.refresh(profile)
    return profile

@app.get("/search-food")
def search_food(q: str, db: Session = Depends(get_db), limit: int = 30):
    query = q.strip()
    if len(query) < 2:
        return []
    return db.query(FoodItem).filter(FoodItem.name.ilike(f"%{query}%")).order_by(FoodItem.name).limit(min(limit, 100)).all()

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

    db_log = HealthLog(category=log.category, value=log.value, note=log.note, calories=calories, protein=protein, carbs=carbs, fats=fats, fiber=fiber, meal=(log.meal or "Snack").strip(), source=source)
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

# WORKOUT ENDPOINTS
@app.get("/exercises")
def get_exercises(db: Session = Depends(get_db)):
    workout_service.seed_library(db)
    return db.query(Exercise).all()

@app.post("/workouts/plan")
async def plan_workout(prefs: dict, db: Session = Depends(get_db)):
    profile = db.query(Profile).first()
    if not profile: raise HTTPException(status_code=404, detail="Profile not found")
    plan = await workout_service.generate_ai_workout(profile, prefs)
    if not plan: raise HTTPException(status_code=500, detail="AI failed to generate plan")
    return plan

@app.post("/workouts/log")
def log_workout(session: dict, db: Session = Depends(get_db)):
    new_session = WorkoutSession(
        workout_type=session.get("workout_type", "General"),
        duration_mins=session.get("duration_mins", 0),
        calories_burned=session.get("calories", 0),
        note=session.get("note", "")
    )
    db.add(new_session); db.commit(); db.refresh(new_session)
    
    for s in session.get("sets", []):
        new_set = WorkoutSet(
            session_id=new_session.id,
            exercise_id=s.get("exercise_id"),
            set_number=s.get("set_number"),
            weight=s.get("weight"),
            reps=s.get("reps"),
            rpe=s.get("rpe")
        )
        db.add(new_set)
    db.commit()
    return {"status": "saved", "session_id": new_session.id}

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
    try:
        response = await ai_engine.analyze_trends(prompt)
        return {"response": response}
    except:
        return {"response": "I'm having trouble connecting to my brain. Please try again!"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
