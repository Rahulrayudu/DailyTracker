import ollama
import json
import math
import re
import asyncio
from .core.config import settings

class HealthAI:
    def __init__(self, model_name=None):
        self.model_name = model_name or settings.DEFAULT_MODEL
        self.ollama_url = settings.OLLAMA_URL.rstrip("/")

    async def parse_food_live(self, food_text):
        """Fast local chips; reserve the single Ollama model call for confirmation."""
        foods = ("apple", "banana", "orange", "rice", "roti", "chapati", "dal", "egg",
                 "paneer", "chicken", "milk", "curd", "yogurt", "idli", "dosa", "oats")
        text = food_text.lower()
        chips = []
        for item in foods:
            match = re.search(rf"\b{re.escape(item)}s?\b", text)
            if not match:
                continue
            before = text[max(0, match.start() - 20):match.start()]
            quantity = re.search(r"(\d+(?:\.\d+)?\s*(?:g|kg|ml|l|pieces?|cups?|katori|medium|small|large)?)\s*$", before)
            chips.append({"item": item, "quantity": quantity.group(1).strip() if quantity else "amount needed"})
        return chips

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

If the amount is missing, or preparation changes nutrition materially (for example, fried versus plain), return status='clarification' and ask ONE concise, friendly question. Do not guess nutrition in this case; set all nutrient values to 0.
If enough information is present, return status='ready'. Estimate nutrition for the TOTAL amount described, not per 100 g. Return calories (kcal), protein/carbs/fats/fiber (grams). Use reasonable standard food-composition estimates. State any serving-size assumption in food_description. Treat a stated weight such as 100 g as the total edible amount. Never use zero as a placeholder: each nutrient should be nonzero when the food portion normally contains it, and calories must be greater than zero for a ready food entry.
Return only the required JSON object."""
        response = await asyncio.to_thread(
            ollama.chat,
            model=self.model_name,
            messages=[{"role": "user", "content": prompt}],
            format=schema,
            options={"temperature": 0, "num_predict": 180},
            keep_alive="10m"
        )
        content = response.get("message", {}).get("content", "")
        try:
            result = json.loads(content)
        except json.JSONDecodeError as exc:
            raise ValueError("The nutrition model returned invalid JSON") from exc

        required = ("status", "question", "food_description", "calories", "protein", "carbs", "fats", "fiber")
        if any(key not in result for key in required) or result["status"] not in {"ready", "clarification"}:
            raise ValueError("The nutrition model returned an incomplete result")
        if not isinstance(result["food_description"], str):
            raise ValueError("The nutrition model returned an invalid food description")
        for key in ("calories", "protein", "carbs", "fats", "fiber"):
            value = result[key]
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
                raise ValueError(f"The nutrition model returned an invalid {key} value")
        if result["status"] == "clarification":
            question = result["question"].strip() if isinstance(result["question"], str) else ""
            return {
                **result,
                "question": question or "How much did you have, and how was it prepared?",
                "source": "AI-estimated",
                "confidence": "needs details",
            }
        if not result["food_description"].strip():
            raise ValueError("The nutrition model returned an empty food description")
        if result["calories"] <= 0 or not any(result[key] > 0 for key in ("protein", "carbs", "fats")):
            raise ValueError("The nutrition model returned incomplete nutrition values")
        if result["calories"] > 10000 or any(result[key] > 1000 for key in ("protein", "carbs", "fats", "fiber")):
            raise ValueError("The nutrition model returned implausibly large values for one meal")
        result["source"] = "AI-estimated"
        result["confidence"] = "model estimate"
        return result

    async def analyze_trends(self, prompt_text):
        try:
            response = await asyncio.to_thread(
                ollama.chat,
                model=self.model_name,
                messages=[{'role': 'user', 'content': prompt_text}],
                options={"num_predict": 700},
                keep_alive="10m",
            )
            return response['message']['content']
        except Exception as e:
            return f"Coach is currently updating its knowledge base... (Error: {str(e)})"

ai_engine = HealthAI()
