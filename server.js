const express = require('express');
const path = require('path');
const connection = require('./DB/conn.js');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const otpGenerator = require('otp-generator');
const multer = require("multer");
const nodemailer = require('nodemailer');
const jobRoutes = require('./Routes/JobRoute.js');
const authRoute = require('./Routes/AuthRoute.js');
const candidatesRoute = require('./Routes/candidatesRoute');
const recruiterRoute = require('./Routes/recruiterRoute.js');


const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const cron = require('node-cron');



const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(session({
    secret: 'mysession',
    resave: false,
    saveUninitialized: true,
	cookie: {
        maxAge: 10 * 60 * 1000 // 50 minutes in milliseconds
    }
}));



app.use(session({
    secret: 'otpSession',
    resave: false,
    saveUninitialized: true,
	cookie: {
        maxAge: 10 * 60 * 1000 // 50 minutes in milliseconds
    }
}));



app.set('view engine', 'ejs');


// Serve static files (HTML, CSS, JavaScript)
app.use(express.static(path.join(__dirname, 'public')));

const SECRET_KEY = '1234';



// Connect to the database
connection.connect((err) => {
    if (err) {
        console.error('Error connecting to database:', err.stack);
        return;
    }
    console.log('Connected to database as id', connection.threadId);
});

app.get('/login',(req, res) => {
	console.log(req.cookies.token)
    if (req.cookies.token) {
        if (req.user && req.user.role == 'Candidate')
            return res.redirect('/jobs');
        else if (req.user && req.user.role == 'Recruiter')
            return res.redirect('/recruiter');
    }

    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Login Route

app.post('/login', (req, res) => {
    const { email, password } = req.body;
console.log(req.body)
    // Validate email and password presence
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    let sql = 'SELECT * FROM candidates WHERE email = ? AND password = ?';
    connection.query(sql, [email, password], (err, candidateResult) => {
        if (err) {
            console.error('Error executing login query for candidate:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        if (candidateResult.length > 0) {
            // Candidate login successful
			
			 const candidateId = candidateResult[0].id; // Get candidate ID from the query result

            const token = jwt.sign({ id: candidateId, email: email, role: 'Candidate' }, SECRET_KEY, { expiresIn: '1d' });
			            res.cookie('token', token, { maxAge: 24 * 60 * 60 * 1000 });
            return res.status(200).json({ message: 'Candidate login successful', role: 'Candidate' });
        }

        sql = 'SELECT * FROM recruiters WHERE email = ? AND password = ?';
        connection.query(sql, [email, password], (err, recruiterResult) => {
            if (err) {
                console.error('Error executing login query for recruiter:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }

            if (recruiterResult.length > 0) {
				 const recruiterId = recruiterResult[0].id; // Get candidate ID from the query result

           const  token = jwt.sign({ id: recruiterId, email: email, role: 'Recruiter' }, SECRET_KEY, { expiresIn: '1d' });
				
                res.cookie('token', token, { maxAge: 24 * 60 * 60 * 1000 });
                return res.status(200).json({ message: 'Recruiter login successful', role: 'Recruiter' });
            } else {
                // Invalid email or password
                return res.status(401).json({ error: 'Invalid email or password' });
            }
        });
    });
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});



const checkEmailExists = (email, table, callback) => {
    const sql = `SELECT * FROM ${table} WHERE email = ?`;
    connection.query(sql, [email], (err, result) => {
        if (err) {
            return callback(err, null);
        }
        callback(null, result.length > 0);
    });
};






app.post('/signup/candidate', (req, res) => {
    const { fullName, email, password } = req.body;

    checkEmailExists(email, 'candidates', async (err, exists) => {
        if (err) {
            console.error('Error checking email:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        if (exists) {
            return res.status(400).json({ error: 'User already present' });
        }

        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            const sql = 'INSERT INTO candidates (full_name, email, password) VALUES (?, ?, ?)';
            connection.query(sql, [fullName, email, hashedPassword], (err, result) => {
                if (err) {
                    console.error('Error inserting candidate:', err);
                    return res.status(500).json({ error: 'Internal server error' });
                }
                res.cookie('email', email, { httpOnly: true });
                res.status(200).json({ message: 'Candidate registered successfully' });
            });
        } catch (error) {
            console.error('Error hashing password:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
});

let otpStorage = {}

// Route to handle recruiter signup
app.post('/signup/recruiter', (req, res) => {
    const { fullName, email, password, companyName, website, talentAcquisition, companySize, industry } = req.body;

    checkEmailExists(email, 'recruiters', async (err, exists) => {
        if (err) {
            console.error('Error checking email:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        if (exists) {
            return res.status(400).json({ error: 'User already present' });
        }

        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            const sql = 'INSERT INTO recruiters (full_name, email, password, company_name, website, talent_acquisition, company_size, industry) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
            connection.query(sql, [fullName, email, hashedPassword, companyName, website, talentAcquisition, companySize, industry], (err, result) => {
                if (err) {
                    console.error('Error inserting recruiter:', err);
                    return res.status(500).json({ error: 'Internal server error' });
                }
                res.cookie('email', email, { httpOnly: true });
				const otp = otpGenerator.generate(6, { digits: true, alphabets: false, upperCase: false, specialChars: false });
				 req.session.otp = otp;
				 console.log(req.session.otp)
				//	sendMail(email, `Your OTP for email verification is: ${otp}`);
                res.status(200).json({ message: 'Recruiter registered successfully' });
            });
        } catch (error) {
            console.error('Error hashing password:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
});



app.post('/verify-otp', (req, res) => {
    const { otp } = req.body;
    const email = req.session.email;
    const storedOtp = req.session.otp;
    if (storedOtp === otp) {
        req.session.emailVerified = true; // Mark email as verified in session
        res.json({ success: true, message: 'Email verified successfully' });
    } else {
        res.json({ success: false, message: 'Invalid OTP' });
    }
});
// Route to resend OTP
app.post('/resend-otp', (req, res) => {
    const email = req.cookies.email;
    if (!email) {
        return res.status(400).send('Email not found in cookies');
    }
    const newOtp = otpGenerator.generate(6, { digits: true, alphabets: false, upperCase: false, specialChars: false });
req.session.otp = newOtp
sendMail(email,`Your OTP for email verification is: ${newOtp}`)
});





app.post('/send-verification-email', (req, res) => {
    const email = req.cookies.email;
    if (!email) {
        return res.status(400).send('Email not found in cookies');
    }
    
});








app.get('/verify', (req, res) => {
	console.log("verify")
    const email = req.cookies.email
	if (!email) {
        return res.redirect('/signup');
    }
    res.render('otpPage.ejs',{email});
});






app.get('/logout',(req, res) => {
    // Clear session or token
    res.clearCookie('token'); // Assuming you're using cookies for authentication

    // Redirect the user to the login page
    res.redirect('/signup');
});


app.get('/jobs',authenticateToken, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'jobs.html'));
});

// Route to fetch job data including skills




app.get('/recruiter', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'recruiterProfile.html'));
});

app.get('/addQuesstions', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'addquestions.html'));
});



const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, file.fieldname + '-' + uniqueSuffix)
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 1000000 }, // 1MB file size limit
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    }
}); // 'resume' is the name attribute of the file input field

// Check file type
function checkFileType(file, cb) {
    const filetypes = /pdf|doc|docx/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    } else {
        cb('Error: Only PDF, DOC, and DOCX files are allowed');
    }
}





cron.schedule('0 */2 * * *', () => {
    console.log('Running cron job...');

    // Query database to find applications submitted within the last 2 hours
    const query = `SELECT * FROM application WHERE TIMESTAMPDIFF(HOUR, created_at, NOW()) <= 2`;
    connection.query(query, (error, results) => {
        if (error) {
            console.error('Error querying applications:', error);
            return;
        }

        // For each application, check if experience meets job requirements and send email
        results.forEach(application => {
            const { candidate_id, job_id, experience,email } = application;

            // Query jobpostings table to find matching job postings
            const jobQuery = `SELECT * FROM jobpostings WHERE job_id = ? AND experience_min <= ?`;
            connection.query(jobQuery, [job_id, experience], (jobError, jobResults) => {
                if (jobError) {
                    console.error('Error querying job postings:', jobError);
                    return;
                }

                // If there are matching job postings, send email
                if (jobResults.length > 0) {
                    const job = jobResults[0];
					const message = `Click the link to apply for the job: http://127.0.0.1:${PORT}/test/${job.id}`
					sendMail(email,message);
                }
            });
        });
    });
});






function sendMail(email,message) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'ash13102000@gmail.com',
            pass: 'qhcp asnt buuu qawt'
        }
    });

    const mailOptions = {
        from: 'ash13102000@gmail.com',
        to: 'hygosavi9834@gmail.com',
        subject: 'Job Application Link', // Update subject
        text: message
    };

    // Send the email
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log(error);
            // Handle error when sending email
        } else {
            console.log('Email sent: ' + info.response);
            // Handle success when sending email
        }
    });
}




app.get('/test/:jobId/instructions', (req, res) => {
	console.log(req.params)
	const jobId = req.params.jobId;
    console.log(jobId)
        res.render('testinstructionpage', { jobId: jobId });
    
});




app.get('/test/:jobId/startExam', authenticateToken,(req, res) => {
    const jobId = req.params.jobId;
    const candidateId = req.user.id; // Assuming the candidate ID is available from authentication
console.log(jobId);
console.log(candidateId);
    connection.query(
        'SELECT * FROM application WHERE candidate_id = ? AND job_id = ?',
        [candidateId, jobId],
        (error, results) => {
            if (error) {
                console.error(error);
                return res.status(500).send('Internal server error');
            }

            if (results.length === 0) {
                return res.status(404).send('Application not found');
            }

            const application = results[0];

            // If exam has already started, calculate remaining time
            if (application.isexamstart) {
const currentTimeInSeconds = Math.floor(new Date().getTime() / 1000);
console.log(currentTimeInSeconds);
               const examStartTimeInSeconds = Math.floor(new Date(application.startexamtime).getTime() / 1000);
const thirtyMinutesLaterInSeconds = Math.floor((new Date(application.startexamtime).getTime() + (25 * 60000)) / 1000);

console.log("Exam Start Time in seconds:", examStartTimeInSeconds);
console.log("Thirty Minutes Later in seconds:", thirtyMinutesLaterInSeconds);

                if (thirtyMinutesLaterInSeconds > currentTimeInSeconds) {
						console.log(thirtyMinutesLaterInSeconds-currentTimeInSeconds)
                    		        res.render('testpage', { jobId: jobId,timeRemaining : thirtyMinutesLaterInSeconds-currentTimeInSeconds });

                } else {
                    res.send('Exam finished');
                }
            } else {
                // If exam has not started yet, start it and set start time
                const currentTime = new Date();
                connection.query(
                    'UPDATE application SET isexamstart = true, startexamtime = ? WHERE candidate_id = ? AND job_id = ?',
                    [currentTime, candidateId, jobId],
                    (error, results) => {
                        if (error) {
                            console.error(error);
                            return res.status(500).send('Internal server error');
                        }

                        // Calculate end time (current time + 30 minutes)
                        const thirtyMinutesLater = new Date(currentTime.getTime() + (6 * 60000)); // Add 30 minutes in milliseconds

                        // Return start time and end time to client
                    		        res.render('testpage', { jobId: jobId,timeRemaining : thirtyMinutesLater });
                    }
                );
            }
        }
    );
});



function generateRandomQuestions(req, res, next) {
    // Check if questions are already stored in the user's session
    if (!req.session.questionsWithNumbers) {
        const query = `
            SELECT q.id AS question_id, q.subject_id, q.question, GROUP_CONCAT(o.option_text) AS options, GROUP_CONCAT(o.is_correct) AS is_correct
            FROM questions q
            JOIN options o ON q.id = o.question_id
            GROUP BY q.id, q.subject_id, q.question
            ORDER BY RAND()
            LIMIT 10`;

        connection.query(query, (error, results) => {
            if (error) {
                console.error('Error fetching random questions:', error);
                return res.status(500).json({ error: 'Error fetching random questions' });
            }

            const questionsWithNumbers = {};
			console.log(results.length);
            results.forEach((question, index) => {
                questionsWithNumbers[index + 1] = {
                    question: question.question,
                    question_id: question.question_id,
                    options: question.options.split(','),
                    is_correct: question.is_correct.split(',')
                };
            });
            req.session.questionsWithNumbers = questionsWithNumbers;
            console.log('Random questions generated and stored in session');
            next();
        });
    } else {
        console.log('Questions already exist in session');
        next();
    }
}

function ensureQuestions(req, res, next) {
    // Check if questions are stored in the user's session
    if (!req.session.questionsWithNumbers) {
        // If questions are not in session, generate them and store them in session
        generateRandomQuestions(req, res, next);
    } else {
        // If questions are already in session, move to the next middleware or route handler
        next();
    }
}





function getCandidateResponse(candidateId, questionId,jobId) {
	
    return new Promise((resolve, reject) => {
        const query = 'SELECT response FROM candidate_responses WHERE candidate_id = ? AND question_id = ? AND job_id = ?';
        connection.query(query, [candidateId, questionId,jobId], (error, results) => {
            if (error) {
                reject(error);
            } else if (results.length > 0) {
				//console.log(results)
                resolve(results[0].response);
            } else {
                resolve(null);
            }
        });
    });
}



app.get('/api/questions/:id/:jobId',authenticateToken, ensureQuestions, (req, res) => {
    const questionId = req.params.id;
	const candidateId = req.user.id;
	const jobId = req.params.jobId;
	//console.log(questionId);
    const questionsFromSession = req.session.questionsWithNumbers;

    if (!questionsFromSession) {
        return res.status(404).json({ error: 'Questions not found in session' });
    }

    const questionData = questionsFromSession[questionId];

    if (!questionData) {
        return res.status(404).json({ error: 'Question not found' });
    }

    // If the question has a previous response, mark the corresponding option as checked
    getCandidateResponse(candidateId, questionData.question_id,jobId)
        .then(response => {
            if (response) {
                questionData.selectedOption = response;
                
            }
			else
				                questionData.selectedOption = 0;

		//	console.log(questionData);
            res.json(questionData);
        })
        .catch(error => {
            console.error('Error fetching candidate response:', error);
            res.status(500).json({ error: 'Internal server error' });
        });
});


















app.post('/api/candidate/responses/:jobId',authenticateToken, async (req, res) => {

   try {
        const responses = req.body;
		console.log(responses)
        const questionsFromSession = req.session.questionsWithNumbers;

        if (responses) {
            const option = responses.optionValue;
            const questionNumber = responses.questionNumber;
            const questionData = questionsFromSession[questionNumber];
            const questionId = questionData.question_id;
            const candidateId = req.user.id; // Assuming you have user authentication and 'id' represents the candidate id
		const jobId = req.params.jobId;

            // Query the database to get the correct answer for the given question
            const query = 'SELECT is_correct FROM options WHERE question_id = ? AND is_correct > 0';
            connection.query(query, [questionId], (err, rows) => {
                if (err) throw err;

                if (rows.length > 0) {
                    const ans = rows[0].is_correct; // Retrieve the correct answer from the query result
                    const marks = (option == ans) ? 4 : -1; // Calculate marks based on the correctness of the response

                    // Check if a response already exists for the same candidate, job, and question
                    const checkQuery = 'SELECT id FROM candidate_responses WHERE candidate_id = ? AND job_id = ? AND question_id = ?';
                    connection.query(checkQuery, [candidateId, jobId, questionId], (checkErr, checkResult) => {
                        if (checkErr) throw checkErr;

                        if (checkResult.length > 0) {
                            // If a response exists, update the existing record
                            const updateQuery = 'UPDATE candidate_responses SET response = ?, marks = ? WHERE id = ?';
                            const responseId = checkResult[0].id;
                            connection.query(updateQuery, [option, marks, responseId], (updateErr, updateResult) => {
                                if (updateErr) throw updateErr;
                                console.log('Record updated successfully.');
                                res.status(200).send('Candidate response updated successfully.');
                            });
                        } else {
                            // If no response exists, insert a new record
                            const insertQuery = 'INSERT INTO candidate_responses (job_id, candidate_id, question_id, ans, response, marks) VALUES (?, ?, ?, ?, ?, ?)';
                            const response = [jobId, candidateId, questionId, ans, option, marks];
                            connection.query(insertQuery, response, (insertErr, result) => {
                                if (insertErr) throw insertErr;
                                console.log('Record inserted successfully.');
                                res.status(200).send('Candidate response saved successfully.');
                            });
                        }
                    });
                } else {
                    res.status(404).send('Correct answer not found for the given question.');
                }
            });
        } else {
            res.status(400).send('No responses received.');
        }
    } catch (error) {
        console.error('Error saving candidate responses:', error);
        res.status(500).send('Internal server error');
    }
});














app.post('/api/inviteForInterview', (req, res) => {
    const { candidateId, jobId } = req.body;
    console.log(req.body);
    console.log("in invite");

    // Convert candidateId and jobId to numbers
    const parsedCandidateId = parseInt(candidateId);
    const parsedJobId = parseInt(jobId);

    console.log(parsedCandidateId);
    console.log(parsedJobId);

    const checkQuery = 'SELECT * FROM shortlisted_candidates WHERE candidate_id = ? AND job_id = ? AND status = 0';
    connection.query(checkQuery, [parsedCandidateId, parsedJobId], (checkErr, checkResult) => {
        if (checkErr) {
            console.error('Error checking shortlisted candidates:', checkErr);
            return res.status(500).json({ error: 'Failed to check shortlisted candidates' });
        }
        if (checkResult.length > 0) {
            return res.status(400).json({ message: 'Candidate already shortlisted for this job.' });
        } else {
            const insertQuery = 'INSERT INTO shortlisted_candidates (candidate_id, job_id, date) VALUES (?, ?, CURDATE())';
            connection.query(insertQuery, [parsedCandidateId, parsedJobId], (insertErr, insertResult) => {
                if (insertErr) {
                    console.error('Error shortlisting candidate:', insertErr);
                    return res.status(500).json({ error: 'Failed to shortlist candidate' });
                }
                console.log('Candidate shortlisted for interview successfully');
                return res.status(200).json({ message: 'Candidate shortlisted for interview successfully.' });
            });
        }
    });
});



app.delete('/delete-job/:jobId', (req, res) => {
    const jobId = req.params.jobId;

    // First, delete from jobskills table
    connection.query('DELETE FROM jobskills WHERE job_id = ?', [jobId], (err1, result1) => {
        if (err1) {
            console.error('Error deleting job skills:', err1);
            res.status(500).json({ message: 'Internal server error' });
        } else {
            // Then, delete from jobpostings table
            connection.query('DELETE FROM jobpostings WHERE job_id = ?', [jobId], (err2, result2) => {
                if (err2) {
                    console.error('Error deleting job posting:', err2);
                    res.status(500).json({ message: 'Internal server error' });
                } else {
                    // Check if any record was deleted from jobpostings table
                    if (result2.affectedRows > 0) {
                        res.status(200).json({ message: 'Job deleted successfully' });
                    } else {
                        res.status(404).json({ message: 'Job not found' });
                    }
                }
            });
        }
    });
});




function authenticateToken(req, res,next) {
    const token = req.cookies.token;

    if (!token) return res.send("token invalid")

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) res.send("token invalid")//res.sendFile(path.join(__dirname, 'public', 'login.html'));
//console.log(user)
        req.user = user;
	   //req.cookies.user = user;
        next()
    });
}




app.get('/shortlistedForInterview',(req,res)=>{
	    res.sendFile(path.join(__dirname, 'public', 'shortlist.html'));

})

app.get('/getSavedJobs',(req,res)=>{
	//console.log("saved jobs")
	   res.sendFile(path.join(__dirname, 'public', 'savedjobs.html'));
	
});




app.get('/short',(req,res)=>{
	//console.log("saved jobs")
	   res.sendFile(path.join(__dirname, 'public', 'shoowShortlistedCandidates.html'));
	
});



app.get('/hired',(req,res)=>{
//	console.log("saved jobs")
	   res.sendFile(path.join(__dirname, 'public', 'hiredCandidate.html'));
	
});


app.get('/showRecruiterDashboard',(req,res)=>{
	//console.log("saved jobs")
	   res.sendFile(path.join(__dirname, 'public', 'recruiterProfile.html'));
	
});


app.get('/selectedForJob',(req,res)=>{
	//console.log("saved jobs")
	   res.sendFile(path.join(__dirname, 'public', 'hired.html'));
	
});

















app.get('/resume/:jobid/:candidateid', (req, res) => {
//	console.log(req.params);
  const jobId = req.params.jobid;//req.params.jobId;
  const candidateId = req.params.candidateid;//req.params.candidateId;

  // Query the database to retrieve the filename
  const query = 'SELECT resume FROM application WHERE job_id = ? AND candidate_id = ?';
  connection.query(query, [jobId, candidateId], (error, results) => {
    if (error) {
      console.error('Error retrieving resume filename:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (results.length === 0 || !results) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    const filename = results[0].resume;
    const filePath = path.join(__dirname, 'uploads', filename);
	
	
	        res.download(filePath, filename, (err) => {
            if (err) {
                console.error('Error downloading file:', err);
                res.status(500).send('Internal Server Error');
            }
        });


    // Send the resume file
  });
});

app.delete('/delete-job/:jobId', (req, res) => {
    const jobId = parseInt(req.params.jobId);
    // Find the index of the job in the array
    const index = jobs.findIndex(job => job.id === jobId);
    if (index !== -1) {
        // Remove the job from the array
        jobs.splice(index, 1);
        res.status(200).json({ message: 'Job deleted successfully' });
    } else {
        res.status(404).json({ message: 'Job not found' });
    }
});



app.post('/api/updateJobInfo', (req, res) => {
    const jobId = req.query.jobid;
    const { job_title, location, experience_min, experience_max, job_description, skills } = req.body;

    // Start a transaction
    connection.beginTransaction((err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to start transaction' });
        }

        // Update job details
        const updateJobQuery = `
            UPDATE jobpostings 
            SET job_title = ?, location = ?, job_description = ? 
            WHERE job_id = ?;
        `;
        connection.query(updateJobQuery, [job_title, location, job_description, jobId], (err, results) => {
            if (err) {
                return connection.rollback(() => {
                    res.status(500).json({ error: 'Failed to update job info' });
                });
            }

            // Split skills into an array
            const skillArray = skills.split(',');

            // Retrieve skill IDs for all skills
            const selectSkillIdsQuery = 'SELECT skill_id, skill_name FROM skills WHERE skill_name IN (?)';
            connection.query(selectSkillIdsQuery, [skillArray], (err, skillResults) => {
                if (err) {
                    return connection.rollback(() => {
                        res.status(500).json({ error: 'Failed to retrieve skill IDs' });
                    });
                }

                // Update jobskills table with job ID and skill IDs
                const jobSkillsValues = skillResults.map(skill => [jobId, skill.skill_id]);
                const deleteOldSkillsQuery = 'DELETE FROM jobskills WHERE job_id = ?';
                connection.query(deleteOldSkillsQuery, [jobId], (err, results) => {
                    if (err) {
                        return connection.rollback(() => {
                            res.status(500).json({ error: 'Failed to delete old job skills' });
                        });
                    }

                    const insertJobSkillsQuery = 'INSERT INTO jobskills (job_id, skill_id) VALUES ?';
                    connection.query(insertJobSkillsQuery, [jobSkillsValues], (err, results) => {
                        if (err) {
                            return connection.rollback(() => {
                                res.status(500).json({ error: 'Failed to insert job skills' });
                            });
                        }

                        // Commit the transaction
                        connection.commit((err) => {
                            if (err) {
                                return connection.rollback(() => {
                                    res.status(500).json({ error: 'Failed to commit transaction' });
                                });
                            }
                            res.json({ message: 'Job info and skills updated successfully' });
                        });
                    });
                });
            });
        });
    });
});




//app.use('/',authRoute);


app.use('/',authenticateToken,jobRoutes);
app.use('/',authenticateToken, candidatesRoute);
app.use('/',authenticateToken,recruiterRoute);






// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
