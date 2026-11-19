import os

if not os.environ.get("ML_SERVICE_API_KEY"):
    raise RuntimeError("ML_SERVICE_API_KEY must be configured for the deployed ML service.")

from ml_api import create_app
from predict_letter import predict_letter

app = create_app(predict_letter)
