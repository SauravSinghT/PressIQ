import time
import os
import redis
from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from backend.predict import InferenceEngine

app = FastAPI(title="PressIQ API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = None
# Get REDIS_URL from environment variable (Render), default to local Docker Redis if not set
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")

# Initialize Redis client from URL
redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
@app.on_event("startup")
def startup_event():
    global engine
    engine = InferenceEngine()

class TextPayload(BaseModel):
    text: str

@app.get("/")
def health_check():
    return {"status": "online"}

@app.post("/analyze")
async def analyze(payload: TextPayload):
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")
    
    start_time = time.perf_counter()
    result = await engine.analyze_cascade(payload.text, threshold=0.85)
    result["latency_ms"] = round((time.perf_counter() - start_time) * 1000, 2)
    return result

@app.post("/analyze-image")
async def analyze_image(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image.")

    start_time = time.perf_counter()
    image_bytes = await file.read()
    result = await engine.analyze_image(image_bytes, threshold=0.85)
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    result["latency_ms"] = round((time.perf_counter() - start_time) * 1000, 2)
    return result

@app.post("/explain")
async def explain(payload: TextPayload):
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")
    
    return await engine.explain_tier2(payload.text)