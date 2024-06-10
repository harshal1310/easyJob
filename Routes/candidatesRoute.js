const express = require('express');
const router = express.Router();
const connection = require('../DB/conn.js');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // Destination folder for uploaded files
const bodyParser = require('body-parser');

router.use(express.json());
router.use(bodyParser.json());
router.use(express.urlencoded({ extended: true }));

// Route to submit job application
router.post('/submitApplication', (req, res) => {
    try {
        upload.single('resume')(req, res, (err) => {
            if (err) {
                return res.status(400).json({ error: err.message }); // Return error message
            }
            
            // Retrieve form data
            const fullName = req.body.fullName;
            const email = req.body.email;
            const resume = req.file; // Uploaded resume file
            const jobId = req.body.jobId; // Retrieve jobId from request body
            const experience = req.body.experience; 

            // Insert application record into the database
            const insertQuery = `INSERT INTO application (candidate_id, job_id, resume, experience, email, submission_time) VALUES (?, ?, ?, ?, ?, NOW())`;
            const values = [req.user.id, jobId, req.file.filename, experience, email];

            connection.query(insertQuery, values, (error, results, fields) => {
                if (error) {
                    console.error('Error inserting application record:', error);
                    return res.status(500).json({ success: false, message: 'Failed to submit application' });
                }
                console.log('Application record inserted successfully');
                res.json({ success: true, message: 'Application submitted successfully', fullName, email });
            });
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' }); // Return generic error message
    }
});




router.get('/api/shortlistedForInterview', (req, res) => {
  const candidate_id = req.user.id; // Assuming req.user.id contains the ID of the logged-in user
  console.log(candidate_id);
  const query = `
  
  
  
  SELECT jp.company_name, jp.job_description, jp.job_title
FROM shortlisted_candidates sc
INNER JOIN jobpostings jp ON sc.job_id = jp.job_id
WHERE sc.candidate_id = ? AND sc.status = 0;

  
  
  `;

  connection.query(query, [candidate_id], (err, results) => {
    if (err) {
      console.error('Error fetching shortlisted candidate details:', err);
      res.status(500).json({ error: 'Failed to fetch shortlisted candidate details' });
      return;
    }

    if (results.length === 0) {
      res.status(404).json({ message: 'No shortlisted candidates found' });
      return;
    }
//console.log(results)
    res.status(200).json(results);
  });
});



router.get('/api/selected', (req, res) => {
  const candidate_id = req.user.id; // Assuming req.user.id contains the ID of the logged-in user
  console.log(candidate_id);
  // SQL query to get details of shortlisted candidates
  const query = `
  
  
  
  SELECT jp.company_name, jp.job_description, jp.job_title
FROM shortlisted_candidates sc
INNER JOIN jobpostings jp ON sc.job_id = jp.job_id
WHERE sc.candidate_id = ? AND sc.status = 1;

  
  
  `;

  connection.query(query, [candidate_id], (err, results) => {
    if (err) {
      console.error('Error fetching shortlisted candidate details:', err);
      res.status(500).json({ error: 'Failed to fetch shortlisted candidate details' });
      return;
    }

    if (results.length === 0) {
      res.status(404).json({ message: 'No shortlisted candidates found' });
      return;
    }
//console.log(results)
    res.status(200).json(results);
  });
});


router.get('/api/getJobs', async (req, res) => {
    try {
        const candidateId = req.user.id;
        
        let query = `
            SELECT jp.job_id, 
                   jp.job_title, 
                   jp.location, 
                   jp.experience_min, 
                   jp.experience_max, 
                   jp.job_description, 
                   GROUP_CONCAT(s.skill_name) AS skills,
                   IF(a.candidate_id IS NOT NULL, 1, 0) AS applied
            FROM jobpostings jp
            LEFT JOIN jobskills js ON jp.job_id = js.job_id
            LEFT JOIN skills s ON js.skill_id = s.skill_id
            LEFT JOIN (
                SELECT DISTINCT candidate_id, job_id
                FROM application 
                WHERE candidate_id = ?
            ) a ON jp.job_id = a.job_id
            GROUP BY jp.job_id;
        `;
        
        const results = await new Promise((resolve, reject) => {
            connection.query(query, [candidateId], (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });

        res.json(results);
    } catch (error) {
        console.error('Error fetching job data:', error);
        res.status(500).json({ error: 'Failed to fetch job data' });
    }
});




module.exports = router;
