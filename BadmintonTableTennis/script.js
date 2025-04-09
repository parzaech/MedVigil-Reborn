var animationWords = ['Tell us what ails you.', 'AI in Medicine.', 'We will fix you.', ':)'];
var animationInterval;

function switchToImages() {
  // 1. Fade out animated text
  $('.word').animate({ opacity: 0 }, 600, function() {
    $(this).hide();
    
    // 2. Fade in text image
    $('#text-image')
      .css('opacity', 0)
      .show()
      .animate({ opacity: 1 }, 800, function() {
        
        // 3. After text image appears, show secondary image
        $('#secondary-image')
          .css('opacity', 0)
          .show()
          .animate({ opacity: 1 }, 800);
      });
  });
}
function runAnimationOnce() {
  var part,
      i = 0,
      offset = 0,
      len = animationWords.length,
      forwards = true,
      skip_count = 0,
      skip_delay = 15,
      speed = 70;

  animationInterval = setInterval(function() {
    if (forwards) {
      if (offset >= animationWords[i].length) {
        if (++skip_count == skip_delay) {
          forwards = false;
          skip_count = 0;
        }
      }
    } else {
      if (offset == 0) {
        forwards = true;
        i++;
        offset = 0;
        if (i >= len) {
          clearInterval(animationInterval);
          setTimeout(switchToImages, 500); // Changed from switchToImage
          return;
        }
      }
    }
    
    part = animationWords[i].substr(0, offset);
    if (skip_count == 0) forwards ? offset++ : offset--;
    $('.word').text(part);
  }, speed);
}

$(document).ready(function() {
  runAnimationOnce();
});

var video = document.querySelector("#videoElement");
var startVideo = document.querySelector("#start");
var stopVideo = document.querySelector("#stop");

var mediaRecorder;
var recordedChunks = [];

// Start recording
function start() {
    recordedChunks = []; // Clear previous recordings

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
            video.srcObject = stream;
            mediaRecorder = new MediaRecorder(stream);

            mediaRecorder.ondataavailable = function (event) {
                if (event.data.size > 0) {
                    recordedChunks.push(event.data);
                    console.log("📼 Video chunk added.");
                }
            };

            mediaRecorder.onstop = function () {
                console.log("🎥 Recording stopped. Preparing to upload...");

                if (recordedChunks.length === 0) {
                    console.error("❌ No recorded video available.");
                    return;
                }

                // Ensure all chunks are processed before upload
                setTimeout(uploadVideo, 500);
            };

            mediaRecorder.start();
        })
        .catch(error => console.error("❌ Error accessing camera:", error));
}

function stop() {
    if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop(); // This triggers onstop()
    }
}

function uploadVideo() {
    if (recordedChunks.length === 0) {
        console.error("❌ No recorded video available.");
        return;
    }

    let blob = new Blob(recordedChunks, { type: "video/webm" });
    let formData = new FormData();
    formData.append("file", blob, "recorded-video.webm");

    fetch("http://localhost:8000/upload_video", {
        method: "POST",
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        console.log("📄 Transcription received:", data.transcription);
        document.getElementById("userPrompt").value = data.transcription;
    })
    .catch(error => console.error("❌ Video upload failed:", error));

    recordedChunks = []; // Clear recorded data after upload
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
    outputDiv.classList.add("waiting");  // Add loading effect

    // Simulate processing time
    setTimeout(() => {
        outputDiv.classList.remove("waiting");
        outputDiv.innerHTML = "✅ MedVigil process complete!";
    }, 3000);
    let socket = new WebSocket("ws://localhost:8000/ws");

    socket.onopen = function () {
        outputDiv.innerHTML = "✅ Connected! Running MedVigil...<br>";
    };

    socket.onmessage = function (event) {
        console.log("📩 Received from WebSocket:", event.data);

        let newMessage = document.createElement("p");
        newMessage.textContent = event.data;
        outputDiv.appendChild(newMessage);

        // Auto-scroll to latest message
        outputDiv.scrollTop = outputDiv.scrollHeight;
    };

    socket.onerror = function (event) {
        console.error("❌ WebSocket error:", event);
        outputDiv.innerHTML = "<p style='color: red;'>❌ Error connecting to WebSocket!</p>";
    };

    socket.onclose = function (event) {
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

// NER Section
// Function to show entities in popup
function showEntitiesPopup(entities) {
  // Populate entity tags
  populateEntitySection('symptomEntities', entities.symptoms);
  populateEntitySection('medicationEntities', entities.medications); 
  populateEntitySection('conditionEntities', entities.conditions);
  
  // Show popup
  document.getElementById('entityPopup').style.display = 'flex';
  
  // Add analytics event
  logEntityAnalysis(entities);
}

// Helper function to create entity tags
function populateEntitySection(containerId, entities) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  
  if (entities && entities.length > 0) {
    entities.forEach(entity => {
      const tag = document.createElement('div');
      tag.className = 'entity-tag';
      tag.textContent = entity;
      container.appendChild(tag);
    });
  } else {
    container.innerHTML = '<span class="no-entities">None detected</span>';
  }
}

// Close popup handlers
document.querySelector('.close-btn').addEventListener('click', () => {
  document.getElementById('entityPopup').style.display = 'none';
});

// Close when clicking outside content
document.getElementById('entityPopup').addEventListener('click', (e) => {
  if (e.target === document.getElementById('entityPopup')) {
    document.getElementById('entityPopup').style.display = 'none';
  }
});

// the summarize function
async function summarizeText() {
  const inputText = document.getElementById('output').innerText;

  try {
    const response = await fetch('http://localhost:8000/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: inputText })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Summarization failed");
    }

    const data = await response.json();
    console.log("Summary:", data);

    // Display summary in #output div
    let html = '<h3>Summary:</h3><ul>';
    data.points.forEach((point, idx) => {
      html += `<li><strong>Point ${idx + 1}:</strong> ${point}</li>`;
    });
    html += '</ul>';

    document.getElementById('output').innerHTML = html;

  } catch (error) {
    console.error("Summarization error:", error);
    document.getElementById('output').innerHTML = `
      <div class="error">
        ${error.message}
      </div>
    `;
  }
}


// Example usage with your NLP function
async function analyzeAndShowEntities() {
  const query = document.getElementById('userPrompt').value;
  const entities = await analyzeMedicalQuery(query); // Your NLP function
  showEntitiesPopup(entities);
}


