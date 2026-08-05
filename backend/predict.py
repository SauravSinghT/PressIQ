import os
import re
import io
import json
import asyncio
import joblib
import numpy as np
from PIL import Image
import easyocr
from dotenv import load_dotenv, find_dotenv
from sentence_transformers import SentenceTransformer
from tavily import AsyncTavilyClient
from google import genai
from google.genai import types

load_dotenv(find_dotenv(usecwd=True), override=True)

class InferenceEngine:
    def __init__(self):
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        model_path = os.path.join(base_dir, "models", "xgboost_fake_news.pkl")

        print("Loading SentenceTransformer ('all-MiniLM-L6-v2')...")
        self.encoder = SentenceTransformer("all-MiniLM-L6-v2")

        print(f"Loading XGBoost model from {model_path}...")
        self.model = joblib.load(model_path)

        print("Loading local EasyOCR reader (CPU)...")
        self.ocr_reader = easyocr.Reader(['en'], gpu=False)

        tavily_key = os.getenv("TAVILY_API_KEY")
        self.tavily = AsyncTavilyClient(api_key=tavily_key.strip()) if tavily_key else None

        gemini_key = os.getenv("GEMINI_API_KEY")
        self.ai_client = genai.Client(api_key=gemini_key.strip()) if gemini_key else None

    def predict_tier1(self, text: str) -> dict:
        """Fast local inference using SentenceTransformer + XGBoost."""
        clean_t = re.sub(r'^[A-Z\s,]+?\s*\((?:Reuters|AP|AFP|Bloomberg)\)\s*[-—–]\s*', '', text, flags=re.IGNORECASE)
        clean_t = re.sub(r'^[A-Z\s,]+?\s*[-—–]\s*', '', clean_t, flags=re.IGNORECASE).strip()

        embedding = self.encoder.encode([clean_t], normalize_embeddings=True)
        proba = self.model.predict_proba(embedding)[0]
        real_confidence = float(proba[1])
        prediction = "REAL" if real_confidence >= 0.5 else "FAKE"
        max_confidence = max(real_confidence, float(proba[0]))

        return {
            "prediction": prediction,
            "confidence_score": round(max_confidence, 4),
            "raw_real_probability": round(real_confidence, 4)
        }

    def extract_text_from_image(self, image_bytes: bytes) -> str:
        """Optimized local EasyOCR extraction with downscaling."""
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        max_dim = 1280
        if max(img.width, img.height) > max_dim:
            img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

        img_np = np.array(img)
        results = self.ocr_reader.readtext(img_np, detail=0, paragraph=True, batch_size=4)
        return " ".join(results).strip()

    async def clean_ocr_text(self, raw_ocr_text: str) -> str:
        """Clean OCR lead snippet using Gemini Flash (~15-25 tokens)."""
        if not self.ai_client or len(raw_ocr_text.strip()) < 15:
            return raw_ocr_text

        truncated_ocr = raw_ocr_text[:250].replace('\n', ' ')
        prompt = (
            "Clean OCR typos and fix multi-column reading order in this headline snippet. "
            "Return ONLY the cleaned plain text sentence without commentary:\n"
            f"\"{truncated_ocr}\""
        )

        try:
            response = self.ai_client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.0,
                    max_output_tokens=60
                )
            )
            cleaned = response.text.strip()
            return cleaned if cleaned else truncated_ocr
        except Exception as e:
            print(f"OCR Clean Fallback: {e}")
            return truncated_ocr

    async def verify_minimal_tier2(self, text: str) -> dict:
        """Fast minimal verification returning strict JSON format."""
        if not self.tavily or not self.ai_client:
            return {
                "label": "UNVERIFIED",
                "tokens": {"prompt_tokens": 0, "candidates_tokens": 0, "total_tokens": 0}
            }

        try:
            # Query Tavily for verification sources
            search_res = await asyncio.wait_for(
                self.tavily.search(
                    query=f'"{text[:60]}" claim verification', 
                    search_depth="basic", 
                    max_results=2
                ),
                timeout=3.5
            )
            
            results = search_res.get('results', [])
            context = "\n".join([r['content'][:180] for r in results]) if results else "No direct reporting found."

            prompt = (
                f"Determine if this news claim is REAL or FAKE based on real-world reporting.\n"
                f"Claim: \"{text}\"\n"
                f"Web Search Context: {context}\n\n"
                "Return ONLY a JSON object: {\"verdict\": \"REAL\"} or {\"verdict\": \"FAKE\"}"
            )

            response = self.ai_client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.0,
                    thinking_config=types.ThinkingConfig(thinking_budget=0)
                )
            )

            usage = response.usage_metadata
            tokens = {
                "prompt_tokens": usage.prompt_token_count if usage else 0,
                "candidates_tokens": usage.candidates_token_count if usage else 0,
                "total_tokens": usage.total_token_count if usage else 0
            }

            # Safe JSON Extraction (Handles markdown code blocks gracefully)
            match = re.search(r'\{.*\}', response.text, re.DOTALL)
            if match:
                res_json = json.loads(match.group(0))
                label = str(res_json.get("verdict", "FAKE")).strip().upper()
            else:
                label = "REAL" if "REAL" in response.text.upper() else "FAKE"

            return {
                "label": label if label in ["REAL", "FAKE"] else "FAKE",
                "tokens": tokens
            }

        except Exception as e:
            print(f"Tier 2 Gemini / Tavily Error: {e}")
            return {
                "label": "UNVERIFIED",
                "tokens": {"prompt_tokens": 0, "candidates_tokens": 0, "total_tokens": 0}
            }

    async def analyze_cascade(self, text: str, threshold: float = 0.85) -> dict:
        t1_result = self.predict_tier1(text)

        if t1_result["confidence_score"] >= threshold:
            return {
                "prediction": t1_result["prediction"],
                "confidence_score": t1_result["confidence_score"],
                "verified_by": "Local Model (High Certainty)",
                "can_explain": True,
                "token_usage": {"prompt_tokens": 0, "candidates_tokens": 0, "total_tokens": 0}
            }

        t2_res = await self.verify_minimal_tier2(text)

        # Fallback to local tier 1 prediction if Tier 2 times out or is unverified
        final_verdict = t2_res["label"] if t2_res["label"] != "UNVERIFIED" else t1_result["prediction"]

        return {
            "prediction": final_verdict,
            "confidence_score": t1_result["confidence_score"],
            "verified_by": "RAG Web Check (Low Local Confidence)" if t2_res["label"] != "UNVERIFIED" else "Local Model Fallback",
            "can_explain": True,
            "token_usage": t2_res["tokens"]
        }

    async def analyze_image(self, image_bytes: bytes, threshold: float = 0.98) -> dict:
        raw_text = self.extract_text_from_image(image_bytes)

        if not raw_text:
            return {"error": "No readable text found in the image."}

        cleaned_text = await self.clean_ocr_text(raw_text)
        cascade_result = await self.analyze_cascade(cleaned_text, threshold=threshold)
        cascade_result["extracted_text"] = cleaned_text
        return cascade_result

    async def explain_tier2(self, text: str) -> dict:
        if not self.tavily or not self.ai_client:
            return {"error": "API keys missing."}

        try:
            search_res = await self.tavily.search(query=f"Fact check: {text[:200]}", max_results=3)
            results = search_res.get('results', [])
            context = "\n\n".join([f"Source ({r['url']}): {r['content']}" for r in results])
            sources = [r['url'] for r in results]

            prompt = f"Analyze for factual accuracy:\nClaim: \"{text}\"\nContext: {context}\nProvide a clear Verdict and a concise 2-3 sentence explanation."

            response = self.ai_client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt
            )

            return {
                "explanation": response.text,
                "sources": sources
            }
        except Exception as e:
            return {"error": str(e)}