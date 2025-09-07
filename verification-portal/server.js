require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const jwt = require("jsonwebtoken");
const { JWT } = require("google-auth-library");
const { GoogleSpreadsheet } = require("google-spreadsheet");

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json({ limit: "50mb" }));

// Load Google Sheets
const mainSheet = new GoogleSpreadsheet(process.env.MAIN_GOOGLE_SHEET_ID);
const lecturerSheet = new GoogleSpreadsheet(process.env.LECTURER_GOOGLE_SHEET_ID);

async function authenticate(sheet) {
    const auth = new JWT({
        email: process.env.GOOGLE_CLIENT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    await auth.authorize();
    sheet.auth = auth;
    await sheet.loadInfo();
}

function cosineSimilarity(vecA, vecB) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dot += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function extractIP(req) {
    return req.headers["x-forwarded-for"] || req.socket.remoteAddress;
}

// ✅ Step 1: Verify face embedding
app.post("/verify-face", async (req, res) => {
    const { token, faceEmbedding } = req.body;

    if (!token || !faceEmbedding) {
        return res.status(400).json({ message: "Missing token or face data" });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
        return res.status(401).json({ message: "Invalid or expired token" });
    }

    const { classColumn, allowedIp, startTime, endTime } = decoded;
    const studentIp = extractIP(req);

    // ✅ IP check
    if (allowedIp && !studentIp.includes(allowedIp)) {
        return res.status(403).json({ message: "Access denied: invalid network" });
    }

    // ✅ Time check
    const now = new Date();
    if (now < new Date(startTime) || now > new Date(endTime)) {
        return res.status(403).json({ message: "Access denied: not within allowed time" });
    }

    try {
        // ✅ Authenticate main sheet (with face data)
        await authenticate(mainSheet);
        const mainRows = await mainSheet.sheetsByIndex[0].getRows();

        let match = null;
        for (const row of mainRows) {
            if (!row.FaceData) continue;
            try {
                const stored = JSON.parse(row.FaceData);
                const sim = cosineSimilarity(faceEmbedding, stored);
                if (sim >= 0.6) {
                    match = {
                        matricNo: row.MatricNo,
                        name: row.Name,
                        email: row.Email,
                    };
                    break;
                }
            } catch (e) {
                console.warn("FaceData parse failed for row", row.rowNumber);
            }
        }

        if (!match) {
            return res.status(404).json({ message: "Face not recognized" });
        }

        // ✅ Return student info for confirmation step
        return res.json({ student: match, classToken: token });

    } catch (err) {
        console.error("Verification error:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
});

// ✅ Step 2: Confirm & mark attendance
app.post("/mark-attendance", async (req, res) => {
    const { matricNo, classToken } = req.body;

    if (!matricNo || !classToken) {
        return res.status(400).json({ message: "Missing matricNo or classToken" });
    }

    let decoded;
    try {
        decoded = jwt.verify(classToken, process.env.JWT_SECRET);
    } catch (err) {
        return res.status(401).json({ message: "Invalid or expired token" });
    }

    const { classColumn } = decoded;

    try {
        await authenticate(lecturerSheet);
        const lectRows = await lecturerSheet.sheetsByIndex[0].getRows();

        for (const row of lectRows) {
            if (row.MatricNo === matricNo) {
                if (row[classColumn] === "Present") {
                    return res.json({ alreadyMarked: true });
                }
                row[classColumn] = "Present";
                await row.save();
                return res.json({ success: true });
            }
        }

        return res.status(404).json({ message: "Student not found in lecturer sheet" });
    } catch (err) {
        console.error("Mark attendance error:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
});

// ✅ Serve frontend
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
