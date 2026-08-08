PressIQ — AI-Powered Hybrid Fake News Detection & Verification Engine

PressIQ is an end-to-end, two-tier fake news detection system designed to analyze text claims, headlines, and newspaper clippings in real-time.

By combining in-memory Redis caching, sub-30ms local machine learning models, and live Web-Retrieval Augmented Generation (RAG) powered by multimodal LLMs, PressIQ delivers instant results for known claims, executes ultra-fast local checks, and falls back to real-time internet searches for low-confidence headlines—all while minimizing API costs.

Simple Architectural Breakdown (How PressIQ Works)
Instead of sending every request to expensive AI services, PressIQ works like a smart multi-level filter:

Step 1: Check Redis Cache (< 5ms)
If someone asks about a headline that PressIQ has analyzed before, Redis immediately returns the saved answer in under 5 milliseconds with zero computational cost.

Step 2: Tier 1 Local ML Screening (Sub-30ms)
For new claims, a local model (SentenceTransformer + fine-tuned XGBoost) evaluates the text right on your server. If the model is 85%+ confident, it returns the prediction instantly—using 0 API tokens.

Step 3: Tier 2 Live Web RAG Fallback (600–900ms)
If the local model isn't confident (less than 85%), PressIQ triggers a real-time web search via the Tavily Search API to fetch ground-truth news articles, then uses Google Gemini 2.5 Flash to verify facts and output a final JSON verdict.

Step 4: Image/OCR Preprocessing
When users upload a newspaper snippet or image, EasyOCR extracts the text, and a lightweight cleanup step fixes broken lines and columns before feeding the clean text into the pipeline.

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
                             ┌───────────────────────┐
                             │  Redis Rate Limiting  │
                             └───────────┬───────────┘
                                         │
                             ┌───────────────────────┐
                             │  Redis Cache Check    │
                             └───────────┬───────────┘
                                         │
                        ┌────────────────┴────────────────┐
                        │                                 │
                   (Cache HIT)                       (Cache MISS)
                        │                                 │
              [ Return Cached Verdict ]       [ Tier 1: Local XGBoost Engine ]
                   (Sub-5ms)                  (SentenceTransformer Embeddings)
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
                                                                           │
                                                                 [ Save Result to Redis ]