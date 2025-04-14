from fastapi import FastAPI, WebSocket, Request, File, UploadFile, HTTPException
import os
import subprocess
import json
import whisper
from pydub import AudioSegment
from pydub.exceptions import CouldntDecodeError
from fastapi.middleware.cors import CORSMiddleware
from transformers import pipeline, AutoModelForSeq2SeqLM, AutoTokenizer
from typing import Optional
import torch

app = FastAPI()

# Load models at startup
model = whisper.load_model("small")  # Your existing Whisper model
summarization_model = None
summarization_tokenizer = None

# Allow frontend to send requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def load_models():
    """Load summarization model at startup"""
    global summarization_model, summarization_tokenizer
    try:
        print("Loading summarization model...")
        model_name = "sshleifer/distilbart-cnn-12-6"
        summarization_tokenizer = AutoTokenizer.from_pretrained(model_name)
        summarization_model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
        print("✅ Summarization model loaded successfully")
    except Exception as e:
        print(f"❌ Failed to load summarization model: {e}")

def generate_summary(text: str) -> dict:
    """Generate a 3-point numbered summary using distilBART model"""
    try:
        if not summarization_model or not summarization_tokenizer:
            raise ValueError("Model or tokenizer not loaded.")

        # Add prompt
        prompt = "Summarize the following into three numbered points:\n" + text.strip()

        # Tokenize input
        inputs = summarization_tokenizer(prompt, return_tensors="pt", truncation=True, max_length=1024)

        # Generate output
        outputs = summarization_model.generate(
            **inputs,
            max_new_tokens=150,
            num_beams=4,
            early_stopping=True
        )

        full_summary = summarization_tokenizer.decode(outputs[0], skip_special_tokens=True)

        # Post-process: Split into numbered points
        sentences = full_summary.split('. ')
        numbered_points = [s.strip().rstrip('.') for s in sentences if s.strip()]
        numbered_points = numbered_points[:3]  # Only top 3

        return {
            "summary": full_summary,
            "points": numbered_points
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/summarize")
async def summarize(request: Request):
    """Summarization endpoint"""
    try:
        data = await request.json()
        text = data.get("text", "").strip()

        if not text:
            raise HTTPException(status_code=400, detail="Text cannot be empty")

        result = generate_summary(text)
        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Summarization failed: {str(e)}")

# Your existing endpoints below (unchanged)
@app.post("/upload_video")
async def upload_video(file: UploadFile = File(...)):
    """Receives video file, extracts audio, transcribes speech, and returns text."""
    try:
        # Generate unique filenames
        video_path = f"temp_{file.filename}"
        audio_path = "audio.wav"

        # Save uploaded video
        with open(video_path, "wb") as buffer:
            buffer.write(await file.read())

        # Convert video to WAV audio
        try:
            audio = AudioSegment.from_file(video_path)
            audio.export(audio_path, format="wav")
        except CouldntDecodeError:
            return {"error": "Failed to decode video. Unsupported format?"}

        # Transcribe audio
        transcription = transcribe_audio(audio_path)

        # Clean up files
        os.remove(video_path)
        os.remove(audio_path)

        print(f"✅ Transcription completed: {transcription}")

        return {"transcription": transcription}

    except Exception as e:
        print(f"❌ Error in upload_video: {e}")
        return {"error": str(e)}

@app.post("/save_prompt")
async def save_prompt(request: Request):
    """Saves the user's medical query to a file."""
    try:
        data = await request.json()
        prompt = data.get("prompt", "").strip()

        if not prompt:
            return {"error": "No prompt provided"}

        # Log the received prompt
        print(f"📥 Received prompt: {prompt}")

        # Save prompt to a file
        with open("prompt.txt", "w") as file:
            file.write(prompt)

        return {"message": "Prompt saved successfully"}

    except Exception as e:
        print(f"❌ Error in save_prompt: {e}")
        return {"error": str(e)}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket to send MedVigil output to frontend."""
    await websocket.accept()
    print("INFO: WebSocket connection open")

    try:
        # Start MedVigil as a subprocess
        process = subprocess.Popen(
            ["python3", "run_medvigil.py"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        while True:
            output = process.stdout.readline()
            if output == "" and process.poll() is not None:
                break  # Process finished

            if output:
                await websocket.send_text(output.strip())  # Send output to frontend

        await websocket.send_text("✅ Process completed!")
        await websocket.close()

    except Exception as e:
        print(f"❌ Error: {e}")
        await websocket.send_text(f"❌ Error: {str(e)}")

def transcribe_audio(file_path: str) -> str:
    """Transcribes speech from an audio file using Whisper."""
    try:
        result = model.transcribe(file_path)
        return result["text"]
    except Exception as e:
        print(f"❌ Transcription error: {e}")
        return ""

@app.get("/read-response")
async def read_response():
    """Serve the contents of response.txt"""
    try:
        with open("response.txt", "r") as file:
            content = file.read()
        return {"text": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))