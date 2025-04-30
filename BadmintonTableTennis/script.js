var animationWords = ['Tell us what ails you.', 'AI in Medicine.'];
var animationInterval;


function switchToFinalMessage() {
  // Fade out the animated text
  $('.word').animate({ opacity: 0 }, 600, function() {
    $(this).hide();

    // Fade in the transparent div with your message
    $('#final-message')
      .css('opacity', 0)
      .show()
      .animate({ opacity: 1 }, 800);
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
          setTimeout(switchToFinalMessage, 500); // Changed from switchToImage
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
    // Optional toast-style popup
    const toast = document.createElement("div");
    toast.innerText = "✅ Recording Stopped!";
    toast.style.position = "fixed";
    toast.style.top = "20px"; // Top right instead of bottom
    toast.style.right = "30px";
    toast.style.background = "#28a745";
    toast.style.color = "white";
    toast.style.padding = "14px 24px";
    toast.style.borderRadius = "8px";
    toast.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.15)";
    toast.style.zIndex = "9999";
    toast.style.fontSize = "18px"; // Larger font
    toast.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"; // Nicer font
    toast.style.fontWeight = "600";
    toast.style.transition = "opacity 0.4s ease";
    
    // Optional fade-in
    toast.style.opacity = "0";
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "1";
    }, 50);
    
    // Auto-remove
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 400);
    }, 5000);
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
    // Optional toast-style popup
    const toast = document.createElement("div");
    toast.innerText = "✅ Query Submitted!";
    toast.style.position = "fixed";
    toast.style.top = "20px"; // Top right instead of bottom
    toast.style.right = "30px";
    toast.style.background = "#28a745";
    toast.style.color = "white";
    toast.style.padding = "14px 24px";
    toast.style.borderRadius = "8px";
    toast.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.15)";
    toast.style.zIndex = "9999";
    toast.style.fontSize = "18px"; // Larger font
    toast.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"; // Nicer font
    toast.style.fontWeight = "600";
    toast.style.transition = "opacity 0.4s ease";
    
    // Optional fade-in
    toast.style.opacity = "0";
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "1";
    }, 50);
    
    // Auto-remove
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 400);
    }, 5000);
    


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
            console.log("✅ Prompt saved successfully!");
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

    const loading = document.getElementById("loading");
    loading.style.display = "block"; // Show spinner

    let socket = new WebSocket("ws://localhost:8000/ws");

    socket.onopen = function () {
        outputDiv.innerHTML = "✅ Connected! Running MedVigil...<br>";
    };

    socket.onmessage = function (event) {
        console.log("📩 Received from WebSocket:", event.data);

        let newMessage = document.createElement("p");
        newMessage.textContent = event.data;
        outputDiv.appendChild(newMessage);

        // Hide spinner once the output is filled
        loading.style.display = "none";


        // Auto-scroll to latest message
        outputDiv.scrollTop = outputDiv.scrollHeight;
    };

    socket.onerror = function (event) {
        console.error("❌ WebSocket error:", event);
        outputDiv.innerHTML = "<p style='color: red;'>❌ Error connecting to WebSocket!</p>";
        loading.style.display = "none"; // Hide on error
    };

    socket.onclose = function (event) {
        loading.style.display = "none"; // Always hide spinner on close
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



// the summarize function
async function summarizeText() {
  const loading = document.getElementById('loading');
  loading.style.display = 'block'; // Show spinner

  try {
    // Fetch response.txt from backend
    const fetchTextResponse = await fetch('http://localhost:8000/read-response');
    if (!fetchTextResponse.ok) {
      throw new Error("Failed to load text from response.txt");
    }

    const textData = await fetchTextResponse.json();
    const inputText = textData.text;

    // Now send it to summarization endpoint
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

    //Display summary
    /*
    let html = '<h3>Summary:</h3><ul>';
    data.points.forEach((point, idx) => {
      html += `<li><strong>Point ${idx + 1}:</strong> ${point}</li>`;
    });
    html += '</ul>';

    document.getElementById('output').innerHTML = html;
    */
   document.getElementById('output').style.display = "none";

    const userPrompt = document.getElementById("userPrompt").value;
    document.getElementById("user-ailment").innerText = userPrompt;

    // Add summary points to the #llm-summary
    let llmHtml = '<ul>';
    data.points.forEach((point, idx) => {
      llmHtml += `<li><strong>Point ${idx + 1}:</strong> ${point}</li>`;
    });
    llmHtml += '</ul>';
    document.getElementById('llm-summary').innerHTML = llmHtml;

    // Match doctor
    let suggestedDoctor = "Dr. Maya Singh (General Consultant)";
    for (const keyword in doctorMapping) {
      if (userPrompt.toLowerCase().includes(keyword)) {
        suggestedDoctor = doctorMapping[keyword];
        break;
      }
    }
    document.getElementById("suggested-doctor").innerText = suggestedDoctor;

    // Show the summary section
    document.getElementById("summary-section").classList.add("show");

  } catch (error) {
    console.error("Summarization error:", error);
    document.getElementById('output').innerHTML = `
      <div class="error">
        ${error.message}
      </div>
    `;
  } finally {
    loading.style.display = 'none'; // Hide spinner
  }
}


// // Doctor Mapping
// const doctorMapping = {
//   "heart": "Dr. Akhilesh Pandey",
//   "brain": "Dr. Chandan Kumar",
//   "cancer": "Dr. Happy Dog (Oncologist)",
//   "fever": "Dr. Mehul Aggarwal (General Physician)",
//   "surgery": "Dr. Raj Sharma (Surgeon)",
//   "pet": "Dr. Preeti Verma (Veterinary Specialist)",
// };

// // Suggestion Function
// function suggestDoctorFromQuery() {
//   const queryText = document.getElementById("userPrompt").value.toLowerCase();
//   const outputDiv = document.getElementById("output");


//   let suggestedDoctor = null;
//   for (const keyword in doctorMapping) {
//       if (queryText.includes(keyword)) {
//           suggestedDoctor = doctorMapping[keyword];
//           break;
//       }
//   }

//   if (suggestedDoctor) {
//       showDoctorSplash(suggestedDoctor);
//   } else {
//       outputDiv.innerHTML += "<p style='color: gray;'>❓ Couldn't determine a specialist. Please try again with more specific symptoms.</p>";
//   }
// }

// //scrolling function
// function scrollToSummarySection() {
//   const summarySection = document.getElementById("summary-section");
//   if (summarySection) {
//     summarySection.scrollIntoView({ behavior: "smooth" });
//   }
// }

// // Doctor splash page function

// function showDoctorSplash(doctorName) {
//   let splash = document.getElementById("splash");

//   // If splash doesn't exist, create it
//   if (!splash) {
//     splash = document.createElement("div");
//     splash.id = "splash";
//     document.body.appendChild(splash);
//   }

//   // Forcefully apply styles even if splash existed
//   splash.style.position = "fixed";
//   splash.style.top = "0";
//   splash.style.left = "0";
//   splash.style.width = "100vw";
//   splash.style.height = "100vh";
//   splash.style.background = "#000"; // Full black background
//   splash.style.color = "white";
//   splash.style.display = "flex";
//   splash.style.flexDirection = "column";
//   splash.style.justifyContent = "center";
//   splash.style.alignItems = "center";
//   splash.style.textAlign = "center";
//   splash.style.zIndex = "99999";
//   splash.style.opacity = "0";
//   splash.style.transition = "opacity 0.6s ease";
//   splash.style.fontFamily = "'Segoe UI', sans-serif";
//   splash.style.fontSize = "32px";

//   // Clear previous content
//   splash.innerHTML = "";

//   // Create title
//   const title = document.createElement("div");
//   title.textContent = "🩺 Your doctor suggestion is:";
//   title.style.marginBottom = "20px";

//   // Doctor name
//   const doctorElem = document.createElement("div");
//   doctorElem.id = "doctorName";
//   doctorElem.style.fontSize = "48px";
//   doctorElem.style.color = "white";
//   doctorElem.style.marginBottom = "5px";
//   doctorElem.textContent = doctorName;

//   // Timing info
//   const timingElem = document.createElement("div");
//   timingElem.textContent = "🕒 Visit them between 10:00 AM - 4:00 PM";
//   timingElem.style.fontSize = "24px";
//   timingElem.style.color = "#ccc";

//   // Append all
//   splash.appendChild(title);
//   splash.appendChild(doctorElem);
//   splash.appendChild(timingElem);

//   // Show splash
//   splash.classList.add("show");
//   splash.style.opacity = "1";

//   // Hide after 5 seconds
//   setTimeout(() => {
//     splash.style.opacity = "0";
//     splash.classList.remove("show");
//   }, 5000);
// }

function printForm(divName) {
  const contentToPrint = document.getElementById(divName).innerHTML;

  const printContents = `
    <html>
      <head>
        <title>MedVigil Form</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 40px;
            color: #222;
          }
          h1 {
            text-align: center;
            color: #0077cc;
            margin-bottom: 30px;
          }
          .form-section {
            padding: 20px;
            border: 1px solid #ccc;
            border-radius: 8px;
            background: #f9f9f9;
          }
          .form-section h2 {
            margin-top: 0;
            color: #444;
          }
          .form-row {
            margin-bottom: 15px;
          }
          .form-label {
            font-weight: bold;
            display: block;
            margin-bottom: 5px;
          }
        </style>
      </head>
      <body>
        <h1>🩺 MedVigil Form</h1>
        <div class="form-section">
          ${contentToPrint}
        </div>
      </body>
    </html>
  `;

  const w = window.open('', '', 'width=800,height=600');
  w.document.write(printContents);
  w.document.close();
  w.focus();
  w.print();
  w.close();
}

async function translateToHindi(divName) {
  const summaryDiv = document.getElementById(divName);
  const listItems = Array.from(summaryDiv.querySelectorAll('li')).map(li => li.innerText);

  try {
    const response = await fetch('http://localhost:8000/translate-to-hindi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points: listItems })
    });

    if (!response.ok) {
      throw new Error("Translation failed");
    }

    const data = await response.json();

    let translatedHtml = '<ul>';
    data.translated_points.forEach((point, idx) => {
      translatedHtml += `<li>${point}</li>`;
    });
    translatedHtml += '</ul>';

    summaryDiv.innerHTML = translatedHtml;
  } catch (err) {
    console.error("Translation Error:", err);
    summaryDiv.innerHTML += `<div class="error">❌ Translation failed: ${err.message}</div>`;
  }
}
