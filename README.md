PressIQ — AI-Powered Hybrid Fake News Detection & Verification Engine

PressIQ is a full-stack, two-tier hybrid news verification system designed to analyze news claims, headlines, and newspaper image clippings in real time.

It combines local machine learning, OCR, live web retrieval, LLM-based verification, and Redis caching into a cascading verification pipeline.

The core design principle is:

«Use fast local inference first, retrieve live evidence only when necessary, and cache verification results to avoid repeated API calls and token consumption.»

---

🏗️ High-Level System Architecture

flowchart TB

    USER[User]

    subgraph FRONTEND["Frontend"]
        UI[React + Vite + Tailwind]
    end

    subgraph BACKEND["FastAPI Application"]
        API[FastAPI API]

        subgraph TIER1["Tier 1 — Local ML"]
            EMB[SentenceTransformer<br/>all-MiniLM-L6-v2]
            XGB[XGBoost Classifier]
        end

        subgraph IMAGE["Image Processing"]
            PRE[Pillow Preprocessing]
            OCR[EasyOCR]
            CLEAN[OCR Cleanup]
        end

        REDIS[(Redis Cache<br/>TTL: 48 Hours)]
    end

    subgraph TIER2["Tier 2 — Live Verification"]
        TAVILY[Tavily Search API]
        GEMINI[Google Gemini Flash]
    end

    WEB[Live Web Sources]

    USER --> UI
    UI --> API

    API --> PRE
    PRE --> OCR
    OCR --> CLEAN
    CLEAN --> EMB

    API --> EMB
    EMB --> XGB

    XGB -->|High Confidence| RESULT[Final Verdict]

    XGB -->|Low Confidence| REDIS

    REDIS -->|Cache Hit| RESULT
    REDIS -->|Cache Miss| TAVILY

    TAVILY --> WEB
    WEB --> TAVILY
    TAVILY --> GEMINI

    GEMINI -->|Verified Result| REDIS
    REDIS --> RESULT

    RESULT --> UI

---

🔄 Complete Verification Data Flow

PressIQ uses a three-stage optimization strategy:

1. Local ML handles high-confidence claims.
2. Redis handles previously verified/retrieved claims.
3. Tavily + Gemini handles genuinely new or uncertain claims.

flowchart TD

    START([User Request])

    INPUT{Input Type}

    TEXT[Text Claim]
    IMAGE[News Image]

    OCR[EasyOCR]
    CLEAN[OCR Text Cleanup]

    EMB[SentenceTransformer<br/>Embedding]
    XGB[XGBoost Classifier]

    CONF{Local Confidence<br/>>= Threshold?}

    LOCAL[Return Local Verdict]

    CACHE[Redis Cache<br/>48 Hour TTL]

    HIT{Similar Article /<br/>Claim Found?}

    CACHED[Return Cached<br/>Verification Result]

    SEARCH[Tavily Web Search]

    SOURCES[Retrieved Articles<br/>+ Evidence]

    GEMINI[Gemini Flash<br/>Structured Verification]

    SAVE[Save Result to Redis<br/>TTL = 48 Hours]

    FINAL[Final Verified Verdict]

    START --> INPUT

    INPUT -->|Text| TEXT
    INPUT -->|Image| IMAGE

    IMAGE --> OCR
    OCR --> CLEAN
    CLEAN --> EMB

    TEXT --> EMB

    EMB --> XGB
    XGB --> CONF

    CONF -->|High Confidence| LOCAL
    LOCAL --> FINAL

    CONF -->|Low Confidence| CACHE

    CACHE --> HIT

    HIT -->|Cache Hit| CACHED
    CACHED --> FINAL

    HIT -->|Cache Miss| SEARCH

    SEARCH --> SOURCES
    SOURCES --> GEMINI

    GEMINI --> SAVE
    SAVE --> FINAL

---

⚡ Redis Semantic Cache

Redis is a key part of PressIQ's cost and latency optimization strategy.

When a low-confidence claim requires live verification, PressIQ first checks Redis before making new Tavily or Gemini requests.

                    Low Confidence Claim
                            │
                            ▼
                     Generate Cache Key
                            │
                            ▼
                       Redis Lookup
                       /          \
                      /            \
                 CACHE HIT       CACHE MISS
                    │                │
                    ▼                ▼
             Cached Result      Tavily Search
                    │                │
                    │                ▼
                    │          Retrieved Articles
                    │                │
                    │                ▼
                    │             Gemini
                    │                │
                    │                ▼
                    │          Verification
                    │                │
                    │                ▼
                    │          Save to Redis
                    │            TTL = 48h
                    │                │
                    └────────┬───────┘
                             ▼
                       Final Response

Why Redis?

Without caching:

Same Claim
   ↓
Tavily Search
   ↓
Gemini
   ↓
API Tokens Consumed

If another user asks the same or sufficiently similar claim:

Same Claim
   ↓
Tavily Search AGAIN
   ↓
Gemini AGAIN
   ↓
More Tokens

With Redis:

First Request
     ↓
Tavily
     ↓
Gemini
     ↓
Redis ← Save Verification
     ↓
     48 Hours
     ↓
Second Similar Request
     ↓
Redis HIT
     ↓
Cached Verification

This reduces:

- Repeated Tavily searches
- Repeated Gemini calls
- Gemini input/output token consumption
- Verification latency
- Dependency on external APIs

---

🧠 Cache-Aware RAG Architecture

The RAG layer therefore behaves as:

flowchart LR

    CLAIM[Uncertain Claim]

    KEY[Cache Key / Similarity Lookup]

    REDIS[(Redis)]

    HIT{Cache Hit?}

    RESULT[Cached Evidence + Verdict]

    SEARCH[Tavily Search]

    ARTICLES[Relevant Articles]

    LLM[Gemini Flash]

    VERIFIED[Verified Result]

    SAVE[Redis<br/>TTL 48 Hours]

    CLAIM --> KEY
    KEY --> REDIS
    REDIS --> HIT

    HIT -->|YES| RESULT

    HIT -->|NO| SEARCH
    SEARCH --> ARTICLES
    ARTICLES --> LLM
    LLM --> VERIFIED
    VERIFIED --> SAVE
    SAVE --> RESULT

---

🔁 RAG + Redis Sequence

sequenceDiagram

    participant U as User
    participant API as FastAPI
    participant ML as Local ML
    participant R as Redis
    participant T as Tavily
    participant W as Web
    participant G as Gemini

    U->>API: Submit claim

    API->>ML: Classify claim
    ML-->>API: Prediction + confidence

    alt High Local Confidence
        API-->>U: Local Verdict

    else Low Local Confidence

        API->>R: Lookup cached verification

        alt Cache Hit
            R-->>API: Cached result
            API-->>U: Cached Verdict + Evidence

        else Cache Miss

            API->>T: Search claim
            T->>W: Retrieve articles
            W-->>T: Relevant sources
            T-->>API: Search results

            API->>G: Claim + Retrieved evidence
            G-->>API: Structured verification

            API->>R: Save result (TTL 48h)

            API-->>U: Verified Verdict + Sources

        end
    end

---

🧩 Component Architecture

flowchart TB

    USER[User]

    subgraph CLIENT["React Frontend"]
        REACT[React + Vite]
        TAILWIND[Tailwind CSS]
    end

    subgraph APP["PressIQ Backend"]
        FASTAPI[FastAPI]

        ML[SentenceTransformer<br/>+ XGBoost]

        OCR[EasyOCR<br/>+ Pillow]

        REDIS[(Redis<br/>48h Cache)]
    end

    subgraph EXTERNAL["External Services"]
        TAVILY[Tavily Search API]
        GEMINI[Google Gemini Flash]
        SOURCES[Live News / Web Sources]
    end

    USER --> REACT
    REACT --> FASTAPI

    FASTAPI --> ML
    FASTAPI --> OCR

    ML -->|Low Confidence| REDIS

    REDIS -->|Cache Miss| TAVILY
    TAVILY --> SOURCES
    SOURCES --> TAVILY

    TAVILY --> GEMINI

    GEMINI --> REDIS

    REDIS --> FASTAPI
    ML --> FASTAPI
    OCR --> FASTAPI

    FASTAPI --> REACT

---

🐳 Container Architecture

Redis is also included as an independent container in the Docker Compose deployment.

flowchart TB

    CLIENT[Client]

    subgraph DOCKER["Docker Compose"]

        FRONTEND[Frontend Container<br/>React]

        BACKEND[Backend Container<br/>FastAPI + ML + OCR]

        REDIS[(Redis Container<br/>Cache)]

    end

    TAVILY[Tavily API]
    GEMINI[Gemini API]

    CLIENT --> FRONTEND
    FRONTEND --> BACKEND

    BACKEND --> REDIS

    BACKEND -->|Cache Miss| TAVILY
    TAVILY --> GEMINI

    GEMINI --> BACKEND
    BACKEND --> REDIS

The architecture remains stateless at the application layer while Redis provides a shared cache accessible by the backend.

---

📦 Docker Compose

A simplified deployment looks like:

services:

  frontend:
    build: ./frontend
    depends_on:
      - backend

  backend:
    build: ./backend
    depends_on:
      - redis

  redis:
    image: redis:7-alpine

The backend can be scaled horizontally while all instances share the same Redis cache:

                    ┌─────────────┐
                    │   Redis     │
                    │   48h TTL   │
                    └──────┬──────┘
                           │
             ┌─────────────┼─────────────┐
             │             │             │
             ▼             ▼             ▼
        FastAPI #1    FastAPI #2    FastAPI #3

This prevents each backend instance from maintaining an isolated cache.

---

📊 Optimization Strategy

PressIQ optimizes the verification pipeline at multiple levels:

Layer| Optimization| Benefit
Tier 1| SentenceTransformer + XGBoost| Fast local inference
Cascade| Confidence threshold| Avoid unnecessary RAG
Cache| Redis| Avoid repeated searches
Cache TTL| 48 hours| Reuse recent verification results
Retrieval| Tavily| Targeted live evidence
LLM| Gemini Flash| Fast structured verification
Output| JSON schema| Reliable machine-readable responses
OCR| Local EasyOCR| No external OCR API cost

---

💰 Token & API Cost Optimization

The complete optimization path is:

                    Incoming Claim
                          │
                          ▼
                  Local ML Inference
                          │
                 ┌────────┴────────┐
                 │                 │
          High Confidence     Low Confidence
                 │                 │
                 ▼                 ▼
          Instant Result       Redis Lookup
                                   │
                          ┌────────┴────────┐
                          │                 │
                       HIT               MISS
                          │                 │
                          ▼                 ▼
                    Cached Result      Tavily
                                            │
                                            ▼
                                         Gemini
                                            │
                                            ▼
                                      Redis Cache
                                       TTL = 48h
                                            │
                                            ▼
                                     Final Result

Therefore, the expensive path is only:

«Low ML confidence + Redis cache miss»

This is an important architectural property of PressIQ.

---

⏱️ Latency Strategy

PressIQ has three possible execution paths:

Path 1 — Local ML

Request
  ↓
Embedding
  ↓
XGBoost
  ↓
Verdict

Goal: sub-30ms local inference path.

Path 2 — Redis Cache Hit

Request
  ↓
Local ML
  ↓
Redis
  ↓
Cached Verification

This avoids another Tavily/Gemini round trip.

Path 3 — New Verification

Request
  ↓
Local ML
  ↓
Redis MISS
  ↓
Tavily
  ↓
Gemini
  ↓
Redis
  ↓
Final Verdict

This is the most expensive path and is intentionally reserved for claims that require fresh verification.

---

🛠️ Engineering Highlights

1. Confidence-Based Model Cascading

Rather than treating the LLM as the first-line classifier, PressIQ uses ML confidence to determine whether external verification is necessary.

2. Retrieval Result Caching

Redis stores recently verified claims and their supporting evidence for 48 hours, reducing duplicate retrieval and LLM calls.

3. Shared Cache Across Backend Instances

Redis operates as a centralized cache so horizontally scaled FastAPI instances can reuse the same verification results.

4. Structured LLM Output

Gemini responses use structured JSON output to make verification results deterministic and easier for the backend to validate.

5. OCR → Verification Pipeline

Image processing is separated into:

Image
 ↓
Preprocessing
 ↓
EasyOCR
 ↓
OCR Cleanup
 ↓
Claim Extraction
 ↓
Hybrid Verification

6. Stateless Application Design

The backend does not depend on in-memory user sessions. Redis is used for shared caching rather than application-specific session state.


⭐ What PressIQ Demonstrates

PressIQ brings together:

Machine Learning + NLP + OCR + RAG + LLMs + Caching + REST APIs + Docker

into a single production-oriented architecture.

The central engineering idea is simple:

«Don't pay the cost of live AI verification when a fast local model or a recent cached verification can answer the request.»

This allows PressIQ to balance latency, verification quality, API usage, and scalability rather than optimizing for only one metric.