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
- Start command: `gunicorn --bind 0.0.0.0:$PORT --workers 1 --threads 1 --timeout 120 wsgi:app`
- Health check path: `/health`

Create the service with a paid compute plan that has enough RAM for the
checkpoint, PyTorch, and inference. The $7 Starter plan's 512 MB RAM cannot load
this checkpoint (over 1 GB). A 2 GB instance is a lower-bound test, not a
guaranteed fit; move to a larger plan if it runs out of memory.

To upload the model after the service is running:

1. Attach a persistent disk mounted at `/var/data`, with at least 2 GB of space.
2. Set `MODEL_DIR=/var/data` and a generated `ML_SERVICE_API_KEY` on the Python
   service. The initial deploy can start without the model; `/health` reports
   `"model_loaded": false` until the model is present.
3. Use the Render Shell and a secure file-transfer method (Render documents
   Magic Wormhole and SCP) to put `letter_model.pt` and the `letter_tok`
   directory under `/var/data`.
4. Restart the service. When both model files are present, the worker loads the
   model once at startup. Confirm `/health` reports `"model_loaded": true`.

On the Node backend, set `ML_SERVICE_URL` to the Python service's base URL
(without `/predict`) and set the same `ML_SERVICE_API_KEY`. Keep the Python
service at one worker; the single thread also avoids simultaneous inference
requests increasing memory use.
