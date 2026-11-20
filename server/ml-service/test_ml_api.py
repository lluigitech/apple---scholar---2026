import importlib
import os
import sys
import unittest
from unittest.mock import patch

from ml_api import create_app


class MlApiTests(unittest.TestCase):
    def setUp(self):
        classifier = lambda letter: {
            "success": True,
            "sentiment": {"prediction": "Neutral", "confidence": 0.8},
            "academic_tone": {"prediction": "Formal", "confidence": 0.7},
            "requires_staff_review": False,
            "review_flags": [],
        }
        self.app = create_app(classifier=classifier, api_key="test-api-key").test_client()

    def test_health_reports_active_classifier_ready(self):
        response = self.app.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["status"], "ready")
        self.assertTrue(response.json["classifier_loaded"])
        self.assertEqual(response.json["sentiment_model"], "TF-IDF + Logistic Regression")
        self.assertEqual(response.json["academic_tone_model"], "TF-IDF + Logistic Regression")

    def test_health_loads_canonical_classifier_before_reporting_ready(self):
        application = create_app(api_key="test-api-key")
        classifier = lambda _letter: {"success": True}
        with patch("ml_api.load_experimental_classifier", return_value=classifier) as loader:
            response = application.test_client().get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["status"], "ready")
        loader.assert_called_once_with()

    def test_health_reports_unavailable_when_classifier_cannot_load(self):
        application = create_app(api_key="test-api-key")
        application.logger.disabled = True
        with patch("ml_api.load_experimental_classifier", side_effect=RuntimeError("load failed")):
            response = application.test_client().get("/health")

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json["status"], "unavailable")
        self.assertFalse(response.json["classifier_loaded"])

    def test_predict_route_has_been_removed(self):
        response = self.app.post("/predict", json={"letter": "Test letter"})

        self.assertEqual(response.status_code, 404)

    def test_classify_requires_configured_api_key(self):
        unauthorized = self.app.post("/classify", json={"letter": "A test letter."})
        authorized = self.app.post(
            "/classify",
            json={"letter": "A test letter."},
            headers={"Authorization": "Bearer test-api-key"},
        )

        self.assertEqual(unauthorized.status_code, 401)
        self.assertEqual(authorized.status_code, 200)

    def test_classify_returns_sentiment_and_academic_tone(self):
        response = self.app.post(
            "/classify",
            json={"letter": "A test letter."},
            headers={"Authorization": "Bearer test-api-key"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["sentiment"]["prediction"], "Neutral")
        self.assertEqual(response.json["academic_tone"]["prediction"], "Formal")

    def test_classify_rejects_missing_or_invalid_letter(self):
        for payload in (None, {}, {"letter": "  "}, {"letter": 123}):
            with self.subTest(payload=payload):
                response = self.app.post(
                    "/classify",
                    json=payload,
                    headers={"Authorization": "Bearer test-api-key"},
                )

                self.assertEqual(response.status_code, 400)
                self.assertIn("error", response.json)

    def test_classify_returns_unavailable_when_classifier_fails(self):
        application = create_app(
            classifier=lambda _letter: (_ for _ in ()).throw(RuntimeError("private detail")),
            api_key="test-api-key",
        )
        application.logger.disabled = True
        response = application.test_client().post(
            "/classify",
            json={"letter": "A test letter."},
            headers={"Authorization": "Bearer test-api-key"},
        )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json, {"error": "Experimental classification unavailable."})

    def test_wsgi_starts_without_loading_a_model(self):
        with patch.dict(os.environ, {"ML_SERVICE_API_KEY": "test-api-key"}):
            with patch("ml_api.load_experimental_classifier", side_effect=AssertionError("unexpected eager load")):
                sys.modules.pop("wsgi", None)
                module = importlib.import_module("wsgi")

        self.assertIsNotNone(module.app)

    def test_production_requires_api_key(self):
        with patch.dict(os.environ, {"NODE_ENV": "production"}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "ML_SERVICE_API_KEY"):
                create_app()


if __name__ == "__main__":
    unittest.main()
