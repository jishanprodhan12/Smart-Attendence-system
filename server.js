// server.js (FIXED)
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
require('dotenv').config(); // Ensure dotenv is installed and called

const app = express();
const PORT = 3000; // নিশ্চিত করুন যে ফ্রন্টএন্ড (script.js) এই একই পোর্ট ব্যবহার করছে

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // 'uploads' ফোল্ডারটি অবশ্যই তৈরি থাকতে হবে
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
// Static route for uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); 


// Nodemailer transporter setup (Credentials will cause EAUTH if not App Password)
const transporter = nodemailer.createTransport({
    service: 'gmail', 
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS // MUST BE GOOGLE APP PASSWORD
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
            return res.json({ success: true, message: "No file uploaded." });
        }
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
            if (error.code === 'EAUTH') {
                return res.status(401).json({ success: false, message: 'Authentication Failed. Check App Password.' });
            }
            return res.status(500).json({ success: false, message: `Server error: ${error.message}` });
        } else {
            res.json({ success: true, messageId: info.messageId });
        }
    });
});

app.listen(PORT, '0.0.0.0', () => { // Changed listen address to '0.0.0.0' for wider compatibility
    console.log(`Attendance Backend Server running on http://localhost:${PORT}`);
    console.log(`Access photos at http://localhost:${PORT}/uploads/`);
});