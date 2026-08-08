PressIQ

AI-Powered Hybrid Fake News Detection & Verification Engine

PressIQ is a full-stack news verification system that analyzes text claims, headlines, and newspaper images.

It combines:

Local ML + OCR + Redis Caching + Web Search + Gemini

The main idea is simple:

«Check locally first. If uncertain, check Redis. Only then use live web search and Gemini.»

---

Key Features

- Fast local fake-news classification
- SentenceTransformer + XGBoost
- Newspaper image analysis with EasyOCR
- Live verification using Tavily
- Gemini-powered evidence verification
- Redis cache with 48-hour TTL
- Reduced API calls and token usage
- Structured JSON responses

---

System Architecture

flowchart LR

    USER["User"]

    UI["React<br/>Frontend"]

    API["FastAPI"]

    ML["Local ML<br/>SentenceTransformer<br/>+ XGBoost"]

    REDIS[("Redis<br/>48h Cache")]

    TAVILY["Tavily"]

    GEMINI["Gemini"]

    RESULT["Verdict"]

    USER --> UI
    UI --> API
    API --> ML

    ML -->|"High Confidence"| RESULT
    ML -->|"Low Confidence"| REDIS

    REDIS -->|"Cache Hit"| RESULT
    REDIS -->|"Cache Miss"| TAVILY

    TAVILY --> GEMINI
    GEMINI --> REDIS
    REDIS --> RESULT

How it works

User
 ↓
FastAPI
 ↓
Local ML
 ↓
 ├── High Confidence → Verdict
 │
 └── Low Confidence
          ↓
       Redis
       /   \
     HIT   MISS
      ↓      ↓
   Verdict  Tavily
              ↓
           Gemini
              ↓
            Redis
              ↓
           Verdict

---

Verification Flow

flowchart TD

    A["Text / Newspaper Image"]

    B["OCR if Image"]

    C["SentenceTransformer"]

    D["XGBoost"]

    E{"Confidence?"}

    F["Local Verdict"]

    G[("Redis")]

    H{"Cached?"}

    I["Cached Result"]

    J["Tavily Search"]

    K["Gemini Verification"]

    L["Save to Redis<br/>48 Hours"]

    M["Final Verdict"]

    A --> B
    B --> C
    C --> D
    D --> E

    E -->|"High"| F
    F --> M

    E -->|"Low"| G
    G --> H

    H -->|"Yes"| I
    I --> M

    H -->|"No"| J
    J --> K
    K --> L
    L --> M

---

Redis Caching

Redis is used to avoid repeating expensive web searches and Gemini calls.

First Request

Claim
 ↓
Redis MISS
 ↓
Tavily
 ↓
Gemini
 ↓
Save to Redis
 ↓
TTL: 48 Hours

Same / Similar Request Later

Claim
 ↓
Redis HIT
 ↓
Cached Result

This reduces:

- Repeated Tavily searches
- Repeated Gemini calls
- Gemini token consumption
- Verification latency
- External API usage

Why 48 Hours?

News can change quickly, so verification results are cached for 48 hours and then automatically expire.

---

Image Verification

PressIQ can also verify newspaper images.

flowchart LR

    IMAGE["Newspaper Image"]

    OCR["EasyOCR"]

    CLEAN["OCR Cleanup"]

    CLAIM["Extracted Claim"]

    ML["Local ML"]

    VERIFY["Verification"]

    IMAGE --> OCR
    OCR --> CLEAN
    CLEAN --> CLAIM
    CLAIM --> ML
    ML --> VERIFY

The image pipeline is:

Image
 ↓
EasyOCR
 ↓
OCR Cleanup
 ↓
Claim Extraction
 ↓
Local ML
 ↓
Redis / Web Verification

---

Tech Stack

Category| Technology
Backend| FastAPI, Python
ML| XGBoost, SentenceTransformers
OCR| EasyOCR, Pillow
LLM| Google Gemini Flash
Web Search| Tavily
Cache| Redis
Frontend| React, Vite, Tailwind CSS

---

API

"POST /analyze"

Analyze a text claim.

{
  "text": "Food Safety and Standards Authority of India directs discontinuation of misleading labels."
}

Example response:

{
  "prediction": "REAL",
  "confidence_score": 0.892,
  "verified_by": "RAG Web Check",
  "can_explain": true,
  "latency_ms": 1120.45
}

"POST /analyze-image"

Upload and analyze a newspaper image.

Content-Type: multipart/form-data

file: <image>

"POST /explain"

Generate a detailed explanation for a claim.

{
  "text": "Claim snippet or extracted headline"
}

---

Optimization

PressIQ has three main execution paths.

1. Fast Path

Local ML
   ↓
High Confidence
   ↓
Verdict

No external API call.

2. Cached Path

Local ML
   ↓
Low Confidence
   ↓
Redis HIT
   ↓
Cached Verdict

No Tavily or Gemini call.

3. Verification Path

Local ML
   ↓
Low Confidence
   ↓
Redis MISS
   ↓
Tavily
   ↓
Gemini
   ↓
Redis
   ↓
Verdict

The expensive path is therefore limited to:

«Low-confidence + uncached requests»

---

Engineering Highlights

Confidence-Based Cascade

Local ML acts as the first verification layer. Only uncertain predictions move to the more expensive verification pipeline.

Redis Verification Cache

Recently verified results are cached for 48 hours, reducing repeated searches and Gemini token usage.

Structured LLM Output

Gemini returns structured JSON, making the response easier for the backend to validate and process.

Multimodal Input

Both text and newspaper images ultimately enter the same verification pipeline.

Cost-Aware Architecture

Instead of calling an LLM for every request, PressIQ only uses external AI verification when local ML is uncertain and no cached result is available.

---

Architecture in One Line

«PressIQ uses local ML for speed, Redis for reuse, and live RAG + Gemini for uncertain claims that need fresh verification.»

---

What PressIQ Demonstrates

ML • NLP • OCR • RAG • LLMs • Redis • REST APIs

A practical AI system designed to balance:

Speed · Cost · Accuracy · Scalability