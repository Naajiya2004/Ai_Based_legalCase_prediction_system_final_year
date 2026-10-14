import os
import re
import json
import joblib
import nltk
import numpy as np
from dotenv import load_dotenv

from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

from nltk.corpus import stopwords
from scipy.sparse import hstack, csr_matrix

# ===== GEN AI =====
from langchain_google_genai import ChatGoogleGenerativeAI

# =====================================================
# LOAD ENV VARIABLES
# =====================================================
load_dotenv()

print("🔥 LOADING HYBRID ML + GENAI FASTAPI BACKEND 🔥")

# Download NLTK data
nltk.download("stopwords", quiet=True)

# =====================================================
# BASE DIRECTORIES
# =====================================================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.join(BASE_DIR, "outputs", "models")

# =====================================================
# LOAD ML MODELS
# =====================================================
# Outcome models
svm_model = joblib.load(os.path.join(MODEL_DIR, "svm_model.pkl"))
lr_model = joblib.load(os.path.join(MODEL_DIR, "lr_model.pkl"))
tfidf = joblib.load(os.path.join(MODEL_DIR, "tfidf.pkl"))
label_encoder = joblib.load(os.path.join(MODEL_DIR, "label_encoder.pkl"))

# Judgment type models
judgment_model = joblib.load(os.path.join(MODEL_DIR, "judgment_model.pkl"))
judgment_tfidf = joblib.load(os.path.join(MODEL_DIR, "judgment_tfidf.pkl"))
judgment_encoder = joblib.load(os.path.join(MODEL_DIR, "judgment_encoder.pkl"))

# Duration models
duration_model = joblib.load(os.path.join(MODEL_DIR, "duration_model.pkl"))
duration_tfidf = joblib.load(os.path.join(MODEL_DIR, "duration_tfidf.pkl"))
duration_encoder = joblib.load(os.path.join(MODEL_DIR, "duration_encoder.pkl"))

print("✅ All ML models loaded successfully")

# =====================================================
# LOAD GENAI MODEL
# =====================================================
genai_model = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0.3,
    google_api_key=os.getenv("GOOGLE_API_KEY")
)

# =====================================================
# FASTAPI APP
# =====================================================
app = FastAPI(
    title="AI Legal Case Prediction System",
    description="Hybrid ML + GenAI system for legal case outcome prediction",
    version="2.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:5174", "http://127.0.0.1:5174",
        "http://localhost:5175", "http://127.0.0.1:5175"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================
# REQUEST MODEL
# =====================================================
class CaseRequest(BaseModel):
    case_description: str

class JudgeRemarkRequest(BaseModel):
    case_description: str
    ai_prediction: str
    ai_reasoning: str
    judge_verdict: str

# =====================================================
# TEXT CLEANING (MATCHES TRAINING PIPELINE)
# =====================================================
stop_words = set(stopwords.words("english"))
stop_words.update({
    "court", "honourable", "hon", "justice", "bench", "shri",
    "smt", "versus", "appellant", "respondent", "petitioner",
    "page", "date", "judgment", "order", "para", "paragraph",
    "supreme", "india", "high", "learned", "counsel", "advocate",
})


def clean_text(text: str) -> str:
    """
    Clean text EXACTLY matching the training pipeline.
    Must stay in sync with ml/train_model.py clean_text().
    """
    text = text.lower()
    text = re.sub(r"http\S+", " ", text)
    text = re.sub(r"page\s+\d+\s+of\s+\d+", " ", text)
    text = re.sub(r"\(\d{4}\)\s*\d+\s*[a-z]+\s*\d+", " ", text)
    text = re.sub(r"section\s+\d+[a-z]?", "section", text)
    text = re.sub(r"[^a-z\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    text = " ".join(w for w in text.split() if w not in stop_words)
    return text


# =====================================================
# FEATURE EXTRACTION FOR DURATION MODEL
# =====================================================

def extract_duration_features(text: str) -> list:
    """
    Extract the same numeric features used during duration model training.
    Must stay in sync with models/case_duration_model.py extract_features().
    """
    text_lower = text.lower()
    words = text_lower.split()

    word_count = len(words)
    section_mentions = len(re.findall(r"section\s+\d+", text_lower))

    party_words = sum(1 for w in words if w in {
        "appellant", "respondent", "petitioner", "accused",
        "complainant", "plaintiff", "defendant",
    })

    citations = len(re.findall(r"\(\d{4}\)\s*\d+\s*[a-z]+\s*\d+", text_lower))

    is_criminal = 1 if re.search(
        r"(i\.?p\.?c|cr\.?p\.?c|criminal|murder|imprisonment|fir\s+no)", text_lower
    ) else 0

    dates = len(re.findall(r"\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4}", text_lower))
    dates += len(re.findall(
        r"\d{1,2}(st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s*,?\s*\d{4}",
        text_lower
    ))

    return [word_count, section_mentions, party_words, citations, is_criminal, dates]


# =====================================================
# GENAI ANALYSIS FUNCTION
# =====================================================
def analyze_with_genai(text: str):
    prompt = f"""
You are an expert Indian legal analyst.

Analyze the following case and return STRICT JSON with:
- predicted_outcome (must be exactly "Win" or "Lose")
- prediction_confidence (a number between 0 and 100 representing percentage, e.g. 75.5)
- judgment_type (one of: Imprisonment / Fine / Dismissal / Acquittal / Compensation / Remand / Bail / Other)
- estimated_case_duration (one of: Short / Medium / Long)
- legal_reasoning (2–3 lines explaining the reasoning)
- relevant_laws (mention specific IPC / CrPC / CPC sections, or "Not specified")

Case Description:
\"\"\"{text}\"\"\"

Rules:
- Return ONLY valid JSON, nothing else
- No markdown, no code fences
- prediction_confidence MUST be a number (not a string like Low/Medium/High)
"""

    response = genai_model.invoke(prompt)
    raw = response.content.strip()
    raw = raw.replace("```json", "").replace("```", "").strip()

    try:
        parsed = json.loads(raw)

        # Ensure confidence is a numeric percentage
        conf = parsed.get("prediction_confidence", 50)
        if isinstance(conf, str):
            # Convert string like "High" to a number
            conf_map = {"low": 35.0, "medium": 60.0, "high": 85.0}
            conf = conf_map.get(conf.lower().strip(), 50.0)
        conf = round(float(conf), 2)

        return {
            "predicted_outcome": parsed.get("predicted_outcome", "Unknown"),
            "prediction_confidence": conf,
            "judgment_type": parsed.get("judgment_type", "Other"),
            "estimated_case_duration": parsed.get("estimated_case_duration", "Medium"),
            "legal_reasoning": parsed.get("legal_reasoning", ""),
            "relevant_laws": parsed.get("relevant_laws", "Not specified"),
        }
    except Exception:
        return {
            "predicted_outcome": "Unknown",
            "prediction_confidence": 50.0,
            "judgment_type": "Not Determined",
            "estimated_case_duration": "Unknown",
            "legal_reasoning": "Unable to generate reasoning.",
            "relevant_laws": "Not specified"
        }


def generate_ml_reasoning(case_text, outcome, judgment_type, duration):
    prompt = f"""
You are a legal expert.

A Machine Learning model predicted the following:
- Outcome: {outcome}
- Judgment Type: {judgment_type}
- Case Duration: {duration}

Based on the case description below, explain WHY this outcome is likely.

Case Description:
\"\"\"{case_text}\"\"\"

Rules:
- Explain in 2–3 simple lines
- Do not mention Machine Learning
- Use legal reasoning language
- Return plain text (no JSON, no markdown)
"""

    response = genai_model.invoke(prompt)
    return response.content.strip()


# =====================================================
# ROUTES
# =====================================================
@app.get("/")
def home():
    return {
        "message": "AI Legal Case Prediction API Running (v2.0)",
        "available_endpoints": {
            "ML Prediction": "/predict/ml",
            "GenAI Prediction": "/predict/genai"
        }
    }


# =====================================================
# ML BASED PREDICTION
# =====================================================
@app.post("/predict/ml")
def predict_ml(request: CaseRequest):
    raw_text = request.case_description
    clean = clean_text(raw_text)

    # --- Outcome Prediction ---
    vector = tfidf.transform([clean])

    # Use best model for prediction
    if hasattr(svm_model, "decision_function"):
        decision_score = svm_model.decision_function(vector)[0]
        outcome_idx = svm_model.predict(vector)[0]
    else:
        outcome_idx = svm_model.predict(vector)[0]
        decision_score = 0

    outcome = label_encoder.inverse_transform([outcome_idx])[0]

    # Use LR model for calibrated confidence
    lr_prob = lr_model.predict_proba(vector)[0]
    confidence = round(max(lr_prob) * 100, 2)

    # --- Judgment Type Prediction ---
    j_vec = judgment_tfidf.transform([clean])
    j_label = judgment_model.predict(j_vec)[0]
    judgment_type = judgment_encoder.inverse_transform([j_label])[0]

    # --- Case Duration Prediction ---
    d_text_vec = duration_tfidf.transform([clean])
    d_features = csr_matrix([extract_duration_features(raw_text)])
    d_combined = hstack([d_text_vec, d_features])
    d_label = duration_model.predict(d_combined)[0]
    case_duration = duration_encoder.inverse_transform([d_label])[0]

    # --- Generate Legal Reasoning via GenAI ---
    legal_reasoning = generate_ml_reasoning(
        raw_text, outcome, judgment_type, case_duration
    )

    return {
        "mode": "ML",
        "outcome": {
            "prediction": outcome,
            "confidence": f"{confidence}%"
        },
        "judgment_type": judgment_type,
        "estimated_case_duration": case_duration,
        "legal_reasoning": legal_reasoning
    }


# =====================================================
# GENAI BASED PREDICTION
# =====================================================
@app.post("/predict/genai")
def predict_genai(request: CaseRequest):
    result = analyze_with_genai(request.case_description)

    # Return in the SAME format as ML endpoint
    return {
        "mode": "GenAI",
        "outcome": {
            "prediction": result["predicted_outcome"],
            "confidence": f"{result['prediction_confidence']}%"
        },
        "judgment_type": result["judgment_type"],
        "estimated_case_duration": result["estimated_case_duration"],
        "legal_reasoning": result["legal_reasoning"],
        "relevant_laws": result["relevant_laws"]
    }


# =====================================================
# AI ASSISTED JUDGE REMARKS
# =====================================================
@app.post("/predict/judge-remarks")
def predict_judge_remarks(request: JudgeRemarkRequest):
    prompt = f"""
You are an advanced AI assistant for an Indian Supreme Court Judge.
The judge is reviewing a case and has decided to rule: "{request.judge_verdict}".

Here is the context of the case:
Case Description: "{request.case_description}"
Initial AI Prediction: "{request.ai_prediction}"
Initial AI Reasoning: "{request.ai_reasoning}"

Your task is to draft the official, highly professional closing legal remarks that the judge will publish to justify their "{request.judge_verdict}" verdict. 
Write 2 to 3 sentences max. Do NOT use markdown. Do NOT use JSON. Write it as a strict, formal legal paragraph ready to be signed by the judge.
"""

    try:
        response = genai_model.invoke(prompt)
        remarks = response.content.strip()
        return {"remarks": remarks}
    except Exception as e:
        return {"remarks": "Error generating remarks. Please type them manually."}


# =====================================================
# DIRECT RUN
# =====================================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)


#uvicorn main:app --host 127.0.0.1 --port 8000 --reload
