from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime

Base = declarative_base()

class Profile(Base):
    __tablename__ = "profile"
    id = Column(Integer, primary_key=True)
    age = Column(Integer)
    sex = Column(String)
    height = Column(Float)
    weight = Column(Float)
    activity_level = Column(String)
    diet_type = Column(String)
    goal = Column(String)
    calorie_target = Column(Float)
    protein_target = Column(Float)
    carb_target = Column(Float)
    fat_target = Column(Float)
    water_target = Column(Float)

class FoodItem(Base):
    __tablename__ = "food_items"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    calories = Column(Float)
    protein = Column(Float)
    carbs = Column(Float)
    fats = Column(Float)
    fiber = Column(Float, default=0)
    serving_size = Column(String) # e.g., "100g"

class HealthLog(Base):
    __tablename__ = "health_logs"
    id = Column(Integer, primary_key=True, index=True)
    category = Column(String) 
    value = Column(Float, nullable=True)
    note = Column(Text)
    calories = Column(Float, default=0)
    protein = Column(Float, default=0)
    carbs = Column(Float, default=0)
    fats = Column(Float, default=0)
    fiber = Column(Float, default=0)
    meal = Column(String, default="Snack")
    source = Column(String, default="user")
    timestamp = Column(DateTime, default=datetime.utcnow)

class WaterLog(Base):
    __tablename__ = "water_logs"
    id = Column(Integer, primary_key=True, index=True)
    amount_ml = Column(Integer, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

class WeightLog(Base):
    __tablename__ = "weight_logs"
    id = Column(Integer, primary_key=True, index=True)
    weight_kg = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

class Exercise(Base):
    __tablename__ = "exercises"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    muscle_group = Column(String)
    equipment = Column(String)
    difficulty = Column(String)
    instructions = Column(Text)
    common_mistakes = Column(Text)

class WorkoutSession(Base):
    __tablename__ = "workout_sessions"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime, default=datetime.utcnow)
    workout_type = Column(String) # e.g., "Push", "Full Body"
    duration_mins = Column(Integer)
    calories_burned = Column(Float)
    note = Column(Text)

class WorkoutSet(Base):
    __tablename__ = "workout_sets"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("workout_sessions.id"))
    exercise_id = Column(Integer, ForeignKey("exercises.id"))
    set_number = Column(Integer)
    weight = Column(Float)
    reps = Column(Integer)
    rpe = Column(Integer) # Rate of Perceived Exertion
