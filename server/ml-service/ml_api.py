import os
import secrets
import sys
import threading
from pathlib import Path

from flask import Flask, jsonify, request


def load_letter_classifier():
    classifier_dir = Path(__file__).resolve().parent / "letter-classifier"
    if not classifier_dir.is_dir():
        raise FileNotFoundError("Letter classifier directory is unavailable.")

    classifier_path = str(classifier_dir)
    if classifier_path not in sys.path:
        sys.path.insert(0, classifier_path)

    from experimental_letter_classifier import load_models, predict_letter

    models = load_models(
        sentiment_dir=classifier_dir / "sentiment_model",
    )
    return lambda letter: predict_letter(letter, models)


def create_app(classifier=None, api_key=None):
    app = Flask(__name__)
    app.config["classifier"] = classifier
    app.config["classifier_lock"] = threading.Lock()
    app.config["api_key"] = api_key if api_key is not None else os.environ.get("ML_SERVICE_API_KEY")
    if not app.config["api_key"] and os.environ.get("NODE_ENV") == "production":
        raise RuntimeError("ML_SERVICE_API_KEY must be configured in production.")
    app.config["MAX_CONTENT_LENGTH"] = 64 * 1024

    def authorize_request():
        expected_key = app.config["api_key"]
        if not expected_key:
            return None
        supplied_key = request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
        if not secrets.compare_digest(supplied_key, expected_key):
            return jsonify({"error": "Unauthorized."}), 401
        return None

    def get_letter_payload():
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return None, (jsonify({"error": "A JSON request body is required."}), 400)

        letter = payload.get("letter")
        if letter is None:
            letter = payload.get("letter_text", payload.get("letter_content"))
        if not isinstance(letter, str) or not letter.strip():
            return None, (jsonify({"error": "Letter text is required."}), 400)
        return letter, None

    def get_classifier():
        classifier_predictor = app.config["classifier"]
        if classifier_predictor is None:
            with app.config["classifier_lock"]:
                classifier_predictor = app.config["classifier"]
                if classifier_predictor is None:
                    classifier_predictor = load_letter_classifier()
                    app.config["classifier"] = classifier_predictor
        return classifier_predictor

    @app.get("/health")
    def health():
        try:
            get_classifier()
        except Exception:
            app.logger.exception("TF-IDF classifier health check failed.")
            return jsonify({
                "status": "unavailable",
                "model": "TF-IDF + Logistic Regression",
                "classifier_loaded": False,
            }), 503

        return jsonify({
            "status": "ready",
            "model": "TF-IDF + Logistic Regression",
            "classifier_loaded": True,
            "sentiment_model": "TF-IDF + Logistic Regression",
        })

    @app.post("/classify")
    def classify():
        authorization_error = authorize_request()
        if authorization_error:
            return authorization_error
        letter, payload_error = get_letter_payload()
        if payload_error:
            return payload_error

        try:
            result = get_classifier()(letter)
            if not isinstance(result, dict) or result.get("success") is not True:
                raise ValueError("Letter classifier returned an invalid result.")
            return jsonify(result)
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        except Exception:
            app.logger.exception("Automated letter classification failed.")
            return jsonify({"error": "Automated letter classification unavailable."}), 503

    return app


app = create_app()


if __name__ == "__main__":
    app = create_app()
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "5001")),
        threaded=True,
    )
