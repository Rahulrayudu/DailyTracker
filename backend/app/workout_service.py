import json
import random
from .ai_engine import ai_engine
from sqlalchemy.orm import Session
from .models.models import Exercise, WorkoutSession, WorkoutSet

class WorkoutService:
    def __init__(self):
        # Seed data for exercise library if empty
        self.seed_exercises = [
            {"name": "Bench Press", "muscle_group": "Chest", "equipment": "Gym", "difficulty": "Intermediate", "instructions": "Lower bar to chest, press up.", "common_mistakes": "Arching back too much"},
            {"name": "Squats", "muscle_group": "Legs", "equipment": "Gym", "difficulty": "Intermediate", "instructions": "Lower hips, keep back straight.", "common_mistakes": "Knees caving in"},
            {"name": "Deadlift", "muscle_group": "Back", "equipment": "Gym", "difficulty": "Advanced", "instructions": "Lift bar from floor with straight back.", "common_mistakes": "Rounding the back"},
            {"name": "Pushups", "muscle_group": "Chest", "equipment": "Home", "difficulty": "Beginner", "instructions": "Lower body to floor, push up.", "common_mistakes": "Hips sagging"},
            {"name": "Plank", "muscle_group": "Core", "equipment": "None", "difficulty": "Beginner", "instructions": "Hold straight body position.", "common_mistakes": "Holding breath"},
            {"name": "Pullups", "muscle_group": "Back", "equipment": "Gym", "difficulty": "Advanced", "instructions": "Pull chin above bar.", "common_mistakes": "Kicking legs"},
            {"name": "Lunges", "muscle_group": "Legs", "equipment": "Home", "difficulty": "Beginner", "instructions": "Step forward, lower hips.", "common_mistakes": "Front knee going past toes"},
        ]

    def seed_library(self, db: Session):
        if db.query(Exercise).count() == 0:
            for ex in self.seed_exercises:
                db.add(Exercise(**ex))
            db.commit()

    async def generate_ai_workout(self, profile, preferences):
        """
        AI-driven workout planner based on profile and current needs.
        """
        prompt = f"""
        Generate a workout plan for a user with:
        Goal: {profile.goal}
        Sex: {profile.sex}
        Equipment: {preferences.get('equipment', 'Home')}
        Time: {preferences.get('duration', '45')} mins
        
        Return ONLY a JSON object:
        {{
          "workout_name": "Plan Name",
          "reasoning": "Why this plan was chosen",
          "exercises": [
            {{"name": "Exercise Name", "sets": 3, "reps": "10-12", "rest": "60s", "rpe": 8}},
            ...
          ]
        }}
        """
        try:
            response = await ai_engine.analyze_trends(prompt)
            # Clean response if LLM adds markdown
            content = response.strip()
            if content.startswith("```json"):
                content = content.split("```json")[1].split("```")[0]
            elif content.startswith("```"):
                content = content.split("```")[1].split("```")[0]
                
            return json.loads(content)
        except Exception as e:
            print(f"AI Workout Error: {e}")
            return None

workout_service = WorkoutService()
