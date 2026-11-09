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
        """Return separately reviewable drafts for each food in a meal description."""
        item_schema = {
            "type": "object",
            "properties": {
                "food_description": {"type": "string"},
                "calories": {"type": "number", "minimum": 0},
                "protein": {"type": "number", "minimum": 0},
                "carbs": {"type": "number", "minimum": 0},
                "fats": {"type": "number", "minimum": 0},
                "fiber": {"type": "number", "minimum": 0},
            },
            "required": ["food_description", "calories", "protein", "carbs", "fats", "fiber"],
        }
        schema = {
            "type": "object",
            "properties": {
                "status": {"type": "string", "enum": ["ready", "clarification"]},
                "question": {"type": "string"},
                "corrections": {"type": "array", "items": {
                    "type": "object",
                    "properties": {"original": {"type": "string"}, "corrected": {"type": "string"}},
                    "required": ["original", "corrected"],
                }},
                "items": {"type": "array", "items": item_schema, "maxItems": 10},
            },
            "required": ["status", "question", "corrections", "items"],
        }
        prompt = f"""You help a person create food diary entries. Interpret this message: {food_text!r}

Correct obvious spelling mistakes in food names without changing what the user means. List each fix in corrections as original/corrected.
When the user names multiple separate foods or dishes (for example, idli and sambar, or rice, dal, and a banana), create one items entry for EACH food so each can be logged separately. Keep a combined dish such as vegetable pulao as one item unless the user separately lists its components.
Understand everyday portions such as mini, small, single, medium, regular, large, one bowl, one plate, a handful, or half a serving. Treat these as useful portion information: estimate a typical amount, clearly state the size/serving assumption in that item's food_description, and do not ask for grams when a reasonable portion is described. If the user gives only a vague amount such as 'some' or gives no portion at all, return status='clarification' and ask one short question about the missing food(s). Do not invent nutrition values while asking.

When enough detail is present, return status='ready'. Estimate nutrition for the full portion of each separate item, not per 100 g. Return calories in kcal and protein, carbs, fats, fiber in grams. Use reasonable food-composition estimates. Calories must be greater than zero for each ready item; don't use zero placeholders for nutrients normally present.
Return only the JSON object matching the schema."""
        response = await asyncio.to_thread(
            ollama.chat,
            model=self.model_name,
            messages=[{"role": "user", "content": prompt}],
            format=schema,
            options={"temperature": 0, "num_predict": 500},
            keep_alive="10m"
        )
        content = response.get("message", {}).get("content", "")
        try:
            result = json.loads(content)
        except json.JSONDecodeError as exc:
            raise ValueError("The nutrition model returned invalid JSON") from exc

        if not isinstance(result, dict):
            raise ValueError("The nutrition model returned an invalid response shape")
        if any(key not in result for key in ("status", "question", "corrections", "items")) or result["status"] not in {"ready", "clarification"}:
            raise ValueError("The nutrition model returned an incomplete result")
        if result["status"] == "clarification":
            question = result["question"].strip() if isinstance(result["question"], str) else ""
            return {
                "status": "clarification",
                "question": question or "How much did you have, and how was it prepared?",
                "corrections": result["corrections"] if isinstance(result["corrections"], list) else [],
                "items": [],
                "source": "AI-estimated",
                "confidence": "needs details",
            }
        if not isinstance(result["items"], list) or not 1 <= len(result["items"]) <= 10:
            raise ValueError("The nutrition model returned no separate food items")
        validated_items = []
        for item in result["items"]:
            required = ("food_description", "calories", "protein", "carbs", "fats", "fiber")
            if not isinstance(item, dict) or any(key not in item for key in required) or not isinstance(item["food_description"], str) or not item["food_description"].strip():
                raise ValueError("The nutrition model returned an incomplete food item")
            for key in ("calories", "protein", "carbs", "fats", "fiber"):
                value = item[key]
                if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
                    raise ValueError(f"The nutrition model returned an invalid {key} value")
            if item["calories"] <= 0 or not any(item[key] > 0 for key in ("protein", "carbs", "fats")):
                raise ValueError("The nutrition model returned incomplete nutrition values")
            if item["calories"] > 10000 or any(item[key] > 1000 for key in ("protein", "carbs", "fats", "fiber")):
                raise ValueError("The nutrition model returned implausibly large values for one food item")
            validated_items.append({**item, "source": "AI-estimated", "confidence": "model estimate"})
        response_data = {
            "status": "ready",
            "question": "",
            "corrections": result["corrections"] if isinstance(result["corrections"], list) else [],
            "items": validated_items,
            "source": "AI-estimated",
            "confidence": "model estimate",
        }
        if len(validated_items) == 1:
            response_data.update(validated_items[0])
        return response_data

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
