const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");
require("dotenv").config();

const MAIN_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const LECTURER_SHEET_ID = process.env.GOOGLE_LECTURER_SHEET_ID;

/**
 * Authenticate and get the first sheet of a Google Spreadsheet
 */
const getSheet = async (sheetId) => {
    if (!sheetId) {
        throw new Error("❌ Missing Google Sheet ID. Check your environment variables.");
    }

    const doc = new GoogleSpreadsheet(sheetId);

    const auth = new JWT({
        email: process.env.GOOGLE_CLIENT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"), // Fix newline issue
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    await auth.authorize();
    doc.auth = auth;

    await doc.loadInfo();
    return doc.sheetsByIndex[0]; // First sheet
};

/**
 * Append a row to the main sheet (students)
 */
async function appendToMainSheet(data) {
    const sheet = await getSheet(MAIN_SHEET_ID);
    await sheet.addRow(data);
    console.log("✅ Saved to MAIN sheet.");
}

/**
 * Append a row to the lecturer sheet
 */
async function appendToLecturerSheet(data) {
    const sheet = await getSheet(LECTURER_SHEET_ID);
    await sheet.addRow(data);
    console.log("✅ Saved to LECTURER sheet.");
}

/**
 * Fetch all face embeddings for verification
 */
async function getAllFaceEmbeddings() {
    const sheet = await getSheet(MAIN_SHEET_ID);
    const rows = await sheet.getRows();

    return rows
        .map((row) => {
            try {
                const embedding = JSON.parse(row.FaceData);
                if (!Array.isArray(embedding)) return null;

                return {
                    FaceData: embedding,
                    MatricNo: row.MatricNo?.trim() || "",
                };
            } catch (err) {
                console.warn("⚠️ Invalid FaceData row skipped:", err.message);
                return null;
            }
        })
        .filter((row) => row && row.FaceData.length === 128);
}

module.exports = {
    appendToMainSheet,
    appendToLecturerSheet,
    getAllFaceEmbeddings,
};
