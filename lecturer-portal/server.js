// backend/server.js (Lecturer Portal)
require("dotenv").config();
const express = require("express");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 7000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

const SECRET_KEY = process.env.JWT_SECRET_KEY;

// ✅ Generate Attendance Link
app.post("/generate-link", (req, res) => {
  const { classTitle, expiryTime, allowedIP } = req.body;

  if (!classTitle || !expiryTime || !allowedIP) {
    return res.status(400).json({ message: "Missing fields" });
  }

  // 🔍 Debug log what the lecturer sent
  console.log("📌 Received from frontend:");
  console.log("   classTitle:", classTitle);
  console.log("   expiryTime (raw from frontend):", expiryTime);
  console.log("   expiryTime (as Date, UTC):", new Date(expiryTime).toISOString());
  console.log("   allowedIP:", allowedIP);

  // ✅ expiryTime is already UTC (from frontend)
  const token = jwt.sign(
    {
      classTitle,
      expiryTime, // lecturer-set UTC deadline
      allowedIP,
    },
    SECRET_KEY
  );

  const fullLink = `https://verificationpage.onrender.com/verify?token=${token}`;
  console.log("✅ Generated link:", fullLink); // 🔍 Debug log the final link
  res.json({ link: fullLink });
});

app.listen(PORT, () => console.log(`Lecturer portal running on port ${PORT}`));
