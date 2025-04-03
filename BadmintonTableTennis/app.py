from fastapi import FastAPI, WebSocket, Request, File, UploadFile
import os
import subprocess
import json
import whisper
from pydub import AudioSegment
from pydub.exceptions import CouldntDecodeError
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Load Whisper model once at startup
model = whisper.load_model("small")  # Change to "base", "medium", or "large" if needed

# Allow frontend to send requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this to your frontend domain if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def transcribe_audio(file_path: str) -> str:
    """Transcribes speech from an audio file using Whisper."""
    try:
        result = model.transcribe(file_path)
        return result["text"]
    except Exception as e:
        print(f"❌ Transcription error: {e}")
        return ""

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

# ✅ ADD THIS TO FIX THE 404 ERROR
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