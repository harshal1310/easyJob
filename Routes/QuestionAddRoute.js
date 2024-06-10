const express = require('express');
const router = express.Router();
const connection = require('../DB/conn.js');
const bodyParser = require('body-parser');

router.use(bodyParser.json());
router.use(express.urlencoded({ extended: true }));

// Define a route to handle form submission and insert questions into the database
router.post('/add-question', (req, res) => {
    // Assuming you're receiving data in JSON format
    const { subject_id, question, imageUrl, options } = req.body;
    console.log(req.body);

    // Insert question
    connection.query('INSERT INTO questions (subject_id, question, image_url) VALUES (?, ?, ?)', [subject_id, question, imageUrl], (err, result) => {
        if (err) {
            console.error('Error inserting question:', err);
            res.status(500).json({ error: 'Failed to add question' });
            return;
        }

        console.log('Question inserted with ID:', result.insertId);

        const questionId = result.insertId;

        // Insert options for the question
        const optionValues = options.map(option => [questionId, option.option_text, option.is_correct]);
        console.log(options);
        connection.query('INSERT INTO options (question_id, option_text, is_correct) VALUES ?', [optionValues], (err, result) => {
            if (err) {
                console.error('Error inserting options:', err);
                res.status(500).json({ error: 'Failed to add options' });
                return;
            }

            console.log('Options inserted for question with ID:', questionId);
            res.status(200).json({ message: 'Question added successfully' });
        });
    });
});

module.exports = router;
