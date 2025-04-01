from fastapi import FastAPI, WebSocket, Request
import asyncio
import subprocess
import json
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Allow frontend to send requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this to your frontend domain if needed
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods (GET, POST, OPTIONS, etc.)
    allow_headers=["*"],  # Allow all headers
)

@app.post("/save_prompt")
async def save_prompt(request: Request):
    """Save the user's medical query to prompt.txt"""
    try:
        data = await request.json()
        prompt = data.get("prompt", "").strip()

        if not prompt:
            return {"error": "No prompt provided"}

        # Log the received prompt
        print(f"📥 Received prompt: {prompt}")

        # Save to file
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
