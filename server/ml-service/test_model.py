
import os
import torch

# Define the folder containing the trained model.
MODEL_DIR = "letter_model_clean"

# Check if the trained weights exist.
model_path = os.path.join(MODEL_DIR, "letter_model.pt")

# Check if the tokenizer folder exists.
tokenizer_path = os.path.join(MODEL_DIR, "letter_tok")

print("Model weights:", os.path.exists(model_path))
print("Tokenizer:", os.path.exists(tokenizer_path))
print("PyTorch version:", torch.__version__)
print("CUDA available:", torch.cuda.is_available())
