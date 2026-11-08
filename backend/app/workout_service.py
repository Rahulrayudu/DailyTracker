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
            {"name": "Glute Bridge", "muscle_group": "Glutes", "equipment": "None", "difficulty": "Beginner", "instructions": "Lie on your back, brace lightly, and lift hips until shoulders, hips, and knees align.", "common_mistakes": "Overarching the lower back at the top"},
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
            {"name": "Dumbbell Biceps Curl", "muscle_group": "Biceps", "equipment": "Dumbbells", "difficulty": "Beginner", "instructions": "Keep elbows near your sides and curl the weights without swinging your torso.", "common_mistakes": "Using momentum or letting elbows drift forward"},
            {"name": "Cable Biceps Curl", "muscle_group": "Biceps", "equipment": "Gym", "difficulty": "Beginner", "instructions": "Stand tall, keep your upper arms steady, and curl the handle through a comfortable range.", "common_mistakes": "Leaning back or allowing the cable to pull your arms down quickly"},
            {"name": "Dumbbell Wrist Curl", "muscle_group": "Forearms", "equipment": "Dumbbells", "difficulty": "Beginner", "instructions": "Rest your forearms on your thighs and move only through a comfortable wrist range.", "common_mistakes": "Using a heavy load or lifting the forearms"},
            {"name": "Reverse Cable Curl", "muscle_group": "Forearms", "equipment": "Gym", "difficulty": "Beginner", "instructions": "Use a light straight-bar attachment, keep wrists neutral, and curl without rocking.", "common_mistakes": "Bending the wrists or using momentum"},
            {"name": "Close-Grip Push-Up", "muscle_group": "Triceps", "equipment": "None", "difficulty": "Beginner", "instructions": "Keep hands under your shoulders, brace your body, and lower only as far as comfortable.", "common_mistakes": "Flaring elbows or letting hips sag"},
            {"name": "Dumbbell Overhead Triceps Extension", "muscle_group": "Triceps", "equipment": "Dumbbells", "difficulty": "Beginner", "instructions": "Hold one light dumbbell overhead and bend your elbows while keeping your ribs relaxed.", "common_mistakes": "Arching the back or forcing a deep elbow bend"},
            {"name": "Cable Triceps Pressdown", "muscle_group": "Triceps", "equipment": "Gym", "difficulty": "Beginner", "instructions": "Keep elbows close to your sides and press the handle down with control.", "common_mistakes": "Rocking the torso or letting elbows move forward"},
            {"name": "Bodyweight Squat", "muscle_group": "Quads", "equipment": "None", "difficulty": "Beginner", "instructions": "Sit between your hips to a comfortable depth, then stand with steady balance.", "common_mistakes": "Allowing knees to collapse inward or heels to lift"},
            {"name": "Dumbbell Step-Up", "muscle_group": "Quads", "equipment": "Dumbbells", "difficulty": "Beginner", "instructions": "Use a stable low step, place the whole foot on it, and stand without pushing off hard from the floor leg.", "common_mistakes": "Using a step that is too high or letting the knee cave inward"},
            {"name": "Leg Extension", "muscle_group": "Quads", "equipment": "Gym", "difficulty": "Beginner", "instructions": "Set the machine comfortably and extend your knees smoothly without snapping them straight.", "common_mistakes": "Using momentum or locking the knees forcefully"},
            {"name": "Hamstring Walkout", "muscle_group": "Hamstrings", "equipment": "None", "difficulty": "Beginner", "instructions": "From a bridge position, take small heel steps out and back while keeping hips lifted only as high as comfortable.", "common_mistakes": "Letting the lower back arch or taking steps that are too long"},
            {"name": "Dumbbell Single-Leg Romanian Deadlift", "muscle_group": "Hamstrings", "equipment": "Dumbbells", "difficulty": "Intermediate", "instructions": "Hold a light dumbbell, hinge at the hips, and reach the free leg back while keeping your balance supported as needed.", "common_mistakes": "Rounding the back or forcing range beyond balance"},
            {"name": "Seated Leg Curl", "muscle_group": "Hamstrings", "equipment": "Gym", "difficulty": "Beginner", "instructions": "Adjust the pads, curl your heels smoothly toward the seat, and return with control.", "common_mistakes": "Lifting hips or letting the weight stack drop"},
            {"name": "Dumbbell Hip Thrust", "muscle_group": "Glutes", "equipment": "Dumbbells", "difficulty": "Beginner", "instructions": "Support your upper back on a stable surface, place a light dumbbell across your hips, and extend hips without arching.", "common_mistakes": "Using an unstable bench or arching the lower back"},
            {"name": "Hip Thrust Machine", "muscle_group": "Glutes", "equipment": "Gym", "difficulty": "Beginner", "instructions": "Set the pad securely, brace gently, and extend your hips through a comfortable range.", "common_mistakes": "Overextending the back or rushing the lowering phase"},
            {"name": "Standing Calf Raise", "muscle_group": "Calves", "equipment": "None", "difficulty": "Beginner", "instructions": "Hold a stable support, rise onto the balls of your feet, pause, and lower slowly.", "common_mistakes": "Bouncing or using an unstable surface"},
            {"name": "Dumbbell Calf Raise", "muscle_group": "Calves", "equipment": "Dumbbells", "difficulty": "Beginner", "instructions": "Hold light dumbbells by your sides and raise and lower your heels with control.", "common_mistakes": "Bouncing or rushing through the movement"},
            {"name": "Seated Calf Raise", "muscle_group": "Calves", "equipment": "Gym", "difficulty": "Beginner", "instructions": "Set the pad comfortably above your knees and lift your heels smoothly through a comfortable range.", "common_mistakes": "Bouncing the weight or forcing a painful stretch"},
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
        Muscle focus: {preferences.get('muscle_group') or 'Balanced full body'}
        Available exercise names (only choose from these): {', '.join(ex.name for ex in exercise_library)}
        Use only the available exercise names. When a muscle focus is specified, keep every exercise focused on that muscle group.
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
            plan["muscle_group"] = preferences.get("muscle_group")
            plan["equipment"] = preferences.get("equipment", "Home")
            plan["source"] = "ai"
            if not valid_exercises:
                return None
            return plan
        except Exception as e:
            print(f"AI Workout Error: {e}")
            return None

workout_service = WorkoutService()
