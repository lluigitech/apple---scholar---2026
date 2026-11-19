import os
import secrets

from flask import Flask, jsonify, request


def create_app(predictor=None, api_key=None):
    app = Flask(__name__)
    app.config["predictor"] = predictor
    app.config["api_key"] = api_key if api_key is not None else os.environ.get("ML_SERVICE_API_KEY")
    if not app.config["api_key"] and os.environ.get("NODE_ENV") == "production" and predictor is not None:
        raise RuntimeError("ML_SERVICE_API_KEY must be configured in production.")
    app.config["MAX_CONTENT_LENGTH"] = 64 * 1024

    @app.get("/health")
    def health():
        return jsonify({"status": "ready", "model": "xlm-roberta-base"})

    @app.post("/predict")
    def predict():
        expected_key = app.config["api_key"]
        if expected_key:
            supplied_key = request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
            if not secrets.compare_digest(supplied_key, expected_key):
                return jsonify({"error": "Unauthorized."}), 401

        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"error": "A JSON request body is required."}), 400

        letter = payload.get("letter")
        if letter is None:
            letter = payload.get("letter_text", payload.get("letter_content"))
        if not isinstance(letter, str) or not letter.strip():
            return jsonify({"error": "Letter text is required."}), 400

        try:
            model_predictor = app.config["predictor"]
            if model_predictor is None:
                from predict_letter import predict_letter

                model_predictor = predict_letter
                app.config["predictor"] = model_predictor
            return jsonify(model_predictor(letter))
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        except Exception:
            app.logger.exception("Letter prediction failed.")
            return jsonify({"error": "ML prediction failed."}), 500

    return app


app = create_app()


if __name__ == "__main__":
    from predict_letter import predict_letter

    app = create_app(predict_letter)
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "5001")),
        threaded=True,
    )
