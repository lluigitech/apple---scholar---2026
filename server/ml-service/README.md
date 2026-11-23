# Apple Scholar ML service

The Python service provides:

- `GET /health` — loads and verifies the active classifier and reports readiness.
- `POST /classify` with `{"letter":"..."}` — predicts letter sentiment.

The classifier uses the canonical TF-IDF + Logistic Regression artifacts in
`letter-classifier/sentiment_model/`. Keep the model and vectorizer files in
that directory. The Flask service loads and caches the classifier
when `/health` or `/classify` is first called.

The monthly letter body score is calculated separately by the Node backend
using Rule-Based Letter Body Scoring V3. It is not calculated by this service.
Historical submissions keep their original stored scores and breakdowns.

The classifier's confidence values are automated estimates, not calibrated
certainty values. The model has not been independently validated for accuracy
on real-world scholar letters. Do not use predictions alone for sanctions or
disciplinary decisions.

Run locally from this directory after installing `requirements.txt`:

```powershell
python ml_api.py
```

For a Render web service, use this directory as its root:

- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn --bind 0.0.0.0:$PORT --workers 1 --threads 1 --timeout 120 wsgi:app`
- Health check path: `/health`

Set `ML_SERVICE_API_KEY` on the Python service and configure the same value on
the Node backend. The WSGI entry point requires this key. Set `ML_SERVICE_URL`
on the Node backend to the Python service's base URL, without an endpoint path.
