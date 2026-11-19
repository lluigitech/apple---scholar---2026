import os
from pathlib import Path

if not os.environ.get("ML_SERVICE_API_KEY"):
    raise RuntimeError("ML_SERVICE_API_KEY must be configured for the deployed ML service.")

from ml_api import create_app

model_dir = Path(
    os.environ.get("MODEL_DIR", Path(__file__).resolve().parent / "letter_model_clean")
).resolve()

if (model_dir / "letter_model.pt").is_file() and (model_dir / "letter_tok").is_dir():
    from predict_letter import predict_letter

    app = create_app(predict_letter)
else:
    app = create_app()
