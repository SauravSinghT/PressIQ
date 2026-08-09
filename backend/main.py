import logging
import os
import time
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from backend.predict import InferenceEngine

logger = logging.getLogger("uvicorn")

app = FastAPI(title="PressIQ API", version="2.0")

# Under Docker nginx serves the SPA and proxies /api, so requests are same-origin
# and CORS never applies. This only matters when the frontend is hosted elsewhere:
# set ALLOWED_ORIGINS="https://a.example,https://b.example" to name those hosts.
# Credentials stay off — the API uses no cookies or auth headers, and browsers
# reject "*" as an allowed origin the moment credentials are enabled.
allowed_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "*").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = None

@app.on_event("startup")
async def startup_event():
    global engine
    engine = InferenceEngine()
    await engine.init_redis()

class TextPayload(BaseModel):
    text: str

@app.get("/")
def health_check():
    return {
        "status": "online",
        "redis_connected": engine.redis_client is not None if engine else False,
    }

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
        raise HTTPException(
            status_code=400, detail="Uploaded file must be an image."
        )

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

    start_time = time.perf_counter()
    result = await engine.explain_tier2(payload.text)

    if isinstance(result, str):
        result = {"explanation": result}

    result["latency_ms"] = round((time.perf_counter() - start_time) * 1000, 2)
    return result