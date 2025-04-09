from flask import Flask, request, jsonify, after_this_request
from transformers import AutoTokenizer, AutoModelForTokenClassification
import torch
from flask_cors import CORS  # Add this import

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Load model once at startup
try:
    tokenizer = AutoTokenizer.from_pretrained("ai4bharat/IndicNER")
    model = AutoModelForTokenClassification.from_pretrained("ai4bharat/IndicNER")
    print("Model loaded successfully")
except Exception as e:
    print(f"Error loading model: {str(e)}")
    model = None

@app.route('/analyze', methods=['POST'])
def analyze():
    @after_this_request
    def add_header(response):
        response.headers['Access-Control-Allow-Origin'] = '*'
        return response

    if not model:
        return jsonify({"error": "Model not loaded"}), 500

    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({"error": "Missing 'text' parameter"}), 400

    text = data['text'].strip()
    if not text:
        return jsonify({"error": "Text cannot be empty"}), 400

    try:
        # Tokenize and predict
        inputs = tokenizer(text, return_tensors="pt")
        with torch.no_grad():
            logits = model(**inputs).logits
        predictions = torch.argmax(logits, dim=-1)[0].tolist()

        # Convert to labels
        labels = [model.config.id2label[p] for p in predictions]

        # Align with words
        word_ids = inputs.word_ids()
        previous_word_idx = None
        word_labels = []
        current_word_tokens = []

        for word_idx, label in zip(word_ids, labels):
            if word_idx is None:
                continue
            if word_idx != previous_word_idx:
                if current_word_tokens:
                    word_labels.append(current_word_tokens[0])  # Take first tag
                    current_word_tokens = []
                previous_word_idx = word_idx
            current_word_tokens.append(label)

        if current_word_tokens:
            word_labels.append(current_word_tokens[0])

        # Split text into words (approximate - may need language-specific tokenization)
        words = text.split()

        # Ensure alignment (this may need adjustment for your specific language)
        if len(words) != len(word_labels):
            return jsonify({
                "error": f"Tokenization mismatch (words: {len(words)}, labels: {len(word_labels)})",
                "words": words,
                "tags": word_labels[:len(words)]  # Truncate if needed
            })

        return jsonify({
            "words": words,
            "tags": word_labels
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)