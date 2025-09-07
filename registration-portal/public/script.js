import { loadFaceModel, processFace, isFaceProperlyAligned } from "./faceModel.js";

const video = document.getElementById("video");
const captureBtn = document.getElementById("capture");
const submitBtn = document.getElementById("submitBtn");
const form = document.getElementById("registrationForm");
const statusMsg = document.getElementById("status");
const faceGuide = document.getElementById("face-guide");
const guideCtx = faceGuide.getContext("2d");

let modelLoaded = false;
let currentFaceEmbedding = null; // Initialize currentFaceEmbedding here

function drawFaceGuide() {
    const width = video.offsetWidth;
    const height = video.offsetHeight;
    faceGuide.width = width;
    faceGuide.height = height;

    guideCtx.clearRect(0, 0, width, height);

    guideCtx.beginPath();
    guideCtx.ellipse(width / 2, height / 2.5, width / 3, height / 2.5, 0, 0, 2 * Math.PI);
    guideCtx.fillStyle = "rgba(255, 204, 153, 0.1)";
    guideCtx.fill();
    guideCtx.strokeStyle = "rgba(255, 140, 0, 0.8)";
    guideCtx.lineWidth = 3;
    guideCtx.stroke();

    guideCtx.beginPath();
    guideCtx.moveTo(width / 2 - width / 4, height / 2 + height / 3);
    guideCtx.lineTo(width / 2 + width / 4, height / 2 + height / 3);
    guideCtx.stroke();

    guideCtx.font = "16px Arial";
    guideCtx.fillStyle = "rgba(0, 0, 0, 0.6)";
    guideCtx.textAlign = "center";
    guideCtx.fillText("Align your face within the oval", width / 2, height - 20);
}

navigator.mediaDevices.getUserMedia({ video: true })
    .then((stream) => {
        video.srcObject = stream;
        video.addEventListener("loadedmetadata", drawFaceGuide);
        video.addEventListener("resize", drawFaceGuide);
    })
    .catch((err) => {
        console.error("Camera error: ", err);
        alert("Error accessing camera.");
    });

async function initializeFaceModel() {
    await loadFaceModel();
    modelLoaded = true;
}
initializeFaceModel();

captureBtn.addEventListener("click", async () => {
    if (!modelLoaded) {
        alert("Model is still loading.");
        return;
    }

    const faceAligned = await isFaceProperlyAligned(video);
    if (!faceAligned) {
        alert("Please align your face properly within the guide before capturing.");
        return;
    }

    const faceEmbedding = await processFace(video);

    if (faceEmbedding) {
        currentFaceEmbedding = faceEmbedding;
        localStorage.removeItem("faceEmbedding");
        alert("✅ Face captured successfully!");
        submitBtn.disabled = false;
    } else {
        alert("⚠️ No face detected. Try again.");
    }
});

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!currentFaceEmbedding) {
        alert("Please capture your face before submitting.");
        return;
    }

    const name = document.getElementById("name").value;
    const matricNo = document.getElementById("matricNo").value;
    const email = document.getElementById("email").value;

    const response = await fetch("/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, matricNo, email, faceEmbedding: Array.from(currentFaceEmbedding) })
    });

    const result = await response.json();
    statusMsg.innerText = result.message;
    currentFaceEmbedding = null;
    submitBtn.disabled = true;
    form.reset();
});

document.addEventListener("DOMContentLoaded", () => {
    submitBtn.disabled = true;
});
