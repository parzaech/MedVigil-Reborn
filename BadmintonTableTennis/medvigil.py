from prefect import flow, task
from mlx_lm import load, generate
import os

MODEL_NAME = "cnfusion/HuatuoGPT-o1-8B-Q4-mlx"
PROMPT_FILE = "prompt.txt"
RESPONSE_FILE = "response.txt"

@task
def test_llm():
    """Loads the medical model and generates a response based on user input."""
    model, tokenizer = load(MODEL_NAME)

    # Read user input from prompt.txt
    if os.path.exists(PROMPT_FILE):
        with open(PROMPT_FILE, "r") as file:
            prompt = file.read().strip()
    else:
        return "❌ No prompt file found!"

    print(f"📄 Read prompt: {prompt}")  # Debugging output

    if not prompt:
        return "❌ Prompt file is empty!"

    # Format input for the model
    if hasattr(tokenizer, "apply_chat_template") and tokenizer.chat_template is not None:
        messages = [{"role": "user", "content": prompt}]
        prompt = tokenizer.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )

    # Run the model
    response = generate(model, tokenizer, prompt=prompt, verbose=True)

    # Save output
    with open(RESPONSE_FILE, "w") as file:
        file.write(response)

    print(f"📝 Model Response: {response}")  # Debugging output


@flow(name="MedVigil Processing Flow")
def main_flow():
    """Main Prefect flow: process user input with MedVigil."""
    test_llm()

if __name__ == "__main__":
    main_flow()
