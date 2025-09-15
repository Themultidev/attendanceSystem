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
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  await auth.authorize();
  sheet.auth = auth;
  await sheet.loadInfo();
}

function cosineSimilarity(vecA, vecB) {
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function extractIP(req) {
  let ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  if (!ip) return "";
  if (ip.includes(",")) ip = ip.split(",")[0];
  return ip.replace("::ffff:", "").trim();
}

// ✅ Step 1: Verify face embedding
app.post("/verify-face", async (req, res) => {
  const { token, faceEmbedding } = req.body;
  if (!token || !faceEmbedding) {
    return res.status(400).json({ message: "Missing token or face data" });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  const { classTitle, expiryTime, allowedIP } = decoded;
  const studentIp = extractIP(req);

  // ✅ Strict IP check
  if (allowedIP && studentIp !== allowedIP) {
    return res.status(403).json({ message: "Access denied: invalid network" });
  }

  // ✅ Expiry check
  const now = new Date();
  if (expiryTime && now > new Date(expiryTime)) {
    return res.status(403).json({ message: "Access denied: session expired" });
  }

  try {
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
        console.warn("⚠️ FaceData parse failed for row", row.rowNumber);
      }
    }

    if (!match) {
      return res.status(404).json({ message: "Face not recognized" });
    }

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
    decoded = jwt.verify(classToken, process.env.JWT_SECRET_KEY);
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  const { classTitle } = decoded;

  try {
    await authenticate(lecturerSheet);
    const lectRows = await lecturerSheet.sheetsByIndex[0].getRows();

    for (const row of lectRows) {
      if (row.MatricNo === matricNo) {
        if (row[classTitle] === "Present") {
          return res.json({ alreadyMarked: true });
        }
        row[classTitle] = "Present";
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

// ✅ Root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ✅ Locked /verify route
app.get("/verify", (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(400).send("❌ Missing token");

  const studentIp = extractIP(req);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const { expiryTime, allowedIP } = decoded;

    // IP check
    if (allowedIP && studentIp !== allowedIP) {
      return res.status(403).send("❌ Access denied: invalid network");
    }

    // Expiry check
    const now = new Date();
    if (expiryTime && now > new Date(expiryTime)) {
      return res.status(403).send("⏰ Link expired");
    }

    // ✅ If valid → serve the frontend
    res.sendFile(path.join(__dirname, "public", "index.html"));
  } catch (err) {
    return res.status(401).send("❌ Invalid or expired link");
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
