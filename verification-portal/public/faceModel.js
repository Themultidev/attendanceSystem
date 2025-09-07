export async function loadFaceModel() {
    try {
        if (typeof faceapi === "undefined") {
            throw new Error("faceapi is not loaded. Check script order in index.html.");
        }

        await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
        await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
        await faceapi.nets.faceRecognitionNet.loadFromUri("/models");

        console.log("✅ Face API Models Loaded Successfully");
    } catch (error) {
        console.error("❌ Model Loading Failed:", error);
    }
}

export async function processFace(videoElement) {
    try {
        const detections = await faceapi.detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (!detections) {
            console.warn("⚠️ No face detected. Try better lighting and positioning.");
            return null;
        }

        console.log("✅ Face detected:", detections);
        return detections.descriptor;
    } catch (error) {
        console.error("❌ Error processing face:", error);
        return null;
    }
}

export async function isFaceProperlyAligned(videoElement) {
    try {
        const detection = await faceapi.detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();

        if (!detection) return false;

        const { box } = detection.detection;
        const videoWidth = videoElement.videoWidth;
        const videoHeight = videoElement.videoHeight;

        const faceCenterX = box.x + box.width / 2;
        const faceCenterY = box.y + box.height / 2;

        const ovalCenterX = videoWidth / 2;
        const ovalCenterY = videoHeight / 2.5;
        const ovalRadiusX = videoWidth / 3;
        const ovalRadiusY = videoHeight / 2.5;

        const dx = faceCenterX - ovalCenterX;
        const dy = faceCenterY - ovalCenterY;

        const insideOval = (dx * dx) / (ovalRadiusX * ovalRadiusX) + (dy * dy) / (ovalRadiusY * ovalRadiusY) <= 1;
        const sizeOk = box.width > videoWidth * 0.2 && box.width < videoWidth * 0.6;

        console.log("📏 Alignment Check:", { insideOval, sizeOk });

        return insideOval && sizeOk;
    } catch (err) {
        console.error("❌ Error during alignment check:", err);
        return false;
    }
}
