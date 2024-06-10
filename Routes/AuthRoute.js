
const connection = require('../DB/conn.js');
const cookieParser = require('cookie-parser');
const { authenticateToken, SECRET_KEY } = require('../server'); // Adjust the path if needed
const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('path');

const router = express.Router();

// Public routes

// Login Route (GET) - No authentication needed
router.get('/login', (req, res) => {
	console.log("in")
    if (req.cookies.token) {
        jwt.verify(req.cookies.token, SECRET_KEY, (err, user) => {
            if (!err && user) {
                if (user.role === 'Candidate') {
                    return res.redirect('/jobs');
                } else if (user.role === 'Recruiter') {
                    return res.redirect('/recruiter');
                }
            }
        });
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Login Route (POST) - No authentication needed
router.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    let sql = 'SELECT * FROM candidates WHERE email = ? AND password = ?';
    connection.query(sql, [email, password], (err, candidateResult) => {
        if (err) {
            return res.status(500).json({ error: 'Internal server error' });
        }

        if (candidateResult.length > 0) {
            const candidateId = candidateResult[0].id;
            const token = jwt.sign({ id: candidateId, email, role: 'Candidate' }, SECRET_KEY, { expiresIn: '1d' });
            res.cookie('token', token, { maxAge: 24 * 60 * 60 * 1000 });
            return res.status(200).json({ message: 'Candidate login successful', role: 'Candidate' });
        }

        sql = 'SELECT * FROM recruiters WHERE email = ? AND password = ?';
        connection.query(sql, [email, password], (err, recruiterResult) => {
            if (err) {
                return res.status(500).json({ error: 'Internal server error' });
            }

            if (recruiterResult.length > 0) {
                const recruiterId = recruiterResult[0].id;
                const token = jwt.sign({ id: recruiterId, email, role: 'Recruiter' }, SECRET_KEY, { expiresIn: '1d' });
                res.cookie('token', token, { maxAge: 24 * 60 * 60 * 1000 });
                return res.status(200).json({ message: 'Recruiter login successful', role: 'Recruiter' });
            } else {
                return res.status(401).json({ error: 'Invalid email or password' });
            }
        });
    });
});

// Signup Route for Candidate - No authentication needed
router.post('/signup/candidate', (req, res) => {
    const { fullName, email, password } = req.body;
    const sql = 'INSERT INTO candidates (full_name, email, password) VALUES (?, ?, ?)';
    connection.query(sql, [fullName, email, password], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.status(200).json({ message: 'Candidate registered successfully' });
    });
});

// Signup Route for Recruiter - No authentication needed
router.post('/signup/recruiter', (req, res) => {
    const { fullName, email, password, companyName, website, talentAcquisition, companySize, industry } = req.body;
    const sql = 'INSERT INTO recruiters (full_name, email, password, company_name, website, talent_acquisition, company_size, industry) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
    connection.query(sql, [fullName, email, password, companyName, website, talentAcquisition, companySize, industry], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.status(200).json({ message: 'Recruiter registered successfully' });
    });
});

// Routes that require authentication

// Example of an authenticated route
router.get('/protected', (req, res) => {
    res.send(`Hello ${req.user.email}, you are authenticated as a ${req.user.role}`);
});

module.exports = router;
