// server.js (FINAL) 

const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
require('dotenv').config(); // Load environment variables from .env file

const app = express();
const PORT = 3000;

// --- Multer setup for file uploads ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Ensure the 'uploads' directory exists
        const uploadPath = path.join(__dirname, 'uploads');
        // Note: The 'uploads' directory must be created manually or handled by an installer script 
        // if it doesn't exist when the server starts.
        cb(null, uploadPath); 
    },
    filename: (req, file, cb) => {
        // Creates a unique filename (timestamp + original name)
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
}).single('studentPhoto'); // Expecting a single file with the field name 'studentPhoto'

// --- Middleware Setup ---
app.use(cors());
app.use(express.json()); // To parse JSON bodies
// Serve static files from the 'uploads' directory (e.g., photos)
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); 

// --- Nodemailer transporter setup ---
const transporter = nodemailer.createTransport({
    service: 'gmail', 
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS // MUST BE THE GOOGLE APP PASSWORD!
    }
});

// ==========================================================
// 1. Photo Upload Endpoint (POST /upload-photo)
// ==========================================================
app.post('/upload-photo', (req, res) => {
    upload(req, res, (err) => {
        if (err) {
            console.error("Upload Error:", err);
            // Handle file size limits or other multer errors gracefully
            return res.status(500).json({ success: false, message: `Upload Failed: ${err.message}` });
        }
        if (!req.file) {
            // No file uploaded scenario
            return res.json({ success: true, message: "No file uploaded, using default photo." });
        }

        // Return the URL where the file can be accessed from the frontend
        const photoUrl = `http://localhost:${PORT}/uploads/${req.file.filename}`;
        res.json({ success: true, photoUrl });
    });
});

// ==========================================================
// 2. Email Sending Endpoint (POST /send-email)
// ==========================================================
app.post('/send-email', (req, res) => {
    const { to, subject, body } = req.body;

    // Critical check for environment variables (This was the source of previous issues)
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        return res.status(500).json({ success: false, message: 'EMAIL_USER or EMAIL_PASS missing in .env file.' });
    }
    
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: to,
        subject: subject,
        text: body, // For plain text email body
        // html: body // Use this if you want to send HTML formatted email
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error("Email Error:", error);
            // EAUTH error means authentication failed (wrong password/App Password missing)
            if (error.code === 'EAUTH' || error.responseCode === 535) {
                // FIX for EAUTH error 
                return res.status(401).json({ success: false, message: 'Failed to send email. Check SMTP credentials. (Hint: Use a 16-digit Google App Password)' });
            }
            return res.status(500).json({ success: false, message: 'Failed to send email due to server error.' });
        } else {
            console.log('Email sent: ' + info.response);
            res.json({ success: true, messageId: info.messageId });
        }
    });
});


// --- Server Start ---
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Attendance Backend Server running on http://localhost:${PORT}`);
    console.log(`File uploads will be available at http://localhost:${PORT}/uploads/`);
});