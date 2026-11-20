import os

if not os.environ.get("ML_SERVICE_API_KEY"):
    raise RuntimeError("ML_SERVICE_API_KEY must be configured for the deployed ML service.")

from ml_api import create_app

app = create_app()
