const express = require("express");
const path = require("path");
const cors = require("cors");
const { exec } = require("child_process");
const {
    appendToMainSheet,
    appendToLecturerSheet,
    getAllFaceEmbeddings
} = require("./config/googleSheets");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/index.css", (req, res) => {
    res.setHeader("Content-Type", "text/css");
    res.sendFile(path.join(__dirname, "public", "index.css"));
});

// Helper function
function calculateDistance(a, b) {
    return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
}

app.post("/register", async (req, res) => {
    const { name, matricNo, email, faceEmbedding } = req.body;

    if (!name || !matricNo || !email || !faceEmbedding) {
        return res.status(400).json({ message: "❌ Missing required fields" });
    }

    try {
        const newEmbedding = Array.isArray(faceEmbedding)
            ? faceEmbedding.map(Number)
            : JSON.parse(faceEmbedding).map(Number);

        if (!Array.isArray(newEmbedding) || newEmbedding.length !== 128 || newEmbedding.some(isNaN)) {
            return res.status(400).json({ message: "❌ Invalid face embedding format" });
        }

        const allRows = await getAllFaceEmbeddings();
        const existingEmbeddings = [];
        const registeredMatricNos = new Set();

        for (const row of allRows) {
            if (row.MatricNo) registeredMatricNos.add(row.MatricNo.trim());

            try {
                const parsed = row.FaceData;
                if (Array.isArray(parsed) && parsed.length === 128 && parsed.every(n => typeof n === 'number')) {
                    existingEmbeddings.push(parsed);
                }
            } catch (err) {
                console.warn("⚠️ Invalid FaceData skipped");
            }
        }

        const duplicateFace = existingEmbeddings.some(existing => {
            const distance = calculateDistance(newEmbedding, existing);
            return distance < 0.45;
        });

        if (duplicateFace) {
            return res.status(409).json({ message: "❌ Face already registered." });
        }

        if (registeredMatricNos.has(matricNo.trim())) {
            return res.status(409).json({ message: "❌ Matric number already registered." });
        }

        // ✅ Save to both sheets
        await appendToMainSheet({
            Name: name,
            MatricNo: matricNo,
            Email: email,
            FaceData: JSON.stringify(newEmbedding)
        });

        await appendToLecturerSheet({
            Name: name,
            MatricNo: matricNo,
            Email: email
        });

        res.status(200).json({ message: "✅ Registration successful!" });

    } catch (error) {
        console.error("❌ Registration Error:", error);
        res.status(500).json({ message: "❌ Internal server error" });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server started at http://localhost:${PORT}`);
    const url = `http://localhost:${PORT}`;
    switch (process.platform) {
        case "darwin": exec(`open ${url}`); break;
        case "win32": exec(`start ${url}`); break;
        case "linux": exec(`xdg-open ${url}`); break;
    }
});
