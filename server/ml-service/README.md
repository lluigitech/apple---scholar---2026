# Apple Scholar letter ML service

The service loads the XLM-RoBERTa checkpoint once per worker and exposes:

- `GET /health`
- `POST /predict` with `{"letter":"..."}`

Run locally from this directory after installing `requirements.txt`:

```powershell
python ml_api.py
```

The trained checkpoint and tokenizer are intentionally excluded from Git because
the checkpoint is over 1 GB. Keep `letter_model.pt` and the `letter_tok`
directory together in a model directory, then set `MODEL_DIR` to that directory.

For a separate Render web service, use this directory as its root:

- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn --bind 0.0.0.0:$PORT --workers 1 --threads 4 --timeout 120 wsgi:app`
- Health check path: `/health`

Attach persistent storage or otherwise provide the checkpoint and tokenizer to
that service, and set its `MODEL_DIR` to their location. On the Node backend,
set `ML_SERVICE_URL` to the Python service's base URL (without `/predict`).
Generate a shared `ML_SERVICE_API_KEY` and set the same value on both services.
The ML service needs enough memory to load the XLM-RoBERTa model and checkpoint.
