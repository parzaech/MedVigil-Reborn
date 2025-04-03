var words = ['Tell us what ails you.', 'AI in Medicine.','We will fix you.', ':)'],
    part,
    i = 0,
    offset = 0,
    len = words.length,
    forwards = true,
    skip_count = 0,
    skip_delay = 15,
    speed = 70;

var wordflick = function () {
  setInterval(function () {
    if (forwards) {
      if (offset >= words[i].length) {
        ++skip_count;
        if (skip_count == skip_delay) {
          forwards = false;
          skip_count = 0;
        }
      }
    }
    else {
      if (offset == 0) {
        forwards = true;
        i++;
        offset = 0;
        if (i >= len) {
          i = 0;
        }
      }
    }
    part = words[i].substr(0, offset);
    if (skip_count == 0) {
      if (forwards) {
        offset++;
      }
      else {
        offset--;
      }
    }
    $('.word').text(part);
  },speed);
};

$(document).ready(function () {
  wordflick();
});

var video = document.querySelector("#videoElement");
var startVideo = document.querySelector("#start");
var stopVideo = document.querySelector("#stop");

var mediaRecorder;
var recordedChunks = [];

// Request camera and microphone access
if (navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(function (stream) {
            video.srcObject = stream;
        })
        .catch(function (error) {
            console.log("Error accessing media devices:", error);
        });
}

// Start recording
function start() {
    if (navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(function (stream) {
                video.srcObject = stream;

                // Initialize MediaRecorder
                mediaRecorder = new MediaRecorder(stream, {
                    mimeType: "video/webm; codecs=vp9,opus", // Specify codecs for better compatibility
                    bitsPerSecond: 2500000 // Adjust bitrate for quality
                });

                // Handle data availability
                mediaRecorder.ondataavailable = function (e) {
                    if (e.data.size > 0) {
                        recordedChunks.push(e.data); // Store recorded chunks
                    }
                };

                // Handle recording stop
                mediaRecorder.onstop = function () {
                    // Create a Blob from the recorded chunks
                    var blob = new Blob(recordedChunks, { type: "video/webm" });

                    // Generate a dynamic filename with a timestamp
                    var timestamp = new Date().toISOString().replace(/[:.]/g, "-");
                    var filename = `recorded-video-${timestamp}.webm`;

                    // Create a download link
                    var url = URL.createObjectURL(blob);
                    var a = document.createElement("a");
                    document.body.appendChild(a);
                    a.style = "display: none";
                    a.href = url;
                    a.download = filename;
                    a.click(); // Trigger the download
                    window.URL.revokeObjectURL(url); // Clean up

                    // Clear recorded chunks for the next recording
                    recordedChunks = [];
                };

                // Start recording
                mediaRecorder.start();
            })
            .catch(function (error) {
                console.log("Error accessing media devices:", error);
            });
    }
}

// Stop recording
function stop() {
    if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop(); // Stop the recording
    }

    // Stop all tracks in the stream
    var stream = video.srcObject;
    var tracks = stream.getTracks();

    for (var i = 0; i < tracks.length; i++) {
        var track = tracks[i];
        track.stop(); // Stop each track
    }

    video.srcObject = null; // Clear the video source
}

// Add event listeners to buttons
startVideo.addEventListener("click", start, false);
stopVideo.addEventListener("click", stop, false);




function sendPrompt() {
    let userPrompt = document.getElementById("userPrompt").value;

    if (!userPrompt) {
        alert("Please enter a query!");
        return;
    }

    // Debugging log
    console.log("📤 Sending prompt:", userPrompt);

    fetch("http://localhost:8000/save_prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userPrompt })
    })
    .then(response => response.json())  // Ensure response is parsed
    .then(data => {
        console.log("📝 Server Response:", data);
        if (data.message) {
            alert("✅ Prompt saved successfully!");
        } else {
            alert("❌ Error: " + (data.error || "Unknown error"));
        }
    })
    .catch(error => {
        console.error("❌ Fetch error:", error);
        alert("❌ Error sending prompt!");
    });
}


function startMedVigil() {
let outputDiv = document.getElementById("output");
outputDiv.innerHTML = "🔄 Connecting to MedVigil...<br>";

let socket = new WebSocket("ws://localhost:8000/ws");

socket.onopen = function() {
    outputDiv.innerHTML = "✅ Connected! Running MedVigil...<br>";
};

socket.onmessage = function(event) {
    console.log("📩 Received from WebSocket:", event.data);
    
    // Create a new paragraph for each message to maintain readability
    let newMessage = document.createElement("p");
    newMessage.textContent = event.data;
    outputDiv.appendChild(newMessage);

    // Auto-scroll to latest message
    outputDiv.scrollTop = outputDiv.scrollHeight;
};

socket.onerror = function(event) {
    console.error("❌ WebSocket error:", event);
    outputDiv.innerHTML = "<p style='color: red;'>❌ Error connecting to WebSocket!</p>";
};

socket.onclose = function(event) {
    if (event.wasClean) {
        console.log("✅ WebSocket closed cleanly.");
        outputDiv.innerHTML += "<p>✅ Process completed!</p>";
    } else {
        console.error("🚨 WebSocket closed unexpectedly. Retrying...");
        outputDiv.innerHTML = "<p style='color: orange;'>⚠️ Connection lost. Retrying in 3 seconds...</p>";
        setTimeout(startMedVigil, 3000);  // Auto-reconnect
    }
};
}