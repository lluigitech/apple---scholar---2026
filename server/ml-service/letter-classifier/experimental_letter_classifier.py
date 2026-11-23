# ============================================================
# APPLE SCHOLAR 2026
# Automated Letter Sentiment Classifier
# Local Windows / Backend-compatible version
# ============================================================

import pickle
from pathlib import Path

# Resolve model directories relative to this Python file.
BASE_DIR = Path(__file__).resolve().parent

SENTIMENT_DIR = BASE_DIR / "sentiment_model"

HIGH_CONFIDENCE_THRESHOLD = 0.70
LOW_CONFIDENCE_THRESHOLD = 0.50
MINIMUM_WORD_COUNT = 20


# Load a saved pickle artifact.
def load_artifact(path):
    with open(path, "rb") as file:
        return pickle.load(file)


# Load the sentiment model and its vectorizer.
def load_models(sentiment_dir=SENTIMENT_DIR):
    return {
        "sentiment_vectorizer": load_artifact(
            sentiment_dir / "sentiment_tfidf_vectorizer.pkl"
        ),
        "sentiment_model": load_artifact(
            sentiment_dir / "sentiment_logistic_regression.pkl"
        )
    }


# Categorize prediction confidence.
def get_confidence_status(confidence):
    if confidence >= HIGH_CONFIDENCE_THRESHOLD:
        return "High"
    elif confidence >= LOW_CONFIDENCE_THRESHOLD:
        return "Moderate"
    return "Low"


# Predict letter sentiment.
def predict_letter(letter_text, models=None):

    if not isinstance(letter_text, str) or not letter_text.strip():
        return {
            "success": False,
            "error": "Letter text is empty or invalid."
        }

    if models is None:
        models = load_models()

    word_count = len(letter_text.split())

    # ---------------- SENTIMENT ----------------

    sentiment_features = (
        models["sentiment_vectorizer"].transform([letter_text])
    )

    sentiment_prediction = (
        models["sentiment_model"].predict(sentiment_features)[0]
    )

    sentiment_probabilities = (
        models["sentiment_model"].predict_proba(sentiment_features)[0]
    )

    sentiment_probability_map = {
        str(label): float(probability)
        for label, probability in zip(
            models["sentiment_model"].classes_,
            sentiment_probabilities
        )
    }

    sentiment_confidence = float(max(sentiment_probabilities))

    # ---------------- STAFF REVIEW FLAGS ----------------

    review_flags = []

    if word_count < MINIMUM_WORD_COUNT:
        review_flags.append(
            "Short letter; prediction may be unreliable."
        )

    if sentiment_confidence < LOW_CONFIDENCE_THRESHOLD:
        review_flags.append("Low sentiment confidence.")
    elif sentiment_confidence < HIGH_CONFIDENCE_THRESHOLD:
        review_flags.append("Moderate sentiment confidence.")

    if sentiment_prediction == "Negative":
        review_flags.append(
            "Negative sentiment detected; staff review recommended."
        )

    # ---------------- RETURN RESULTS ----------------

    return {
        "success": True,
        "model_type": "Automated Letter Sentiment Classifier (TF-IDF + Logistic Regression)",
        "word_count": word_count,

        "sentiment": {
            "prediction": str(sentiment_prediction),
            "confidence": sentiment_confidence,
            "confidence_percent": round(
                sentiment_confidence * 100, 2
            ),
            "confidence_status": get_confidence_status(
                sentiment_confidence
            ),
            "probabilities": sentiment_probability_map
        },

        "requires_staff_review": bool(review_flags),
        "review_flags": review_flags,

        "limitations": [
            "Classifiers trained using synthetic letters.",
            "Not validated for real-world student populations.",
            "Confidence scores are not calibrated certainty estimates.",
            "Not for automatic sanctions or disciplinary decisions.",
            "Concerning and uncertain cases require staff review."
        ]
    }