// server.js (FINAL)
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
require('dotenv').config(); // Load environment variables from .env file

const app = express();
const PORT = 3000;

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Ensure the 'uploads' directory exists
        const uploadPath = path.join(__dirname, 'uploads');
        cb(null, uploadPath); 
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
}).single('studentPhoto'); 

// Middleware
app.use(cors());
app.use(express.json());
// Serve static files from the 'uploads' directory (e.g., photos)
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); 

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
    service: 'gmail', 
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS // MUST BE THE GOOGLE APP PASSWORD!
    }
});

// 1. Photo Upload Endpoint
app.post('/upload-photo', (req, res) => {
    upload(req, res, (err) => {
        if (err) {
            console.error("Upload Error:", err);
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

// 2. Email Sending Endpoint
app.post('/send-email', (req, res) => {
    const { to, subject, body } = req.body;

    // Check for email credentials before attempting to send
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        return res.status(500).json({ success: false, message: 'EMAIL_USER or EMAIL_PASS missing in .env file.' });
    }
    
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: to,
        subject: subject,
        text: body,
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

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Attendance Backend Server running on http://localhost:${PORT}`);
    console.log(`File uploads will be available at http://localhost:${PORT}/uploads/`);
});