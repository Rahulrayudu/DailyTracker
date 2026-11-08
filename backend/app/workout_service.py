import json
from .ai_engine import ai_engine
from sqlalchemy.orm import Session
from .models.models import Exercise, WorkoutSession, WorkoutSet

class WorkoutService:
    def __init__(self):
        # Seed data for exercise library if empty
        self.seed_exercises = [
            {"name": "Bench Press", "muscle_group": "Chest", "equipment": "Gym", "difficulty": "Intermediate", "instructions": "Set your feet, lower the bar under control, then press without bouncing.", "common_mistakes": "Bouncing the bar or lifting hips off the bench"},
            {"name": "Squats", "muscle_group": "Legs", "equipment": "Gym", "difficulty": "Intermediate", "instructions": "Brace your trunk, sit between your hips, and stand while keeping the bar balanced.", "common_mistakes": "Losing balance or letting knees collapse inward"},
            {"name": "Deadlift", "muscle_group": "Back", "equipment": "Gym", "difficulty": "Advanced", "instructions": "Keep the bar close, brace, and stand by extending hips and knees together.", "common_mistakes": "Rounding the back or jerking the bar from the floor"},
            {"name": "Pushups", "muscle_group": "Chest", "equipment": "None", "difficulty": "Beginner", "instructions": "Keep a straight body line, lower with control, and press the floor away.", "common_mistakes": "Letting hips sag or flaring elbows far out"},
            {"name": "Incline Pushups", "muscle_group": "Chest", "equipment": "Home", "difficulty": "Beginner", "instructions": "Place hands on a stable raised surface and keep your body in a straight line.", "common_mistakes": "Using an unstable surface or letting hips sag"},
            {"name": "Plank", "muscle_group": "Core", "equipment": "None", "difficulty": "Beginner", "instructions": "Keep elbows under shoulders, brace gently, and breathe throughout the hold.", "common_mistakes": "Holding your breath or letting the lower back sag"},
            {"name": "Pullups", "muscle_group": "Back", "equipment": "Gym", "difficulty": "Advanced", "instructions": "Start from a controlled hang and pull without swinging.", "common_mistakes": "Kipping or straining through shoulder pain"},
            {"name": "Lunges", "muscle_group": "Legs", "equipment": "None", "difficulty": "Beginner", "instructions": "Step to a comfortable distance, lower under control, and push through the front foot.", "common_mistakes": "Losing balance or forcing a painful range"},
            {"name": "Glute Bridge", "muscle_group": "Legs", "equipment": "None", "difficulty": "Beginner", "instructions": "Lie on your back, brace lightly, and lift hips until shoulders, hips, and knees align.", "common_mistakes": "Overarching the lower back at the top"},
            {"name": "Bird Dog", "muscle_group": "Core", "equipment": "None", "difficulty": "Beginner", "instructions": "On hands and knees, extend opposite arm and leg while keeping hips level.", "common_mistakes": "Rotating the trunk or arching the back"},
            {"name": "Dumbbell Goblet Squat", "muscle_group": "Legs", "equipment": "Dumbbells", "difficulty": "Beginner", "instructions": "Hold one dumbbell at chest height, sit comfortably between hips, and stand steadily.", "common_mistakes": "Rushing the descent or allowing heels to lift"},
            {"name": "Dumbbell Romanian Deadlift", "muscle_group": "Legs", "equipment": "Dumbbells", "difficulty": "Intermediate", "instructions": "With a soft knee bend, push hips back and lower dumbbells close to legs; stand by driving hips forward.", "common_mistakes": "Turning it into a squat or rounding the back"},
            {"name": "Dumbbell Row", "muscle_group": "Back", "equipment": "Dumbbells", "difficulty": "Beginner", "instructions": "Support one hand, keep your back neutral, and pull the dumbbell toward your hip.", "common_mistakes": "Twisting the torso or shrugging the shoulder"},
            {"name": "Dumbbell Floor Press", "muscle_group": "Chest", "equipment": "Dumbbells", "difficulty": "Beginner", "instructions": "Lie on the floor, lower dumbbells until upper arms gently touch, then press up.", "common_mistakes": "Bouncing elbows off the floor or letting wrists bend back"},
            {"name": "Dumbbell Overhead Press", "muscle_group": "Shoulders", "equipment": "Dumbbells", "difficulty": "Intermediate", "instructions": "Brace your trunk and press the weights overhead without leaning back.", "common_mistakes": "Arching the lower back or forcing a painful range"},
            {"name": "Dumbbell Lateral Raise", "muscle_group": "Shoulders", "equipment": "Dumbbells", "difficulty": "Beginner", "instructions": "Raise light dumbbells out to the sides with a slight elbow bend and slow control.", "common_mistakes": "Swinging the weights or shrugging"},
            {"name": "Seated Cable Row", "muscle_group": "Back", "equipment": "Gym", "difficulty": "Beginner", "instructions": "Sit tall, pull the handle toward your lower ribs, then return with control.", "common_mistakes": "Rocking the torso to move the weight"},
            {"name": "Lat Pulldown", "muscle_group": "Back", "equipment": "Gym", "difficulty": "Beginner", "instructions": "Pull the bar toward the upper chest while keeping your torso steady.", "common_mistakes": "Pulling behind the neck or leaning far backward"},
            {"name": "Leg Press", "muscle_group": "Legs", "equipment": "Gym", "difficulty": "Beginner", "instructions": "Lower the platform only as far as your hips stay supported, then press smoothly.", "common_mistakes": "Locking knees or allowing the lower back to round"},
            {"name": "Walking", "muscle_group": "Cardio", "equipment": "None", "difficulty": "Beginner", "instructions": "Walk at a comfortable pace and increase duration gradually.", "common_mistakes": "Increasing pace or distance too quickly"},
        ]

        self.templates = [
            {
                "workout_name": "Full Body Basics",
                "equipment": "None",
                "duration": 25,
                "focus": "Build a balanced bodyweight routine with simple movement patterns.",
                "exercise_names": ["Incline Pushups", "Lunges", "Glute Bridge", "Bird Dog", "Plank"],
            },
            {
                "workout_name": "Dumbbell Full Body",
                "equipment": "Dumbbells",
                "duration": 35,
                "focus": "A beginner-friendly full body session using dumbbells.",
                "exercise_names": ["Dumbbell Goblet Squat", "Dumbbell Floor Press", "Dumbbell Row", "Dumbbell Romanian Deadlift", "Plank"],
            },
            {
                "workout_name": "Gym Full Body",
                "equipment": "Gym",
                "duration": 45,
                "focus": "A balanced gym session with controlled compound and accessory work.",
                "exercise_names": ["Leg Press", "Bench Press", "Seated Cable Row", "Lat Pulldown", "Plank"],
            },
        ]

    def seed_library(self, db: Session):
        existing = {exercise.name: exercise for exercise in db.query(Exercise).all()}
        changed = False
        for ex in self.seed_exercises:
            current = existing.get(ex["name"])
            if current is None:
                db.add(Exercise(**ex))
                changed = True
            else:
                for field, value in ex.items():
                    if getattr(current, field) != value:
                        setattr(current, field, value)
                        changed = True
        if changed:
            db.commit()

    def get_templates(self, db: Session, equipment: str = "Any"):
        library = {exercise.name: exercise for exercise in db.query(Exercise).all()}
        templates = []
        for template in self.templates:
            if equipment not in {"Any", template["equipment"]}:
                continue
            exercises = []
            for name in template["exercise_names"]:
                exercise = library.get(name)
                if exercise:
                    exercises.append({
                        "exercise_id": exercise.id,
                        "name": exercise.name,
                        "sets": 3,
                        "reps": "8-12",
                        "rest": "60-90 sec",
                        "rpe": 6,
                        "instructions": exercise.instructions,
                    })
            templates.append({
                "workout_name": template["workout_name"],
                "equipment": template["equipment"],
                "duration": template["duration"],
                "reasoning": template["focus"],
                "warm_up": "Begin with a few minutes of easy movement and comfortable joint mobility.",
                "source": "template",
                "exercises": exercises,
            })
        return templates

    async def generate_ai_workout(self, profile, preferences, exercise_library):
        """
        AI-driven workout planner based on profile and current needs.
        """
        prompt = f"""
        Generate a workout plan for a user with:
        Goal: {profile.goal}
        Sex: {profile.sex}
        Equipment: {preferences.get('equipment', 'Home')}
        Time: {preferences.get('duration', '45')} mins
        Available exercise names (only choose from these): {', '.join(ex.name for ex in exercise_library)}
        Safety: favor beginner-friendly variations, include a brief warm-up note, and tell the user to stop if they feel pain. Do not prescribe maximum lifts or diagnose injuries.
        
        Return ONLY a JSON object:
        {{
          "workout_name": "Plan Name",
          "reasoning": "Why this plan was chosen",
          "warm_up": "A brief general warm-up suggestion",
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
                
            plan = json.loads(content)
            by_name = {exercise.name.casefold(): exercise for exercise in exercise_library}
            valid_exercises = []
            for item in plan.get("exercises", []):
                if not isinstance(item, dict):
                    continue
                exercise = by_name.get(str(item.get("name", "")).casefold())
                if not exercise:
                    continue
                try:
                    sets = int(item.get("sets", 3))
                except (TypeError, ValueError):
                    sets = 3
                try:
                    rpe = int(item.get("rpe", 6))
                except (TypeError, ValueError):
                    rpe = 6
                item["name"] = exercise.name
                item["exercise_id"] = exercise.id
                item["instructions"] = exercise.instructions
                item["sets"] = min(8, max(1, sets))
                item["reps"] = str(item.get("reps", "8-12"))[:30]
                item["rest"] = str(item.get("rest", "60-90 sec"))[:30]
                item["rpe"] = min(10, max(1, rpe))
                valid_exercises.append(item)
            plan["exercises"] = valid_exercises
            plan["workout_name"] = str(plan.get("workout_name", "AI Workout"))[:120]
            plan["reasoning"] = str(plan.get("reasoning", "A balanced session based on your selected equipment."))[:500]
            plan["warm_up"] = str(plan.get("warm_up", "Start with a few minutes of easy movement and comfortable dynamic mobility."))[:400]
            plan["source"] = "ai"
            if not valid_exercises:
                return None
            return plan
        except Exception as e:
            print(f"AI Workout Error: {e}")
            return None

workout_service = WorkoutService()
