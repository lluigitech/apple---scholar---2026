# ==============================================
# APPLE SCHOLAR 2026 - LETTER PREDICTION MODULE
# ==============================================

import os
from pathlib import Path

import torch
import torch.nn as nn
from transformers import AutoConfig, AutoModel, AutoTokenizer


# ----------------------------------------------
# 1. SETUP
# ----------------------------------------------

# Set the device to CPU since this PC does not have CUDA.
DEVICE = torch.device("cpu")

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = Path(os.environ.get("MODEL_DIR", BASE_DIR / "letter_model_clean")).resolve()
CHECKPOINT_PATH = MODEL_DIR / "letter_model.pt"
TOKENIZER_PATH = MODEL_DIR / "letter_tok"
ENCODER_NAME = "xlm-roberta-base"

# Define the 5 scoring categories.
CATEGORY_NAMES = [
    "Paragraph Structure",
    "Academic Update",
    "Self-Improvement",
    "Family Update",
    "Difficulty Update"
]

# Define the sentiment labels.
SENTIMENT_LABELS = [
    "Negative",
    "Neutral",
    "Positive"
]

# Define the academic tone labels.
TONE_LABELS = [
    "Formal",
    "Moderate",
    "Informal"
]


# ----------------------------------------------
# 2. MODEL ARCHITECTURE
# ----------------------------------------------

class LetterNet(nn.Module):

    def __init__(self):
        super().__init__()

        # Build the encoder architecture; trained weights come from the checkpoint.
        config = AutoConfig.from_pretrained(ENCODER_NAME)
        self.enc = AutoModel.from_config(config)

        # Get the encoder's hidden size.
        hidden = self.enc.config.hidden_size

        # Add dropout to help reduce overfitting.
        self.dropout = nn.Dropout(0.1)

        # Create regression head for 5 scoring categories.
        self.reg = nn.Linear(hidden, 5)

        # Create sentiment classification head.
        self.sent = nn.Linear(hidden, 3)

        # Create academic tone classification head.
        self.tone = nn.Linear(hidden, 3)


    def forward(self, encoded):

        # Extract contextual embeddings from XLM-RoBERTa.
        output = self.enc(**encoded).last_hidden_state

        # Get the attention mask for valid tokens.
        mask = encoded["attention_mask"].unsqueeze(-1).float()

        # Calculate mean pooling using valid tokens only.
        pooled = (output * mask).sum(1) / mask.sum(1).clamp(min=1.0)

        # Apply dropout before the prediction heads.
        pooled = self.dropout(pooled)

        # Return category scores, sentiment logits, and tone logits.
        return (
            torch.sigmoid(self.reg(pooled)),
            self.sent(pooled),
            self.tone(pooled)
        )


# ----------------------------------------------
# 3. LOAD THE MODEL AND TOKENIZER
# ----------------------------------------------

print("Loading Apple Scholar ML model...")

if not CHECKPOINT_PATH.is_file():
    raise FileNotFoundError(f"Trained model checkpoint not found: {CHECKPOINT_PATH}")
if not TOKENIZER_PATH.is_dir():
    raise FileNotFoundError(f"Trained tokenizer not found: {TOKENIZER_PATH}")

tokenizer = AutoTokenizer.from_pretrained(str(TOKENIZER_PATH), local_files_only=True)
model = LetterNet()

# Load the trained model weights.
checkpoint = torch.load(
    CHECKPOINT_PATH,
    map_location=DEVICE,
    weights_only=True,
    mmap=True
)

# Apply the trained weights to the model.
model.load_state_dict(checkpoint, assign=True)

# Move the model to the CPU.
model.to(DEVICE)

# Set the model to evaluation mode.
model.eval()

print("Apple Scholar ML model loaded successfully!")


# ----------------------------------------------
# 4. PREDICTION FUNCTION
# ----------------------------------------------

def predict_letter(letter_text):

    if not isinstance(letter_text, str) or not letter_text.strip():
        raise ValueError("Letter text cannot be empty.")

    encoded = tokenizer(
        letter_text,
        truncation=True,
        max_length=512,
        padding=True,
        return_tensors="pt"
    )

    encoded = {key: value.to(DEVICE) for key, value in encoded.items()}

    # Disable gradient calculations for inference.
    with torch.no_grad():

        # Get all 3 model predictions.
        score_output, sentiment_output, tone_output = model(encoded)

    category_scores = (score_output[0] * 15).tolist()

    # Round each category score to 2 decimal places.
    category_scores = [
        round(float(score), 2)
        for score in category_scores
    ]

    total_score = round(sum(category_scores), 2)

    percentage = round((total_score / 75) * 100, 2)

    sentiment_index = int(sentiment_output.argmax(dim=1).item())

    tone_index = int(tone_output.argmax(dim=1).item())

    sentiment = SENTIMENT_LABELS[sentiment_index]
    academic_tone = TONE_LABELS[tone_index]

    return {
        "categories": {
            CATEGORY_NAMES[i]: category_scores[i]
            for i in range(5)
        },
        "body_score": total_score,
        "max_score": 75,
        "percentage": percentage,
        "sentiment": sentiment,
        "academic_tone": academic_tone
    }
