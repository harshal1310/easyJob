const express = require('express');
const router = express.Router();
const connection = require('../DB/conn.js');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');

// Middleware
router.use(express.json());
router.use(bodyParser.json());
router.use(express.urlencoded({ extended: true }));

// Multer setup to handle file upload
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            // Specify the destination folder for file uploads
            const uploadPath = path.join(__dirname, 'uploads');
            
            // Create the directory if it doesn't exist
            if (!fs.existsSync(uploadPath)) {
                fs.mkdirSync(uploadPath);
            }

            // Set the destination folder
            cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
            // Set the filename format (add .pdf extension if necessary)
            const fileExtension = path.extname(file.originalname).toLowerCase();
            const candidateId = req.user ? req.user.id : 'guest';  // Assuming the candidate's ID is in the user object
            const fileName = `${candidateId}_${Date.now()}${fileExtension}`;
            cb(null, fileName); // Save the file with the candidate's ID and timestamp
        }
    }),
    fileFilter: (req, file, cb) => {
        // Allow only PDF files to be uploaded
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'), false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // Limit file size to 5MB
    }
});

// Route to submit application
router.post('/submitApplication', (req, res) => {
    try {
        // Handle file upload using multer
        upload.single('resume')(req, res, (err) => {
            if (err) {
                // Handle errors during file upload (e.g., file size limit exceeded)
                return res.status(400).json({ error: err.message });
            }

            // Retrieve form data from the request body
            const fullName = req.body.fullName;
            const email = req.body.email;
            const resume = req.file; // Uploaded resume file (stored in req.file)
            const jobId = req.body.jobId; // Retrieve jobId from request body
            const experience = req.body.experience;

            // Check if the file was uploaded
            if (!resume) {
                return res.status(400).json({ error: 'Resume file is required' });
            }

            // Insert application record into the database
            const insertQuery = `
                INSERT INTO application (candidate_id, job_id, resume, experience, email, submission_time) 
                VALUES ($1, $2, $3, $4, $5, NOW())
            `;
            const values = [req.user ? req.user.id : 'guest', jobId, resume.filename, experience, email]; // Correctly use PostgreSQL placeholders

            // Execute the query
            connection.query(insertQuery, values, (error, results) => {
                if (error) {
                    console.error('Error inserting application record:', error);
                    return res.status(500).json({ success: false, message: 'Failed to submit application' });
                }

                console.log('Application record inserted successfully');
                // Return success message with relevant details
                res.json({
                    success: true, 
                    message: 'Application submitted successfully',
                    fullName,
                    email,
                    jobId
                });
            });
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

