# Import the reusable prediction function.
from predict_letter import predict_letter


# Sample monthly letter for testing.
sample_letter = """
Dear Apple Scholars,

I am happy to share my academic progress this month.
I completed my school activities and assignments on time.
I learned new skills in programming and improved my understanding
of our lessons. I also participated in our class activities.

At home, I continue to help my family with household chores.
Although I sometimes experience difficulties with my studies,
I try to manage my time properly and remain motivated.

Thank you for your continued support and encouragement.

Sincerely,
Your Scholar
"""


# Run the model prediction.
result = predict_letter(sample_letter)

assert set(result["categories"]) == {
    "Paragraph Structure",
    "Academic Update",
    "Self-Improvement",
    "Family Update",
    "Difficulty Update",
}
assert all(0 <= score <= 15 for score in result["categories"].values())
assert 0 <= result["body_score"] <= result["max_score"] == 75
assert result["sentiment"] in {"Negative", "Neutral", "Positive"}
assert result["academic_tone"] in {"Formal", "Moderate", "Informal"}

# Display the prediction results.
print("\n========== MODULE PREDICTION ==========")

# Display the individual category scores.
for category, score in result["categories"].items():
    print(f"{category}: {score}/15")

# Display the overall score and classifications.
print("--------------------------------------")
print(f"Body Score: {result['body_score']}/{result['max_score']}")
print(f"Percentage: {result['percentage']}%")
print(f"Sentiment: {result['sentiment']}")
print(f"Academic Tone: {result['academic_tone']}")
print("======================================")