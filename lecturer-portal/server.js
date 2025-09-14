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

  // ✅ expiryTime is already UTC (from frontend)
  const token = jwt.sign(
    {
      classTitle,
      expiryTime, // lecturer-set UTC deadline
      allowedIP,
    },
    SECRET_KEY
    // ❌ removed { expiresIn: "2h" }
  );

  const fullLink = `https://verificationpage.onrender.com/verify?token=${token}`;
  res.json({ link: fullLink });
});

app.listen(PORT, () => console.log(`Lecturer portal running on port ${PORT}`));
