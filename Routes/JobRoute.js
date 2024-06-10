const express = require('express');
const router = express.Router();
const connection = require('../DB/conn.js');
const bodyParser = require('body-parser');


router.use(express.json());
router.use(bodyParser.json());
router.use(express.urlencoded({ extended: true }));
//app.use(cookieParser());

// Route to fetch job data including skills




// Server-side route to handle filter parameters and return filtered job listings





// Route to handle form submission and insert questions into the database
router.post('/add-question', (req, res) => {
    const { subject_id, question, imageUrl, options } = req.body;
	console.log(req.body)
    connection.query('INSERT INTO questions (subject_id, question, image_url) VALUES (?, ?, ?)', [subject_id, question, imageUrl], (err, result) => {
        if (err) {
            console.error('Error inserting question:', err);
            return res.status(500).json({ error: 'Failed to add question' });
        }

        const questionId = result.insertId;

        const optionValues = options.map(option => [questionId, option.option_text, option.is_correct]);
        connection.query('INSERT INTO options (question_id, option_text, is_correct) VALUES ?', [optionValues], (err, result) => {
            if (err) {
                console.error('Error inserting options:', err);
                return res.status(500).json({ error: 'Failed to add options' });
            }

            res.status(200).json({ message: 'Question added successfully' });
        });
    });
});



router.get('/totalApplied', (req, res) => {
    // Query to get the total number of applications for each job
    const query = `
        SELECT job_id, COUNT(*) AS total_applied
        FROM application
        GROUP BY job_id;
    `;
    
    // Execute the query
    connection.query(query, (error, results) => {
        if (error) {
            console.error('Error executing query:', error);
            res.status(500).json({ error: 'Internal server error' });
            return;
        }
        // Send the results as JSON
      //  console.log(results);
        res.json(results);
    });
});



router.get('/api/skills', (req, res) => {
  try {
    // Query to select all skills from the database
    const query = 'SELECT skill_name FROM skills';

    // Execute the query
    connection.query(query, (error, results) => {
      if (error) {
        console.error('Error fetching skills:', error);
        res.status(500).json({ error: 'Failed to fetch skills' });
      } else {
        if (results.length > 0) {
          const skills = results.map(row => row.skill_name);
          res.json({ skills });
        } else {
          res.json({ skills: [] }); // Send an empty array if no skills found
        }
      }
    });
  } catch (error) {
    console.error('Error fetching skills:', error);
    res.status(500).json({ error: 'Failed to fetch skills' });
  }
});




router.post('/api/submit-exam', (req, res) => {
  const { examSubmitted } = req.body;
  if (examSubmitted) {
    // Perform actions to handle exam submission, such as destroying the session
    console.log('Exam submitted successfully!');
   //res.redirect(307, '/addQuestions');
    res.status(200).json({ message: 'Exam submitted successfully!' });
  } else {
    res.status(400).json({ error: 'Invalid request' });
  }
});



router.get('/specificJobIdPage', (req, res) => {
  const jobId = req.query.jobId;

  // SQL query to retrieve job postings data along with associated skills
  const query = `
    SELECT jp.job_id, 
           jp.job_title, 
           jp.location, 
           jp.experience_min, 
           jp.experience_max, 
           jp.job_description, 
           GROUP_CONCAT(s.skill_name) AS skills
    FROM jobpostings jp
    LEFT JOIN jobskills js ON jp.job_id = js.job_id
    LEFT JOIN skills s ON js.skill_id = s.skill_id
    WHERE jp.job_id = ?
    GROUP BY jp.job_id
  `;

  // Execute the SQL query
  connection.query(query, [jobId], (err, result) => {
    if (err) {
      console.error('Error executing SQL query:', err);
      return res.status(500).send('Error retrieving job data');
    }

    // Render the EJS template with job posting data
    res.render('jobIdSpecificPage', { jobPostData: result });
  });
});




// Route to fetch job data including skills



module.exports = router;
