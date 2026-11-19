import unittest

from ml_api import create_app


class MlApiTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app(lambda letter: {"letter": letter, "body_score": 60}).test_client()

    def test_health_reports_ready(self):
        response = self.app.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["status"], "ready")
        self.assertTrue(response.json["model_loaded"])

    def test_health_allows_bootstrap_before_model_upload(self):
        response = create_app().test_client().get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["status"], "model_missing")
        self.assertFalse(response.json["model_loaded"])

    def test_predict_accepts_letter_aliases(self):
        for field in ("letter", "letter_text", "letter_content"):
            with self.subTest(field=field):
                response = self.app.post("/predict", json={field: "Test letter"})

                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json, {"letter": "Test letter", "body_score": 60})

    def test_predict_rejects_missing_or_invalid_letter(self):
        for payload in (None, {}, {"letter": "  "}, {"letter": 123}):
            with self.subTest(payload=payload):
                response = self.app.post("/predict", json=payload)

                self.assertEqual(response.status_code, 400)
                self.assertIn("error", response.json)

    def test_predict_returns_generic_error_when_model_fails(self):
        application = create_app(lambda _letter: (_ for _ in ()).throw(RuntimeError("private detail")))
        application.logger.disabled = True
        app = application.test_client()

        response = app.post("/predict", json={"letter": "Test letter"})

        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json, {"error": "ML prediction failed."})

    def test_predict_requires_configured_api_key(self):
        app = create_app(lambda letter: {"letter": letter}, api_key="shared-secret").test_client()

        unauthorized = app.post("/predict", json={"letter": "Test letter"})
        authorized = app.post(
            "/predict",
            json={"letter": "Test letter"},
            headers={"Authorization": "Bearer shared-secret"},
        )

        self.assertEqual(unauthorized.status_code, 401)
        self.assertEqual(authorized.status_code, 200)


if __name__ == "__main__":
    unittest.main()
