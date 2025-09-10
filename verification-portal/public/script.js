import { loadFaceModel, processFace, isFaceProperlyAligned } from "./faceModel.js";

const video = document.getElementById("video");
const captureBtn = document.getElementById("capture");
const statusMsg = document.getElementById("status");
const matchResult = document.getElementById("match-result");
const studentName = document.getElementById("student-name");
const matricNo = document.getElementById("matric-no");
const confirmBtn = document.getElementById("confirm");
const retryBtn = document.getElementById("retry");
const attendanceStatus = document.getElementById("attendance-status");
const faceGuide = document.getElementById("face-guide");
const guideCtx = faceGuide.getContext("2d");

let modelLoaded = false;
let matchedMatric = null;
let classToken = new URLSearchParams(window.location.search).get("token");


// 📐 Resize canvas to match video
function resizeCanvas() {
    const width = video.videoWidth || video.clientWidth;
    const height = video.videoHeight || video.clientHeight;

    faceGuide.width = width;
    faceGuide.height = height;

    // Match CSS size to keep alignment
    faceGuide.style.width = video.clientWidth + "px";
    faceGuide.style.height = video.clientHeight + "px";
}


// 🎨 Draw face guide overlay
function drawFaceGuide() {
    resizeCanvas();

    guideCtx.clearRect(0, 0, faceGuide.width, faceGuide.height);

    const width = faceGuide.width;
    const height = faceGuide.height;

    // Oval
    guideCtx.beginPath();
    guideCtx.ellipse(width / 2, height / 2.5, width / 3, height / 2.5, 0, 0, 2 * Math.PI);
    guideCtx.fillStyle = "rgba(255, 204, 153, 0.1)";
    guideCtx.fill();
    guideCtx.strokeStyle = "rgba(255, 140, 0, 0.8)";
    guideCtx.lineWidth = 3;
    guideCtx.stroke();

    // Horizontal line
    guideCtx.beginPath();
    guideCtx.moveTo(width / 2 - width / 4, height / 2 + height / 3);
    guideCtx.lineTo(width / 2 + width / 4, height / 2 + height / 3);
    guideCtx.stroke();

    // Text
    guideCtx.font = "16px Arial";
    guideCtx.fillStyle = "rgba(0, 0, 0, 0.6)";
    guideCtx.textAlign = "center";
    guideCtx.fillText("Align your face within the oval", width / 2, height - 20);
}


// 🎥 Start camera (mobile-friendly)
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" } // front camera
        });
        video.srcObject = stream;

        video.onloadedmetadata = () => {
            video.play();
            drawFaceGuide();
        };

        // Redraw if orientation/size changes
        window.addEventListener("resize", drawFaceGuide);
    } catch (err) {
        console.error("Camera error: ", err);
        alert("Error accessing camera: " + err.message);
    }
}

document.addEventListener("DOMContentLoaded", startCamera);


// 🤖 Load face model
async function initializeFaceModel() {
    await loadFaceModel();
    modelLoaded = true;
}
initializeFaceModel();


// 🎯 Capture & verify
captureBtn.addEventListener("click", async () => {
    if (!modelLoaded) {
        alert("Model still loading, please wait...");
        return;
    }

    const faceAligned = await isFaceProperlyAligned(video);
    if (!faceAligned) {
        alert("Please align your face properly within the guide before capturing.");
        return;
    }

    const faceEmbedding = await processFace(video);

    if (faceEmbedding) {
        statusMsg.innerText = "Processing face data, please wait... ⏳";
        try {
            const response = await fetch("/verify-face", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: classToken, faceEmbedding }),
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const result = await response.json();

            if (result.student) {
                matchedMatric = result.student.matricNo;
                studentName.innerText = result.student.name;
                matricNo.innerText = result.student.matricNo;

                matchResult.style.display = "block";
                statusMsg.innerText = "Face verified successfully ✅";
                attendanceStatus.innerText = "Click confirm to mark attendance.";
            } else {
                statusMsg.innerText = result.message || "No matching student found ❌";
            }
        } catch (error) {
            console.error("Error verifying face:", error);
            statusMsg.innerText = "⚠️ Error verifying face. Please try again.";
        }
    } else {
        alert("No face detected. Please try again.");
    }
});


// ✅ Confirm button — mark attendance
confirmBtn.addEventListener("click", async () => {
    if (!matchedMatric) {
        statusMsg.innerText = "⚠️ No student verified yet.";
        return;
    }

    statusMsg.innerText = "Submitting attendance... ⏳";

    try {
        const res = await fetch("/mark-attendance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ matricNo: matchedMatric, classToken }),
        });

        if (!res.ok) throw new Error("HTTP error " + res.status);

        const data = await res.json();

        if (data.success) {
            statusMsg.innerText = "Attendance marked successfully ✅";
            attendanceStatus.innerText = "✅ Present";
        } else if (data.alreadyMarked) {
            statusMsg.innerText = "Attendance already marked ⚠️";
            attendanceStatus.innerText = "⚠️ Already Present";
        } else {
            statusMsg.innerText = "Failed to mark attendance ❌";
        }
    } catch (err) {
        statusMsg.innerText = "Error submitting attendance ❌";
        console.error(err);
    }
});


// 🔄 Retry button
retryBtn.addEventListener("click", () => {
    matchResult.style.display = "none";
    matchedMatric = null;
    statusMsg.innerText = "Please try again...";
    attendanceStatus.innerText = "";
});
