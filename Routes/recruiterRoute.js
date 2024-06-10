const express = require('express');
const router = express.Router();
const connection = require('../DB/conn.js');
const bodyParser = require('body-parser');

router.use(express.json());
router.use(bodyParser.json());
router.use(express.urlencoded({ extended: true }));

router.get('/api/hiredCandidates', (req, res) => {
    const query = `
        SELECT sc.job_id, c.id, c.full_name, c.email
        FROM shortlisted_candidates sc
        INNER JOIN candidates c ON sc.candidate_id = c.id WHERE status = 1;
    `;

    connection.query(query, (error, results) => {
        if (error) {
            console.error('Error executing query:', error);
            res.status(500).json({ error: 'Internal server error' });
            return;
        }
        res.json(results);
    });
});

router.post('/hiredCandidate', (req, res) => {
    const { jobId, candidateId } = req.body;
    const sql = 'UPDATE shortlisted_candidates SET status = 1 WHERE job_id = ? AND candidate_id = ?';

    connection.query(sql, [jobId, candidateId], (err, result) => {
        if (err) {
            console.error('Error hiring candidate:', err);
            res.status(500).send('Error hiring candidate');
        } else {
            console.log('Candidate hired successfully');
            res.status(200).send('Candidate hired successfully');
        }
    });
});

router.post('/rejectCandidate', (req, res) => {
    const { jobId, candidateId } = req.body;
    const sql = 'UPDATE shortlisted_candidates SET status = -1 WHERE job_id = ? AND candidate_id = ?';

    connection.query(sql, [jobId, candidateId], (err, result) => {
        if (err) {
            console.error('Error rejecting candidate:', err);
            res.status(500).send('Error rejecting candidate');
        } else {
            console.log('Candidate rejected successfully');
            res.status(200).send('Candidate rejected successfully');
        }
    });
});
//show shortlisted candidates
router.get('/api/shortlistedCandidates', (req, res) => {
    const query = `
        SELECT sc.job_id, c.id, c.full_name, c.email
        FROM shortlisted_candidates sc
        INNER JOIN candidates c ON sc.candidate_id = c.id WHERE status = 0;
    `;

    connection.query(query, (error, results) => {
        if (error) {
            console.error('Error executing query:', error);
            res.status(500).json({ error: 'Internal server error' });
            return;
        }
        res.json(results);
    });
});



router.get('/getPosts',(req, res) => {
    // Assuming req.user.email contains the email of the logged-in recruiter
    const recruiterEmail = req.user.email;
	//console.log(recruiterEmail)
    const query = `
      SELECT 
    jp.job_id, 
    jp.job_title, 
    jp.location, 
    jp.experience_min, 
    jp.experience_max, 
    jp.job_description, 
    jp.created_by, 
    jp.date, 
    GROUP_CONCAT(s.skill_name) AS skills,
    COUNT(a.application_id) AS total_applied
FROM 
    jobpostings jp
LEFT JOIN 
    jobskills js ON jp.job_id = js.job_id
LEFT JOIN 
    skills s ON js.skill_id = s.skill_id
LEFT JOIN
    application a ON jp.job_id = a.job_id
WHERE 
    jp.created_by = ?
GROUP BY 
    jp.job_id;

    `;

    connection.query(query, [recruiterEmail], (err, results) => {
        if (err) {
            console.error('Error fetching job data:', err);
            return res.status(500).json({ error: 'Failed to fetch job data' });
        }
        res.json(results);
    });
});





router.post('/post-job', (req, res) => {
	
	console.log("saved")
    const { job_title, location, experience_min, experience_max, job_description, skills } = req.body;
    if (!job_title || !location || !experience_min || !experience_max || !job_description || !skills) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
	console.log("under if")
console.log(req.user)
    if (req.user.role == 'Recruiter') {
		
        const createdBy = req.user.email;
        const date = new Date().toISOString().slice(0, 10);
console.log("posting")
        const jobQuery = 'INSERT INTO JobPostings (job_title, location, experience_min, experience_max, job_description,created_by,company_name,date) VALUES (?, ?, ?, ?, ?,?,?,?)';
        connection.query(jobQuery, [job_title, location, experience_min, experience_max, job_description, createdBy,'mycompany', date], (jobError, jobResults) => {
            if (jobError) {
                console.error('Error posting job:', jobError);
                return res.status(500).json({ error: 'Failed to post job' });
            }

            const jobId = jobResults.insertId;

            const skillIdQueries = skills.map(skillName => {
                return new Promise((resolve, reject) => {
                    const skillQuery = 'SELECT skill_id FROM Skills WHERE skill_name = ?';
                    connection.query(skillQuery, [skillName], (error, results) => {
                        if (error) {
                            reject(error);
                        } else if (results.length === 0) {
                            reject(`Skill not found: ${skillName}`);
                        } else {
                            resolve(results[0].skill_id);
                        }
                    });
                });
            });

            Promise.all(skillIdQueries)
                .then(skillIds => {
                    const skillValues = skillIds.map(skillId => [jobId, skillId]);
                    const insertSkillQuery = 'INSERT INTO JobSkills (job_id, skill_id) VALUES ?';
                    connection.query(insertSkillQuery, [skillValues], (skillError, skillResults) => {
                        if (skillError) {
                            console.error('Error inserting skills:', skillError);
                            return res.status(500).json({ error: 'Failed to insert skills' });
                        }

                        const job = {
                            id: jobId,
                            job_title,
                            location,
                            experience_min,
                            experience_max,
                            job_description
                        };

                        return res.status(201).json({ message: 'Job posted successfully', job });
                    });
                })
                .catch(error => {
                    console.error('Error retrieving skill IDs:', error);
                    return res.status(500).json({ error: 'Failed to retrieve skill IDs' });
                });
        });
    }
});


// Express route to fetch top high scorers based on jobId and number of high scorers
router.get('/api/getHighScorers', (req, res) => {
    const jobId = req.query.jobId;
    const numOfHighScorers = parseInt(req.query.numOfHighScorers, 10);
	console.log(numOfHighScorers)

    const query = `
        SELECT c.*, SUM(cr.marks) AS total_marks
        FROM candidates c
        JOIN candidate_responses cr ON c.id = cr.candidate_id
        LEFT JOIN shortlisted_candidates sc ON c.id = sc.candidate_id AND sc.job_id = ?
        WHERE cr.job_id = ? AND sc.candidate_id IS NULL
        GROUP BY c.id
        HAVING total_marks > 10
        ORDER BY total_marks DESC
        LIMIT ?;
    `;
    
    connection.query(query, [jobId, jobId, numOfHighScorers], (err, results) => {
        if (err) {
            console.error('Error fetching shortlisted candidates:', err);
            return res.status(500).json({ error: 'Failed to fetch shortlisted candidates' });
        }
        res.json(results);
    });
});


module.exports = router;
