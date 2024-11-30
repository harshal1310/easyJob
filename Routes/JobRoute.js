
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



router.get('/api/getJobs', async (req, res) => {
    console.log("get jobs");
    try {
        const candidateId = req.user.id;  // Assuming candidate ID is stored in req.user.id
        
        const query = `
            SELECT jp.job_id, 
                   jp.job_title, 
                   jp.location, 
                   jp.experience_min, 
                   jp.experience_max, 
                   jp.job_description, 
                   STRING_AGG(s.skill_name, ', ') AS skills,
                   CASE WHEN a.candidate_id IS NOT NULL THEN 1 ELSE 0 END AS applied
            FROM jobpostings jp
            LEFT JOIN jobskills js ON jp.job_id = js.job_id
            LEFT JOIN skills s ON js.skill_id = s.skill_id
            LEFT JOIN (
                SELECT DISTINCT candidate_id, job_id
                FROM application 
                WHERE candidate_id = $1
            ) a ON jp.job_id = a.job_id
            GROUP BY jp.job_id, a.candidate_id;
        `;
        
        const results = await new Promise((resolve, reject) => {
            connection.query(query, [candidateId], (err, results) => {
                if (err) reject(err);
                else resolve(results.rows);  // Use `.rows` for PostgreSQL results
            });
        });

        res.json(results);
    } catch (error) {
        console.error('Error fetching job data:', error);
        res.status(500).json({ error: 'Failed to fetch job data' });
    }
});







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




router.post('/api/shortlistForInterview', (req, res) => {
  const { candidate_id, job_id } = req.body;
 // const currentDate = new Date().toISOString().slice(0, 10);
console.log("in shortlisted");
  // Check if the combination of job_id and candidate_id already exists
  const checkQuery = 'SELECT * FROM shortlisted_candidates WHERE candidate_id = ? AND job_id = ? And status = 0';
  connection.query(checkQuery, [candidate_id, job_id], (checkErr, checkResult) => {
    if (checkErr) {
      console.error('Error checking shortlisted candidates:', checkErr);
      res.status(500).json({ error: 'Failed to check shortlisted candidates' });
      return;
    }
    if (checkResult.length > 0) {
      // If the combination already exists, send a message indicating it's already shortlisted
      res.status(400).json({ message: 'Candidate already shortlisted for this job.' });
    } else {
      // If the combination doesn't exist, proceed to insert the new record
      const insertQuery = 'INSERT INTO shortlisted_candidates (candidate_id, job_id, date) VALUES (?, ?, CURDATE())';
      connection.query(insertQuery, [candidate_id, job_id], (insertErr, insertResult) => {
        if (insertErr) {
          console.error('Error shortlisting candidate:', insertErr);
          res.status(500).json({ error: 'Failed to shortlist candidate' });
          return;
        }
        console.log('Candidate shortlisted for interview successfully');
        res.status(200).json({ message: 'Candidate shortlisted for interview successfully.' });
      });
    }
  });
});



 router.get('/api/shortlistedForInterview', (req, res) => {
  const candidate_id = req.user.id; // Assuming req.user.id contains the ID of the logged-in user
  console.log(candidate_id);

  // SQL query to get details of shortlisted candidates
  const query = `
    SELECT jp.company_name, jp.job_description, jp.job_title
    FROM shortlisted_candidates sc
    INNER JOIN jobpostings jp ON sc.job_id = jp.job_id
    WHERE sc.candidate_id = $1 AND sc.status = 0;
  `;
	console.log("in shortlistedFornterview")

  // Execute the query with parameterized input
  connection.query(query, [candidate_id], (err, results) => {
    if (err) {
      console.error('Error fetching shortlisted candidate details:', err);
      res.status(500).json({ error: 'Failed to fetch shortlisted candidate details' });
      return;
    }

    if (results.rows.length === 0) {
      res.status(200).json({ message: 'No shortlisted candidates found' });
      return;
    }
	console.log(result.rows)
    // Send the results back as JSON
    res.status(200).json(results.rows);
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
    WHERE sc.candidate_id = $1 AND sc.status = 1;
  `;

  // Execute the query with parameterized input
  connection.query(query, [candidate_id], (err, results) => {
    if (err) {
      console.error('Error fetching shortlisted candidate details:', err);
      res.status(500).json({ error: 'Failed to fetch shortlisted candidate details' });
      return;
    }

    if (results.rows.length === 0) {
      res.status(404).json({ message: 'No shortlisted candidates found' });
      return;
    }

    // Send the results back as JSON
    res.status(200).json(results.rows);
  });
});




router.post('/post-job', async (req, res) => {
    try {
        console.log("Job posting request received.");
        
        const { job_title, location, experience_min, experience_max, job_description, skills } = req.body;
        
        // Check for missing required fields
        if (!job_title || !location || !experience_min || !experience_max || !job_description || !skills) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        console.log("Request body validated:", req.body);

        // Ensure that only recruiters can post jobs
        if (req.user.role !== 'Recruiter') {
            return res.status(403).json({ error: 'Only recruiters can post jobs' });
        }

        // Fetch the recruiter_id based on email
        const recruiterEmail = req.user.email;
        const recruiterQuery = `SELECT recruiter_id FROM recruiters WHERE email = $1`;
        
        const recruiterResult = await connection.query(recruiterQuery, [recruiterEmail]);

        if (recruiterResult.rows.length === 0) {
            return res.status(400).json({ error: 'Recruiter not found' });
        }

        const createdBy = recruiterResult.rows[0].recruiter_id;
        const date = new Date().toISOString(); // ISO format with timestamp (TIMESTAMPTZ)

        console.log("Posting job...");

        // Insert the job posting into the database
        const jobQuery = `INSERT INTO jobpostings (job_title, location, experience_min, experience_max, job_description, created_by, company_name, date) 
                          VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING job_id`;

        const jobValues = [job_title, location, experience_min, experience_max, job_description, createdBy, 'mycompany', date];
        
        const jobResult = await connection.query(jobQuery, jobValues);
        const jobId = jobResult.rows[0].job_id;
        
        console.log("Job posted successfully, Job ID:", jobId);

        // Fetch the skill IDs for the provided skills
        const skillIds = await getSkillIds(skills);
        
        if (!skillIds || skillIds.length === 0) {
            return res.status(400).json({ error: 'Invalid skills provided' });
        }

        // Insert skills into the jobskills table
        await insertJobSkills(jobId, skillIds);

        // Return success response
        return res.status(201).json({
            message: 'Job posted successfully',
            job: {
                id: jobId,
                job_title,
                location,
                experience_min,
                experience_max,
                job_description
            }
        });
        
    } catch (error) {
        console.error('Error posting job:', error);
        return res.status(500).json({ error: 'Failed to post job' });
    }
});

// Helper function to get skill IDs from skill names
async function getSkillIds(skillNames) {
    const skillQuery = 'SELECT skill_id FROM skills WHERE skill_name = ANY($1)';
    
    try {
        const result = await connection.query(skillQuery, [skillNames]);
        return result.rows.map(row => row.skill_id);
    } catch (error) {
        console.error('Error fetching skill IDs:', error);
        throw new Error('Error fetching skill IDs');
    }
}

// Helper function to insert job-skills mapping into the jobskills table
async function insertJobSkills(jobId, skillIds) {
    const insertSkillQuery = 'INSERT INTO jobskills (job_id, skill_id) VALUES ($1, $2)';
    
    const insertPromises = skillIds.map(skillId => {
        return connection.query(insertSkillQuery, [jobId, skillId]);
    });

    try {
        // Wait for all skill insertions to complete
        await Promise.all(insertPromises);
        console.log('Skills associated with the job successfully.');
    } catch (error) {
        console.error('Error inserting skills:', error);
        throw new Error('Error inserting job skills');
    }
}


module.exports = router;


