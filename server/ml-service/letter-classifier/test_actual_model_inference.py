import math
import sys
from pathlib import Path


CLASSIFIER_DIR = Path(__file__).resolve().parent
ML_SERVICE_DIR = CLASSIFIER_DIR.parent
sys.path.insert(0, str(CLASSIFIER_DIR))
sys.path.insert(0, str(ML_SERVICE_DIR))

from experimental_letter_classifier import load_models, predict_letter
from ml_api import create_app


SAMPLES = [
    (
        "English formal academic update",
        "This month I attended my classes consistently and completed each assigned activity before the deadline. I reviewed difficult lessons every evening and asked questions when I needed clarification. My recent assessments show steady progress. I will continue following my study schedule and preparing carefully for the next set of examinations.",
    ),
    (
        "English casual personal update",
        "This month was busy but pretty good. I kept up with most of my classes, finished my assignments, and spent some time practicing problems that used to confuse me. I still need to organize my schedule better, so next month I plan to start tasks earlier and take short breaks when I feel tired.",
    ),
    (
        "English neutral factual report",
        "During the reporting period, I attended scheduled lessons and submitted the required activities. I completed readings for two subjects and prepared notes for the next lessons. There were no major changes to my routine. I plan to maintain regular attendance and complete upcoming work according to the class schedule.",
    ),
    (
        "English grateful family update",
        "My family helped me keep a quiet place for studying this month. We shared household responsibilities so I could finish schoolwork on time. I appreciate their patience and encouragement, especially during examination week. I also helped with chores whenever my schedule allowed. Their support motivates me to stay focused and responsible.",
    ),
    (
        "English challenge and recovery",
        "I had difficulty balancing several deadlines with responsibilities at home. At first I felt overwhelmed and worried that I would miss an activity. I wrote down the tasks, asked a teacher to clarify one instruction, and completed the work in smaller steps. I am still improving my schedule and will keep using that plan.",
    ),
    (
        "English achievement and reflection",
        "I was pleased with my progress this month because I understood topics that had been challenging earlier in the term. I practiced after class, checked my mistakes, and tried the exercises again. I also learned that asking questions early saves time. I want to keep building this habit while remaining open to feedback.",
    ),
    (
        "Filipino school and study update",
        "Ngayong buwan ay regular akong pumasok sa klase at natapos ko ang mga gawain sa bawat asignatura. Naglaan ako ng oras sa pagbabasa ng mga aralin at nagtanong sa guro kapag may bahagi na hindi malinaw. Mas maayos na ang aking paghahanda para sa pagsusulit. Ipagpapatuloy ko ang pag-aaral nang regular.",
    ),
    (
        "Filipino family and responsibilities",
        "Nagtulungan kami ng aking pamilya sa mga gawaing bahay ngayong buwan. Pagkatapos ng klase ay tumutulong ako sa paghahanda ng pagkain at saka tinatapos ang aking takdang-aralin. Nauunawaan nila kapag kailangan kong mag-aral at nagbibigay sila ng oras para makapagpahinga ako. Nagpapasalamat ako sa kanilang suporta at pagsisikap.",
    ),
    (
        "Taglish school and self-improvement",
        "This month, mas naging consistent ako sa pag-aaral. I reviewed my notes after class and finished the activities before the due date. May ilang lessons na mahirap intindihin, kaya nagtanong ako at nag-practice ulit sa bahay. I still need to manage my time better, pero gagawa ako ng weekly schedule next month.",
    ),
    (
        "Taglish difficulty and neutral reflection",
        "Medyo naging challenging ang schedule ko dahil sabay-sabay ang ilang school activities. I listed the deadlines, divided the work into smaller tasks, and asked for clarification when needed. Hindi man naging perfect ang lahat, natapos ko ang mga pangunahing gawain. Next month, sisimulan ko nang mas maaga ang projects para hindi magmadali.",
    ),
]

SENTIMENT_LABELS = {"negative", "neutral", "positive"}


def assert_prediction_is_valid(result, sample_code):
    assert result.get("success") is True, f"{sample_code}: prediction did not succeed"

    sentiment = result.get("sentiment")
    assert isinstance(sentiment, dict), f"{sample_code}: missing sentiment result"
    assert sentiment.get("prediction", "").lower() in SENTIMENT_LABELS, (
        f"{sample_code}: invalid sentiment label"
    )

    confidence = sentiment.get("confidence")
    assert isinstance(confidence, (int, float)) and not isinstance(confidence, bool), (
        f"{sample_code}: sentiment confidence is not numeric"
    )
    assert math.isfinite(confidence), f"{sample_code}: sentiment confidence is not finite"
    assert 0 <= confidence <= 1, f"{sample_code}: sentiment confidence is out of range"

    probabilities = sentiment.get("probabilities")
    assert isinstance(probabilities, dict) and probabilities, (
        f"{sample_code}: sentiment probabilities are missing"
    )
    probability_values = list(probabilities.values())
    assert all(
        isinstance(value, (int, float))
        and math.isfinite(value)
        and 0 <= value <= 1
        for value in probability_values
    ), f"{sample_code}: sentiment contains invalid probabilities"
    assert math.isclose(sum(probability_values), 1.0, rel_tol=1e-5, abs_tol=1e-5), (
        f"{sample_code}: sentiment probabilities do not sum to 1"
    )


def main():
    print("Loading actual sentiment model and TF-IDF vectorizer...")
    models = load_models()
    print("Model artifacts loaded.")

    results = []
    for index, (sample_style, letter_text) in enumerate(SAMPLES, start=1):
        sample_code = f"S{index:02d}"
        result = predict_letter(letter_text, models)
        assert_prediction_is_valid(result, sample_code)
        results.append((sample_code, sample_style, result))

    repeated = predict_letter(SAMPLES[0][1], models)
    assert_prediction_is_valid(repeated, "repeatability")
    assert repeated == results[0][2], "Identical input did not produce identical predictions."

    for invalid_text in ("", "   ", None, 123):
        result = predict_letter(invalid_text, models)
        assert result.get("success") is False and result.get("error"), (
            "Empty or invalid input was not rejected safely."
        )

    api_key = "local-actual-inference-test-key"
    app = create_app(api_key=api_key)
    app.testing = True
    test_client = app.test_client()
    api_response = test_client.post(
        "/classify",
        json={"letter": SAMPLES[0][1]},
        headers={"Authorization": f"Bearer {api_key}"},
    )
    assert api_response.status_code == 200, (
        f"/classify returned HTTP {api_response.status_code}: {api_response.get_json()}"
    )
    api_prediction = api_response.get_json()
    assert_prediction_is_valid(api_prediction, "API")
    assert api_prediction["sentiment"]["prediction"] == results[0][2]["sentiment"]["prediction"]
    assert "academic_tone" not in api_prediction

    for payload in (None, {}, {"letter": "  "}, {"letter": 123}):
        response = test_client.post(
            "/classify",
            json=payload,
            headers={"Authorization": f"Bearer {api_key}"},
        )
        assert response.status_code == 400, "The /classify endpoint accepted invalid input."

    print("\nActual sentiment inference results (fictional samples; no text or personal data shown):")
    print(f"{'Code':<6} {'Sample style':<38} {'Sentiment':<12} {'Confidence':>10}")
    print("-" * 70)
    for sample_code, sample_style, result in results:
        sentiment = result["sentiment"]
        print(
            f"{sample_code:<6} {sample_style:<38} "
            f"{sentiment['prediction']:<12} {sentiment['confidence'] * 100:>9.2f}%"
        )

    print("\nPASS: artifacts loaded; 10/10 outputs validated; repeatability and invalid-input checks passed.")
    print("PASS: /classify returned real-model sentiment and confidence through Flask's in-process test client.")
    print("Note: These are inference smoke tests only, not accuracy metrics or human-validated results.")


if __name__ == "__main__":
    main()
