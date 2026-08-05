Here is a complete, publication-ready README.md tailored specifically for PressIQ. It highlights the technical stack, architectural decisions, hybrid cascading pipeline, and containerization setup to showcase to interviewers.

PressIQ — AI-Powered Hybrid Fake News Detection & Verification Engine
PressIQ is a full-stack, two-tier hybrid verification system designed to analyze news claims, headlines, and newspaper image clippings in real-time. By combining lightweight local machine learning models with live web-retrieval augmented generation (RAG) and multimodal LLMs, PressIQ balances sub-30ms execution speed with ground-truth verification accuracy while minimizing API token consumption.

Key Features
Two-Tier Hybrid Cascade Architecture:

Tier 1 (Sub-30ms Local Screening): Uses SentenceTransformer (all-MiniLM-L6-v2) embeddings paired with a fine-tuned XGBoost classifier to instantly screen claims locally with zero API token overhead.

Tier 2 (Live Web RAG Fallback): When Tier 1 confidence drops below the threshold, the system triggers live search retrieval via Tavily API combined with structured JSON evaluation via Google Gemini Flash to verify facts against real-time news reporting.

Multimodal News Image & OCR Support:

Local image text extraction using CPU-optimized EasyOCR with downscaling preprocessing.

Lightweight LLM text-sanitization step that reconstructs multi-column newspaper layouts and fixes OCR noise before verification.

On-Demand AI Explanations & Source Citation: Provides detailed, context-aware breakdowns and live web links verifying why a claim is categorized as REAL or FAKE.

Scalable Infrastructure: Containerized using Docker and load-balanced with Nginx using a least_conn distribution strategy to handle high traffic without requiring user registration.

Architecture Pipeline
Plaintext
                                [ User Input ]
                                ┌──────┴──────┐
                                │             │
                        (Text Claim)    (Image Input)
                                │             │
                                │        [ EasyOCR ]
                                │             │
                                │     [ LLM OCR Cleanup ]
                                │             │
                                └──────┬──────┘
                                       │
                        [ Tier 1: Local XGBoost Engine ]
                        (SentenceTransformer Embeddings)
                                       │
                      ┌────────────────┴────────────────┐
                      │                                 │
             Confidence >= Threshold           Confidence < Threshold
                      │                                 │
            [ Instant Verdict ]              [ Tier 2: RAG Verification ]
           (Sub-30ms / 0 Tokens)             ┌──────────┴──────────┐
                                             │                     │
                                      [ Tavily Web Search ] [ Gemini LLM ]
                                             │                     │
                                             └──────────┬──────────┘
                                                        │
                                               [ Final Verified Verdict ]
Tech Stack
Backend & Machine Learning
Framework: Python 3.11, FastAPI, Uvicorn

ML / NLP: XGBoost, sentence-transformers (all-MiniLM-L6-v2), Scikit-learn, NumPy, Pandas

Vision / OCR: EasyOCR, Pillow (PIL)

LLM & RAG: Google Gemini 2.5 Flash, Tavily Async Search API

Frontend
Framework: React.js, Vite, Tailwind CSS

Icons: Lucide React

DevOps & Infrastructure
Containerization: Docker, Docker Compose

Load Balancer & Reverse Proxy: Nginx (least_conn routing algorithm)

Getting Started Locally
Prerequisites
Docker & Docker Compose installed

Python 3.11+ and Node.js 18+ (if running without Docker)

Tavily API Key & Google Gemini API Key

1. Clone the Repository
Bash
git clone https://github.com/your-username/PressIQ.git
cd PressIQ
2. Environment Setup
Create a .env file in the root directory:

Code snippet
TAVILY_API_KEY=your_tavily_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
3. Run with Docker Compose (Recommended)
Launch the load-balanced backend cluster with 2 scaled backend replicas:

Bash
docker compose up --build --scale backend=2 -d
The backend API will be available at http://localhost:8000 via the Nginx reverse proxy.

API Reference
1. Analyze Text / Claim
Endpoint: POST /analyze

Request Body:

JSON
{
  "text": "Food Safety and Standards Authority of India directs discontinuation of misleading labels."
}
Response:

JSON
{
  "prediction": "REAL",
  "confidence_score": 0.892,
  "verified_by": "RAG Web Check (Low Local Confidence)",
  "can_explain": true,
  "token_usage": {
    "prompt_tokens": 160,
    "candidates_tokens": 7,
    "total_tokens": 167
  },
  "latency_ms": 1120.45
}
2. Analyze News Image / Graphic
Endpoint: POST /analyze-image

Form-Data: file: <image_file>

Response: Includes extracted OCR text, confidence metrics, and verified verdict.

3. Fetch Detailed Explanation
Endpoint: POST /explain

Request Body:

JSON
{
  "text": "Claim snippet or extracted headline"
}
Engineering Highlights
Token & Latency Optimization: By setting thinking_budget=0 on Gemini 2.5 Flash calls, response latency dropped from ~4 seconds to sub-800ms while preventing internal reasoning token bloat.

Structured Output Enforcement: Uses native JSON schema output configurations (response_mime_type="application/json") to prevent text-parser misclassifications during RAG verification.

Stateless Horizontal Scaling: The application uses Nginx Layer 7 load balancing to route requests statelessly across scalable backend instances without needing session storage or user sign-ups.