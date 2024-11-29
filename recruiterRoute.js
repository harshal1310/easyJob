const express = require('express');
const router = express.Router();
const connection = require('../DB/conn.js');
const bodyParser = require('body-parser');

router.use(express.json());
router.use(bodyParser.json());
router.use(express.urlencoded({ extended: true }));
/*
// Route to fetch shortlisted candidates
router.get('/api/hiredCandidates', (req, res) => {
    console.log("in hired")
	const query = `
        SELECT sc.job_id, c.candidate_id, c.full_name, c.email
        FROM shortlisted_candidates sc
        INNER JOIN candidates c ON sc.candidate_id = c.candidate_id
        WHERE sc.status = 1;  -- This checks for shortlisted candidates
    `;

    connection.query(query, (error, results) => {
        if (error) {
            console.error('Error executing query:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.json(results);  // Send the shortlisted candidates data as response
    });
});
*/


// Route to fetch shortlisted candidates
router.get('/api/hiredCandidates', (req, res) => {
    console.log("in hired");

    // Query to get all candidates
    const candidatesQuery = 'SELECT * FROM candidates';
    connection.query(candidatesQuery, (candidatesErr, candidatesResults) => {
        if (candidatesErr) {
            console.error('Error fetching candidates:', candidatesErr);
            return res.status(500).json({ error: 'Error fetching candidates' });
        }

        // Print candidates table
        console.log('Candidates Table:', candidatesResults.rows);

        // Query to get all shortlisted candidates
        const shortlistedQuery = 'SELECT * FROM shortlisted_candidates';
        connection.query(shortlistedQuery, (shortlistedErr, shortlistedResults) => {
            if (shortlistedErr) {
                console.error('Error fetching shortlisted candidates:', shortlistedErr);
                return res.status(500).json({ error: 'Error fetching shortlisted candidates' });
            }

            // Print shortlisted_candidates table
            console.log('Shortlisted Candidates Table:', shortlistedResults.rows);

            // Now proceed with the main query for hired candidates
            const query = `
                SELECT sc.job_id, c.candidate_id, c.full_name, c.email
                FROM shortlisted_candidates sc
                INNER JOIN candidates c ON sc.candidate_id = c.candidate_id
                WHERE sc.status = 1;  -- This checks for shortlisted candidates
            `;
            
            connection.query(query, (error, results) => {
                if (error) {
                    console.error('Error executing query:', error);
                    return res.status(500).json({ error: 'Internal server error' });
                }

                // Return the hired candidates (shortlisted candidates in this case)
                res.json(results.rows);  // Send the shortlisted candidates data as response
            });
        });
    });
});


router.post('/hiredCandidate', (req, res) => {
    const { jobId, candidateId } = req.body;
    const sql = 'UPDATE shortlisted_candidates SET status = 1 WHERE job_id = $1 AND candidate_id = $2';

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
    const sql = 'UPDATE shortlisted_candidates SET status = -1 WHERE job_id = $1 AND candidate_id = $2';

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
        SELECT sc.job_id, c.candidate_id, c.full_name, c.email
        FROM shortlisted_candidates sc
        INNER JOIN candidates c ON sc.candidate_id = c.candidate_id
        WHERE sc.status = 0;
    `;

    connection.query(query, (error, results) => {
        if (error) {
            console.error('Error executing query:', error);
            res.status(500).json({ error: 'Internal server error' });
            return;
        }
        res.json(results.rows);  // Send back the rows from the query result
    });
});



/*
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

router.get('/getPosts', (req, res) => {
    // Assuming req.user.email contains the email of the logged-in recruiter
    const recruiterEmail = req.user.email;
    
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
        STRING_AGG(s.skill_name, ', ') AS skills,  -- Use STRING_AGG instead of GROUP_CONCAT
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
        jp.created_by = $1  -- Use a placeholder for parameterized query
      GROUP BY 
        jp.job_id;
    `;
    
    connection.query(query, [recruiterEmail], (err, results) => {
        if (err) {
            console.error('Error fetching job data:', err);
            return res.status(500).json({ error: 'Failed to fetch job data' });
        }
        res.json(results.rows);  // Use `results.rows` to get the rows in PostgreSQL
    });
});
*/


router.get('/getPosts', (req, res) => {
    // Assuming req.user.email contains the email of the logged-in recruiter
    const recruiterEmail = req.user.email;
    
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
        STRING_AGG(s.skill_name, ', ') AS skills,  -- Use STRING_AGG instead of GROUP_CONCAT
        COUNT(a.application_id) AS total_applied
      FROM 
        jobpostings jp
      LEFT JOIN 
        jobskills js ON jp.job_id = js.job_id
      LEFT JOIN 
        skills s ON js.skill_id = s.skill_id
      LEFT JOIN
        application a ON jp.job_id = a.job_id
      INNER JOIN 
        recruiters r ON jp.created_by = r.recruiter_id  -- Join to get recruiter_id using email
      WHERE 
        r.email = $1  -- Use the email to find the recruiter
      GROUP BY 
        jp.job_id;
    `;
    
    connection.query(query, [recruiterEmail], (err, results) => {
        if (err) {
            console.error('Error fetching job data:', err);
            return res.status(500).json({ error: 'Failed to fetch job data' });
        }
        res.json(results.rows);  // Use `results.rows` to get the rows in PostgreSQL
    });
});




/*
router.post('/post-job', (req, res) => {
    console.log("saved");
    const { job_title, location, experience_min, experience_max, job_description, skills } = req.body;
    console.log(req.body)
    if (!job_title || !location || !experience_min || !experience_max || !job_description || !skills) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log("under if");
    console.log(req.user);

    if (req.user.role === 'Recruiter') {
        const createdBy = req.user.email;
        const date = new Date().toISOString().slice(0, 10);

        console.log("posting");

        // Use numbered placeholders for PostgreSQL
        const jobQuery = `INSERT INTO jobpostings (job_title, location, experience_min, experience_max, job_description, created_by, company_name, date) 
                          VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING job_id`;

        // Execute job posting query
        connection.query(jobQuery, [job_title, location, experience_min, experience_max, job_description, createdBy, 'mycompany', date], (jobError, jobResults) => {
            if (jobError) {
                console.error('Error posting job:', jobError);
                return res.status(500).json({ error: 'Failed to post job' });
            }

            // Get the job ID from the job insertion result
            const jobId = jobResults.rows[0].job_id;

            // Get skill IDs for all the skills provided
            const skillQueries = skills.map(skillName => {
                return new Promise((resolve, reject) => {
                    const skillQuery = 'SELECT skill_id FROM skills WHERE skill_name = $1';  // Use placeholder
                    connection.query(skillQuery, [skillName], (error, results) => {
                        if (error) {
                            reject(error);
                        } else if (results.rows.length === 0) {
                            reject(`Skill not found: ${skillName}`);
                        } else {
                            resolve(results.rows[0].skill_id);
                        }
                    });
                });
            });

            // Once all skill IDs are retrieved, insert into the jobskills table
            Promise.all(skillQueries)
                .then(skillIds => {
                    // Prepare the data for batch insert into jobskills table
                    const skillValues = skillIds.map(skillId => [jobId, skillId]);
                    const insertSkillQuery = 'INSERT INTO jobskills (job_id, skill_id) VALUES ($1, $2)';

                    // Use a single query to insert all the skills
                    const insertPromises = skillValues.map(skillPair => {
                        return new Promise((resolve, reject) => {
                            connection.query(insertSkillQuery, skillPair, (skillError) => {
                                if (skillError) {
                                    console.error('Error inserting skills:', skillError);
                                    reject(skillError);
                                } else {
                                    resolve();
                                }
                            });
                        });
                    });

                    // Wait for all skill insertions to complete
                    return Promise.all(insertPromises);
                })
                .then(() => {
                    // Successfully inserted the job and skills
                    const job = {
                        id: jobId,
                        job_title,
                        location,
                        experience_min,
                        experience_max,
                        job_description
                    };

                    return res.status(201).json({ message: 'Job posted successfully', job });
                })
                .catch(error => {
                    console.error('Error retrieving skill IDs or inserting skills:', error);
                    return res.status(500).json({ error: 'Failed to retrieve skill IDs or insert skills' });
                });
        });
    } else {
        return res.status(403).json({ error: 'Only recruiters can post jobs' });
    }
});
*/

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

        const createdBy = req.user.email;  // Using email as creator identifier (or recruiter_id if necessary)
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


