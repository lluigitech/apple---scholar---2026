import csv
import itertools
import math
import sys
from collections import Counter
from pathlib import Path


CLASSIFIER_DIR = Path(__file__).resolve().parent
ML_SERVICE_DIR = CLASSIFIER_DIR.parent
TRAINING_SPLIT = CLASSIFIER_DIR / "dataset_splits" / "train.csv"
sys.path.insert(0, str(CLASSIFIER_DIR))

from experimental_letter_classifier import load_models, predict_letter


STYLE_LABELS = ("Formal", "Moderate", "Informal")
SENTIMENT_LABELS = ("Negative", "Neutral", "Positive")
LOW_CONFIDENCE = 0.50
HIGH_CONFIDENCE = 0.70
STYLE_CODES = {"Formal": "FOR", "Moderate": "MOD", "Informal": "INF"}
SENTIMENT_CODES = {"Negative": "NEG", "Neutral": "NEU", "Positive": "POS"}

TOPICS = (
    (
        "Academic updates and grades",
        "ACA",
        "I attended classes regularly, completed assignments, and reviewed lessons for upcoming assessments.",
    ),
    (
        "Family updates",
        "FAM",
        "I shared household responsibilities with my family while making time to complete my schoolwork.",
    ),
    (
        "Self-improvement",
        "IMP",
        "I practiced organizing my schedule and followed a regular study routine.",
    ),
    (
        "Challenges and difficulties",
        "CHL",
        "I managed several deadlines while balancing schoolwork and responsibilities at home.",
    ),
    (
        "Achievements",
        "ACH",
        "I completed a difficult project and reached a goal I had set earlier in the term.",
    ),
    (
        "General monthly updates",
        "GEN",
        "I kept a steady monthly routine, attended scheduled activities, and made time for schoolwork.",
    ),
)

SENTIMENT_FRAMES = {
    "Positive": (
        "I felt encouraged by the progress and was glad to see my effort make a difference.",
        "I was pleased with what went well and felt hopeful about continuing.",
        "The progress gave me confidence, and I am grateful for the chance to keep learning.",
    ),
    "Neutral": (
        "I recorded the results and identified the next steps.",
        "The month followed a steady routine, and I noted what was completed.",
        "I reviewed the situation and made a list of the tasks to continue.",
    ),
    "Negative": (
        "I felt discouraged by the setbacks and worried about what comes next.",
        "The difficulties left me frustrated, and I was concerned about keeping up.",
        "I was disappointed with the outcome and found the situation stressful.",
    ),
}

STYLE_FRAMES = {
    "Formal": {
        "openers": (
            "For this month's letter, I would like to report that ",
            "During the reporting month, ",
            "I am writing to share that ",
        ),
        "closers": (
            "I intend to continue this approach in the coming month.",
            "I will maintain this routine and remain committed to steady progress.",
            "I will continue addressing these priorities with care.",
        ),
    },
    "Moderate": {
        "openers": (
            "This month, ",
            "For my monthly update, ",
            "Over the past month, ",
        ),
        "closers": (
            "I plan to keep working on this next month.",
            "Next month, I will continue with the same routine.",
            "I will keep working toward steady progress.",
        ),
    },
    "Informal": {
        "openers": (
            "So, this month, ",
            "Honestly, this month, ",
            "This month was pretty busy, and ",
        ),
        "closers": (
            "I'll keep at it next month.",
            "I'm gonna try to stay on top of it next month.",
            "I'll keep working on it and see how it goes.",
        ),
    },
}


def build_samples():
    samples = []
    for style, sentiment, topic in itertools.product(
        STYLE_LABELS,
        SENTIMENT_LABELS,
        TOPICS,
    ):
        topic_name, topic_code, topic_text = topic
        style_index = STYLE_LABELS.index(style)
        sentiment_index = SENTIMENT_LABELS.index(sentiment)
        topic_index = [item[1] for item in TOPICS].index(topic_code)
        variant = (style_index + sentiment_index + topic_index) % 3

        text = " ".join(
            (
                STYLE_FRAMES[style]["openers"][variant] + topic_text,
                SENTIMENT_FRAMES[sentiment][variant],
                STYLE_FRAMES[style]["closers"][variant],
            )
        )
        sample_code = (
            f"{STYLE_CODES[style]}-{SENTIMENT_CODES[sentiment]}-{topic_code}"
        )
        samples.append({
            "code": sample_code,
            "intended_style": style,
            "intended_sentiment": sentiment,
            "topic": topic_name,
            "text": text,
        })
    return samples


def validate_prediction(result, code):
    assert result.get("success") is True, f"{code}: prediction failed"

    prediction = result.get("sentiment")
    assert isinstance(prediction, dict), f"{code}: missing sentiment output"
    assert prediction.get("prediction") in SENTIMENT_LABELS, f"{code}: invalid sentiment label"

    confidence = prediction.get("confidence")
    assert isinstance(confidence, (int, float)) and not isinstance(confidence, bool), (
        f"{code}: sentiment confidence is not numeric"
    )
    assert math.isfinite(confidence), f"{code}: sentiment confidence is not finite"
    assert 0 <= confidence <= 1, f"{code}: sentiment confidence is out of range"

    probabilities = prediction.get("probabilities")
    assert isinstance(probabilities, dict), f"{code}: missing sentiment probabilities"
    values = list(probabilities.values())
    assert all(
        isinstance(value, (int, float)) and math.isfinite(value) and 0 <= value <= 1
        for value in values
    ), f"{code}: sentiment probabilities contain invalid values"
    assert math.isclose(sum(values), 1.0, rel_tol=1e-5, abs_tol=1e-5), (
        f"{code}: sentiment probabilities do not sum to 1"
    )


def percent(count, total):
    return 100 * count / total if total else 0.0


def print_distribution(title, predictions, classes):
    print(f"\n{title}")
    print(f"{'Class':<14} {'Count':>7} {'Percent':>10} {'Confidence mean (min-max)':>32}")
    print("-" * 67)
    for label in classes:
        rows = [row for row in predictions if row["label"] == label]
        mean_confidence = (
            sum(row["confidence"] for row in rows) / len(rows) if rows else 0.0
        )
        confidence_range = (
            f"{mean_confidence * 100:.2f}% "
            f"({min(row['confidence'] for row in rows) * 100:.2f}-"
            f"{max(row['confidence'] for row in rows) * 100:.2f}%)"
            if rows else "n/a"
        )
        print(
            f"{label:<14} {len(rows):>7} "
            f"{percent(len(rows), len(predictions)):>9.2f}% "
            f"{confidence_range:>32}"
        )


def print_group_distribution(title, samples, group_key, prediction_key, classes):
    print(f"\n{title}")
    heading = f"{'Illustrative group':<29} {'N':>4}"
    for label in classes:
        heading += f" {label + ' n/%':>19}"
    print(heading)
    print("-" * len(heading))

    groups = sorted({sample[group_key] for sample in samples})
    for group in groups:
        group_rows = [sample for sample in samples if sample[group_key] == group]
        predicted = [sample[prediction_key] for sample in group_rows]
        cells = ""
        for label in classes:
            count = sum(row["label"] == label for row in predicted)
            cells += f" {f'{count} / {percent(count, len(group_rows)):.1f}%':>19}"
        print(f"{group:<29} {len(group_rows):>4}{cells}")


def print_training_label_context():
    print("\nTraining-class context")
    if not TRAINING_SPLIT.is_file():
        print("Sentiment training-label distribution: unavailable (training split not found).")
        return

    sentiment_counts = Counter()
    row_count = 0
    with TRAINING_SPLIT.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if "sentiment_label" not in (reader.fieldnames or []):
            print("Sentiment training-label distribution: unavailable (label column not found).")
            return
        for row in reader:
            row_count += 1
            sentiment_counts[(row.get("sentiment_label") or "").strip()] += 1

    print(f"Sentiment training rows: {row_count}; label counts: {dict(sentiment_counts)}")
    print("Only the sentiment_label column was aggregated; sample/text columns were not printed.")


def run_audit():
    samples = build_samples()
    assert len(samples) >= 50, "Audit must include at least 50 synthetic English samples."
    assert len({sample["code"] for sample in samples}) == len(samples), "Sample codes must be unique."

    print("Loading actual sentiment model and TF-IDF vectorizer...")
    models = load_models()
    print("Actual model artifacts loaded.")

    for sample in samples:
        result = predict_letter(sample["text"], models)
        validate_prediction(result, sample["code"])
        sample["sentiment_prediction"] = {
            "label": result["sentiment"]["prediction"],
            "confidence": result["sentiment"]["confidence"],
            "probabilities": result["sentiment"]["probabilities"],
        }
    repeated = predict_letter(samples[0]["text"], models)
    validate_prediction(repeated, "repeatability")
    assert repeated == predict_letter(samples[0]["text"], models), (
        "Identical input did not produce repeatable predictions."
    )

    for invalid_text in ("", "   ", None, 123):
        result = predict_letter(invalid_text, models)
        assert result.get("success") is False and result.get("error"), (
            "Empty or invalid input was not rejected safely."
        )

    sentiment_rows = [sample["sentiment_prediction"] for sample in samples]
    print_training_label_context()
    print_distribution("Overall sentiment prediction distribution", sentiment_rows, SENTIMENT_LABELS)

    print_group_distribution(
        "Sentiment predictions by illustrative writing style",
        samples,
        "intended_style",
        "sentiment_prediction",
        SENTIMENT_LABELS,
    )
    print_group_distribution(
        "Sentiment predictions by illustrative intended sentiment",
        samples,
        "intended_sentiment",
        "sentiment_prediction",
        SENTIMENT_LABELS,
    )

    print("\nPer-sample predictions (intended labels are illustrative, not ground truth)")
    print(
        f"{'Code':<12} {'Intended style':<12} {'Intended sentiment':<20} "
        f"{'Sentiment prediction':<22} {'Sentiment conf.':>14}"
    )
    print("-" * 82)
    for sample in samples:
        sentiment = sample["sentiment_prediction"]
        print(
            f"{sample['code']:<12} {sample['intended_style']:<12} "
            f"{sample['intended_sentiment']:<20} {sentiment['label']:<22} "
            f"{sentiment['confidence'] * 100:>13.2f}%"
        )

    print("\nConfidence bands by task (model thresholds; not calibrated certainty)")
    low = sum(row["confidence"] < LOW_CONFIDENCE for row in sentiment_rows)
    moderate = sum(LOW_CONFIDENCE <= row["confidence"] < HIGH_CONFIDENCE for row in sentiment_rows)
    high = sum(row["confidence"] >= HIGH_CONFIDENCE for row in sentiment_rows)
    print(
        f"Sentiment: Low (<50%) {low} ({percent(low, len(sentiment_rows)):.2f}%); "
        f"Moderate (50-<70%) {moderate} ({percent(moderate, len(sentiment_rows)):.2f}%); "
        f"High (>=70%) {high} ({percent(high, len(sentiment_rows)):.2f}%)."
    )

    print("\nMean class probability over all synthetic samples")
    for label in SENTIMENT_LABELS:
        mean_probability = sum(row["probabilities"][label] for row in sentiment_rows) / len(sentiment_rows)
        print(f"  {label}: {mean_probability * 100:.2f}%")

    print(
        "\nPASS: actual sentiment model loaded; "
        f"{len(samples)} English-only synthetic samples validated; "
        "repeatability and invalid-input checks passed."
    )
    print(
        "Interpretation limit: intended labels are illustrative; "
        "this audit is not accuracy evaluation and has no verified ground truth."
    )
    return samples


if __name__ == "__main__":
    run_audit()
