import ollama
import json
import re
import asyncio

class HealthAI:
    def __init__(self, model_name="llama3.1"):
        self.model_name = model_name

    async def parse_food_live(self, food_text):
        """
        Provides 'live' tokens/chips for the UI. 
        Identifies foods and quantities without calculating full nutrition yet.
        """
        prompt = f"""
        Extract foods and quantities from: "{food_text}"
        Return ONLY a JSON list of objects: [{{"item": "food name", "quantity": "amount"}}]
        Example: "2 bananas and a glass of milk" -> [{{"item": "banana", "quantity": "2 pieces"}}, {{"item": "milk", "quantity": "1 glass"}}]
        If nothing found, return [].
        """
        try:
            response = ollama.chat(model=self.model_name, messages=[{'role': 'user', 'content': prompt}])
            content = response['message']['content']
            match = re.search(r'\[.*\]', content, re.DOTALL)
            if match:
                return json.loads(match.group(0))
            return []
        except Exception as e:
            print(f"Live Parsing Error: {e}")
            return []

    async def parse_food(self, food_text):
        """
        Full nutrition calculation for saving to DB.
        """
        prompt = f"""
        Analyze the following food intake: "{food_text}"
        Return ONLY a JSON object with these keys: calories, protein, carbs, fats, fiber.
        If fiber is not available, estimate it.
        Provide estimated values based on standard nutrition data.
        Example: {{"calories": 200, "protein": 5, "carbs": 30, "fats": 1, "fiber": 3}}
        """
        try:
            response = ollama.chat(model=self.model_name, messages=[{'role': 'user', 'content': prompt}])
            content = response['message']['content']
            match = re.search(r'\{.*\}', content, re.DOTALL)
            if match:
                data = json.loads(match.group(0))
                # Ensure all keys exist to avoid crashes
                return {
                    "calories": data.get("calories", 0),
                    "protein": data.get("protein", 0),
                    "carbs": data.get("carbs", 0),
                    "fats": data.get("fats", 0),
                    "fiber": data.get("fiber", 0)
                }
            return {"calories": 0, "protein": 0, "carbs": 0, "fats": 0, "fiber": 0}
        except Exception as e:
            print(f"AI Parsing Error: {e}")
            raise

    async def create_food_draft(self, food_text):
        """Return a clarification question or a complete, reviewable nutrition estimate."""
        schema = {
            "type": "object",
            "properties": {
                "status": {"type": "string", "enum": ["ready", "clarification"]},
                "question": {"type": "string"},
                "food_description": {"type": "string"},
                "calories": {"type": "number", "minimum": 0},
                "protein": {"type": "number", "minimum": 0},
                "carbs": {"type": "number", "minimum": 0},
                "fats": {"type": "number", "minimum": 0},
                "fiber": {"type": "number", "minimum": 0}
            },
            "required": ["status", "question", "food_description", "calories", "protein", "carbs", "fats", "fiber"]
        }
        prompt = f"""You are helping log a meal. Analyze this entry: {food_text!r}

If the amount is missing or too ambiguous to estimate, return status='clarification' and ask ONE concise, friendly question for the missing amount or preparation detail. Do not guess nutrition in this case; set all nutrient values to 0.
If enough information is present, return status='ready'. Estimate nutrition for the TOTAL amount described, not per 100 g. Return calories (kcal), protein/carbs/fats/fiber (grams). Use reasonable standard food composition estimates. For fruit, state common assumptions in food_description (for example, medium apple with skin). Never return zero nutrients for a clearly specified ordinary food portion unless that value is genuinely zero.
Return only the required JSON object."""
        response = await asyncio.to_thread(
            ollama.chat,
            model=self.model_name,
            messages=[{"role": "user", "content": prompt}],
            format=schema,
            options={"temperature": 0}
        )
        content = response.get("message", {}).get("content", "")
        try:
            result = json.loads(content)
        except json.JSONDecodeError as exc:
            raise ValueError("The nutrition model returned invalid JSON") from exc

        required = ("status", "question", "food_description", "calories", "protein", "carbs", "fats", "fiber")
        if any(key not in result for key in required) or result["status"] not in {"ready", "clarification"}:
            raise ValueError("The nutrition model returned an incomplete result")
        for key in ("calories", "protein", "carbs", "fats", "fiber"):
            value = result[key]
            if not isinstance(value, (int, float)) or value < 0:
                raise ValueError(f"The nutrition model returned an invalid {key} value")
        if result["status"] == "ready" and not any(result[key] > 0 for key in ("calories", "protein", "carbs", "fats", "fiber")):
            raise ValueError("The nutrition model returned empty nutrition values")
        return result

    async def analyze_trends(self, prompt_text):
        try:
            response = ollama.chat(model=self.model_name, messages=[{'role': 'user', 'content': prompt_text}])
            return response['message']['content']
        except Exception as e:
            return f"Coach is currently updating its knowledge base... (Error: {str(e)})"

ai_engine = HealthAI()
