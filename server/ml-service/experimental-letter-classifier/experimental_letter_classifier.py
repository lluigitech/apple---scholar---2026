# ============================================================
# APPLE SCHOLAR 2026
# Experimental Sentiment + Academic Tone Classifier
# Local Windows / Backend-compatible version
# ============================================================

import pickle
from pathlib import Path

# Resolve model directories relative to this Python file.
BASE_DIR = Path(__file__).resolve().parent

SENTIMENT_DIR = BASE_DIR / "sentiment_model"
TONE_DIR = BASE_DIR / "academic_tone_model"

HIGH_CONFIDENCE_THRESHOLD = 0.70
LOW_CONFIDENCE_THRESHOLD = 0.50
MINIMUM_WORD_COUNT = 20


# Load a saved pickle artifact.
def load_artifact(path):
    with open(path, "rb") as file:
        return pickle.load(file)


# Load both experimental models and their vectorizers.
def load_models(
    sentiment_dir=SENTIMENT_DIR,
    tone_dir=TONE_DIR
):
    return {
        "sentiment_vectorizer": load_artifact(
            sentiment_dir / "sentiment_tfidf_vectorizer.pkl"
        ),
        "sentiment_model": load_artifact(
            sentiment_dir / "sentiment_logistic_regression.pkl"
        ),
        "tone_vectorizer": load_artifact(
            tone_dir / "academic_tone_tfidf_vectorizer.pkl"
        ),
        "tone_model": load_artifact(
            tone_dir / "academic_tone_logistic_regression.pkl"
        )
    }


# Categorize prediction confidence.
def get_confidence_status(confidence):
    if confidence >= HIGH_CONFIDENCE_THRESHOLD:
        return "High"
    elif confidence >= LOW_CONFIDENCE_THRESHOLD:
        return "Moderate"
    return "Low"


# Predict sentiment and academic tone.
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

    # ---------------- ACADEMIC TONE ----------------

    tone_features = (
        models["tone_vectorizer"].transform([letter_text])
    )

    tone_prediction = (
        models["tone_model"].predict(tone_features)[0]
    )

    tone_probabilities = (
        models["tone_model"].predict_proba(tone_features)[0]
    )

    tone_probability_map = {
        str(label): float(probability)
        for label, probability in zip(
            models["tone_model"].classes_,
            tone_probabilities
        )
    }

    tone_confidence = float(max(tone_probabilities))

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

    if tone_confidence < LOW_CONFIDENCE_THRESHOLD:
        review_flags.append("Low academic tone confidence.")
    elif tone_confidence < HIGH_CONFIDENCE_THRESHOLD:
        review_flags.append("Moderate academic tone confidence.")

    if sentiment_prediction == "Negative":
        review_flags.append(
            "Negative sentiment detected; staff review recommended."
        )

    # ---------------- RETURN RESULTS ----------------

    return {
        "success": True,
        "model_type": "Experimental TF-IDF + Logistic Regression",
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

        "academic_tone": {
            "prediction": str(tone_prediction),
            "confidence": tone_confidence,
            "confidence_percent": round(
                tone_confidence * 100, 2
            ),
            "confidence_status": get_confidence_status(
                tone_confidence
            ),
            "probabilities": tone_probability_map
        },

        "requires_staff_review": bool(review_flags),
        "review_flags": review_flags,

        "limitations": [
            "Experimental classifiers trained using synthetic letters.",
            "Not validated for real-world student populations.",
            "Confidence scores are not calibrated certainty estimates.",
            "Not for automatic sanctions or disciplinary decisions.",
            "Concerning and uncertain cases require staff review."
        ]
    }