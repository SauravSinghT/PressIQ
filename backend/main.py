import time
import os
import redis
import json
import hashlib
import logging
from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from backend.predict import InferenceEngine

logger = logging.getLogger("uvicorn")

app = FastAPI(title="PressIQ API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = None

# Get REDIS_URL from environment variable
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")

# Initialize Redis client safely from URL
try:
    redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
except Exception as e:
    logger.error(f"Failed to initialize Redis client: {e}")
    redis_client = None


@app.on_event("startup")
def startup_event():
    global engine
    engine = InferenceEngine()
    if redis_client:
        try:
            redis_client.ping()
            logger.info("⚡ Successfully connected to Redis!")
        except Exception as e:
            logger.warning(f"⚠️ Redis ping failed: {e}. Running without cache.")


class TextPayload(BaseModel):
    text: str


def generate_cache_key(prefix: str, text: str) -> str:
    """Normalize input text and produce a deterministic MD5 hash key."""
    normalized = " ".join(text.strip().lower().split())
    hash_str = hashlib.md5(normalized.encode("utf-8")).hexdigest()
    return f"{prefix}:{hash_str}"


@app.get("/")
def health_check():
    return {"status": "online"}


@app.post("/analyze")
async def analyze(payload: TextPayload):
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    start_time = time.perf_counter()
    cache_key = generate_cache_key("analyze", payload.text)

    # 1. Check Redis Cache
    if redis_client:
        try:
            cached_data = redis_client.get(cache_key)
            if cached_data:
                logger.info(f"⚡ [CACHE HIT] Returning cached analysis for key: {cache_key}")
                result = json.loads(cached_data)
                result["cached"] = True
                result["latency_ms"] = round((time.perf_counter() - start_time) * 1000, 2)
                return result
        except Exception as e:
            logger.error(f"Redis GET error: {e}")

    # 2. Run Inference Engine (Cache Miss)
    logger.info(f"🐢 [CACHE MISS] Running ML inference for: {payload.text[:30]}...")
    result = await engine.analyze_cascade(payload.text, threshold=0.85)
    result["cached"] = False

    # 3. Store in Redis Cache (24-hour expiration)
    if redis_client:
        try:
            redis_client.setex(cache_key, 86400, json.dumps(result))
            logger.info(f"💾 Saved prediction to Redis key: {cache_key}")
        except Exception as e:
            logger.error(f"Redis SET error: {e}")

    result["latency_ms"] = round((time.perf_counter() - start_time) * 1000, 2)
    return result


@app.post("/analyze-image")
async def analyze_image(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image.")

    start_time = time.perf_counter()
    image_bytes = await file.read()

    # Cache image using MD5 of raw bytes
    image_hash = hashlib.md5(image_bytes).hexdigest()
    cache_key = f"analyze_image:{image_hash}"

    if redis_client:
        try:
            cached_data = redis_client.get(cache_key)
            if cached_data:
                logger.info(f"⚡ [CACHE HIT] Returning cached image analysis")
                result = json.loads(cached_data)
                result["cached"] = True
                result["latency_ms"] = round((time.perf_counter() - start_time) * 1000, 2)
                return result
        except Exception as e:
            logger.error(f"Redis GET error: {e}")

    result = await engine.analyze_image(image_bytes, threshold=0.85)

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    result["cached"] = False

    if redis_client:
        try:
            redis_client.setex(cache_key, 86400, json.dumps(result))
        except Exception as e:
            logger.error(f"Redis SET error: {e}")

    result["latency_ms"] = round((time.perf_counter() - start_time) * 1000, 2)
    return result


@app.post("/explain")
async def explain(payload: TextPayload):
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    start_time = time.perf_counter()
    cache_key = generate_cache_key("explain", payload.text)

    if redis_client:
        try:
            cached_data = redis_client.get(cache_key)
            if cached_data:
                logger.info(f"⚡ [CACHE HIT] Returning cached explanation")
                result = json.loads(cached_data)
                result["cached"] = True
                result["latency_ms"] = round((time.perf_counter() - start_time) * 1000, 2)
                return result
        except Exception as e:
            logger.error(f"Redis GET error: {e}")

    result = await engine.explain_tier2(payload.text)
    
    # Ensure result is a dict if explain_tier2 returns string
    if isinstance(result, str):
        result = {"explanation": result}
        
    result["cached"] = False

    if redis_client:
        try:
            redis_client.setex(cache_key, 86400, json.dumps(result))
        except Exception as e:
            logger.error(f"Redis SET error: {e}")

    result["latency_ms"] = round((time.perf_counter() - start_time) * 1000, 2)
    return result