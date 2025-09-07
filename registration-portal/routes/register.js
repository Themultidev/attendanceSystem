const cosineSimilarity = require("./utils/cosineSimilarity"); // path may vary

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
            const matric = row.MatricNo?.trim().toLowerCase();
            if (matric) registeredMatricNos.add(matric);

            try {
                const parsed = JSON.parse(row.FaceData);
                if (Array.isArray(parsed) && parsed.length === 128 && parsed.every(n => typeof n === 'number')) {
                    existingEmbeddings.push(parsed);
                }
            } catch {
                console.warn("⚠️ Invalid FaceData skipped in sheet");
            }
        }

        const duplicateFace = existingEmbeddings.some(existing => {
            const similarity = cosineSimilarity(newEmbedding, existing);
            return similarity > 0.93; // Adjust threshold as needed
        });

        const normalizedMatric = matricNo.trim().toLowerCase();
        if (duplicateFace) {
            return res.status(409).json({ message: "❌ Face already registered." });
        }

        if (registeredMatricNos.has(normalizedMatric)) {
            return res.status(409).json({ message: "❌ Matric number already registered." });
        }

        // Append to both master and lecturer Google Sheets
        const studentData = {
            Name: name,
            MatricNo: matricNo,
            Email: email,
            FaceData: JSON.stringify(newEmbedding),
        };

        const lecturerData = {
            Name: name,
            MatricNo: matricNo,
            Email: email
        };

        await appendToGoogleSheet(studentData);          // master sheet
        await appendToLecturerSheet(lecturerData);       // attendance sheet

        res.status(200).json({ message: "✅ Registration successful!" });

    } catch (error) {
        console.error("❌ Error during registration:", error);
        res.status(500).json({ message: "❌ Internal server error" });
    }
});
