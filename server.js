const express = require('express');
const path = require('path');
const fs = require('fs');
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



app.get('/api/skills', async (req, res) => {
  try {
    console.log("Fetching skills...");
    
    // Query the skills table (PostgreSQL query returns an object with a `rows` property)
    const result = await connection.query('SELECT skill_name FROM skills');
    console.log(result.rows);  // Log the result for debugging
    
    // Return skills as a JSON response (ensure correct column name 'skill_name')
    res.json({ skills: result.rows.map(row => row.skill_name) });
  } catch (error) {
    console.error('Error fetching skills from database:', error);
    res.status(500).json({ error: 'Error fetching skills' });
  }
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

app.get('/',(req,res) => {
const sql = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'";

    connection.query(sql, (err, result) => {
        if (err) {
            console.error('Error executing query', err);
            return res.status(500).send('Error fetching tables');
        }

        // If the query is successful, send the table names as a response
        const tableNames = result.rows.map(row => row.table_name);
        
        // Log the table names (you can send them to the client too)
        console.log('Tables in the database:', tableNames);

})
res.sendFile(path.join(__dirname,'public','signup.html'))

})


// POST /login
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    // Validate email and password presence
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        // First check if the email exists in the candidates table
        let sql = 'SELECT * FROM candidates WHERE email = $1';
        connection.query(sql, [email], async (err, result) => {
            if (err) {
                console.error('Error executing query for candidate:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }

            if (result.rows.length > 0) {
                // If email exists in candidates table
                const candidate = result.rows[0];

                // Compare the password
                const isMatch = await bcrypt.compare(password, candidate.password);
                if (isMatch) {
                    const token = jwt.sign({ id: candidate.candidate_id, email: candidate.email, role: 'Candidate' }, SECRET_KEY, { expiresIn: '1d' });
                    res.cookie('token', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
                    return res.status(200).json({ message: 'Candidate login successful', role: 'Candidate' });
                } else {
                    // Invalid password for candidate
                    return res.status(401).json({ error: 'Invalid email or password' });
                }
            }

            // If email is not found in candidates table, check recruiters table
            sql = 'SELECT * FROM recruiters WHERE email = $1';
            connection.query(sql, [email], async (err, result) => {
                if (err) {
                    console.error('Error executing query for recruiter:', err);
                    return res.status(500).json({ error: 'Internal server error' });
                }

                if (result.rows.length > 0) {
                    // If email exists in recruiters table
                    const recruiter = result.rows[0];

                    // Compare the password
                    const isMatch = await bcrypt.compare(password, recruiter.password);
                    if (isMatch) {
                        const token = jwt.sign({ id: recruiter.recruiter_id, email: recruiter.email, role: 'Recruiter' }, SECRET_KEY, { expiresIn: '1d' });
                        res.cookie('token', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
                        return res.status(200).json({ message: 'Recruiter login successful', role: 'Recruiter' });
                    } else {
                        // Invalid password for recruiter
                        return res.status(401).json({ error: 'Invalid email or password' });
                    }
                } else {
                    // Email not found in both candidates and recruiters
                    return res.status(401).json({ error: 'Invalid email or password' });
                }
            });
        });
    } catch (error) {
        console.error('Error during login process:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});



const checkEmailExists = (email, table, callback) => {
    const sql = `SELECT * FROM ${table} WHERE email = $1`;
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
            const sql = 'INSERT INTO candidates (full_name, email, password) VALUES ($1, $2, $3)';
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
            const sql = 'INSERT INTO recruiters (full_name, email, password, company_name, website, talent_acquisition, company_size, industry) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)';
            connection.query(sql, [fullName, email, hashedPassword, companyName, website, talentAcquisition, companySize, industry], (err, result) => {
                if (err) {
                    console.error('Error inserting recruiter:', err);
                    return res.status(500).json({ error: 'Internal server error' });
                }
                res.cookie('email', email, { httpOnly: true });
				//const otp = otpGenerator.generate(6, { digits: true, alphabets: false, upperCase: false, specialChars: false });
				 //req.session.otp = otp;
				 //console.log(req.session.otp)
				//	sendMail(email, `Your OTP for email verification is: ${otp}`);
                res.status(200).json({ message: 'Recruiter registered successfully' });
            });
        } catch (error) {
            console.error('Error hashing password:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
});


/*
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
*/





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
            const jobQuery = `SELECT * FROM jobpostings WHERE job_id = $1 AND experience_min <= $2`;
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
        'SELECT * FROM application WHERE candidate_id = $1 AND job_id = $2',
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
                    'UPDATE application SET isexamstart = true, startexamtime = $1 WHERE candidate_id = $2 AND job_id = $3',
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
        const query = 'SELECT response FROM candidate_responses WHERE candidate_id = $1 AND question_id = $2 AND job_id = $3';
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
            const query = 'SELECT is_correct FROM options WHERE question_id = $1 AND is_correct > 0';
            connection.query(query, [questionId], (err, rows) => {
                if (err) throw err;

                if (rows.length > 0) {
                    const ans = rows[0].is_correct; // Retrieve the correct answer from the query result
                    const marks = (option == ans) ? 4 : -1; // Calculate marks based on the correctness of the response

                    // Check if a response already exists for the same candidate, job, and question
                    const checkQuery = 'SELECT id FROM candidate_responses WHERE candidate_id = $1 AND job_id = $2 AND question_id = $3';
                    connection.query(checkQuery, [candidateId, jobId, questionId], (checkErr, checkResult) => {
                        if (checkErr) throw checkErr;

                        if (checkResult.length > 0) {
                            // If a response exists, update the existing record
                            const updateQuery = 'UPDATE candidate_responses SET response = $1, marks = $2 WHERE id = $3';
                            const responseId = checkResult[0].id;
                            connection.query(updateQuery, [option, marks, responseId], (updateErr, updateResult) => {
                                if (updateErr) throw updateErr;
                                console.log('Record updated successfully.');
                                res.status(200).send('Candidate response updated successfully.');
                            });
                        } else {
                            // If no response exists, insert a new record
                            const insertQuery = 'INSERT INTO candidate_responses (job_id, candidate_id, question_id, ans, response, marks) VALUES ($1, $2, $3, $4, $5, $6)';
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













/*
app.post('/api/inviteForInterview', (req, res) => {
    const { candidateId, jobId } = req.body;
    console.log(req.body);
    console.log("in invite");

    // Convert candidateId and jobId to numbers
    const parsedCandidateId = parseInt(candidateId);
    const parsedJobId = parseInt(jobId);

    console.log(parsedCandidateId);
    console.log(parsedJobId);

    const checkQuery = 'SELECT * FROM shortlisted_candidates WHERE candidate_id = $1 AND job_id = $2 AND status = 0';
    connection.query(checkQuery, [parsedCandidateId, parsedJobId], (checkErr, checkResult) => {
        if (checkErr) {
            console.error('Error checking shortlisted candidates:', checkErr);
            return res.status(500).json({ error: 'Failed to check shortlisted candidates' });
        }
        if (checkResult.length > 0) {
            return res.status(400).json({ message: 'Candidate already shortlisted for this job.' });
        } else {
            const insertQuery = 'INSERT INTO shortlisted_candidates (candidate_id, job_id, date) VALUES ($1, $2, CURDATE())';
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
*/



app.post('/api/inviteForInterview', (req, res) => {
    const { candidateId, jobId } = req.body;
    console.log(req.body);
    console.log("in invite");

    // Convert candidateId and jobId to numbers
    const parsedCandidateId = parseInt(candidateId);
    const parsedJobId = parseInt(jobId);

    console.log(parsedCandidateId);
    console.log(parsedJobId);

    const checkQuery = 'SELECT * FROM shortlisted_candidates WHERE candidate_id = $1 AND job_id = $2 AND status = 0';
    connection.query(checkQuery, [parsedCandidateId, parsedJobId], (checkErr, checkResult) => {
        if (checkErr) {
            console.error('Error checking shortlisted candidates:', checkErr);
            return res.status(500).json({ error: 'Failed to check shortlisted candidates' });
        }
        if (checkResult.length > 0) {
            return res.status(400).json({ message: 'Candidate already shortlisted for this job.' });
        } else {
            // Insert query with date column
            const insertQuery = 'INSERT INTO shortlisted_candidates (candidate_id, job_id, status) VALUES ($1, $2, 0)';
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
    connection.query('DELETE FROM jobskills WHERE job_id = $1', [jobId], (err1, result1) => {
        if (err1) {
            console.error('Error deleting job skills:', err1);
            res.status(500).json({ message: 'Internal server error' });
        } else {
            // Then, delete from jobpostings table
            connection.query('DELETE FROM jobpostings WHERE job_id = $1', [jobId], (err2, result2) => {
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
    const jobId = req.params.jobid;  // Job ID from URL
    const candidateId = req.params.candidateid;  // Candidate ID from URL

    // Query the database to retrieve the resume filename
    const query = 'SELECT resume FROM application WHERE job_id = $1 AND candidate_id = $2';
    connection.query(query, [jobId, candidateId], (error, results) => {
        if (error) {
            console.error('Error retrieving resume filename:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }

        // If no results are found or resume filename is missing
        if (results.rows.length === 0 || !results.rows[0].resume) {
            return res.status(404).json({ error: 'Resume not found' });
        }

        // Retrieve the filename of the resume
        const filename = results.rows[0].resume;
        const filePath = path.join(__dirname, 'uploads', filename);  // Construct the full file path

        // Check if the file exists
        fs.access(filePath, fs.constants.F_OK, (err) => {
            if (err) {
                console.error('File does not exist:', filePath);
                return res.status(404).json({ error: 'Resume file not found' });
            }

            // If file exists, send it to the client for download
            res.download(filePath, filename, (err) => {
                if (err) {
                    console.error('Error downloading file:', err);
                    return res.status(500).send('Internal Server Error');
                }
            });
        });
    });
});



app.get('/api/getShortlistedCandidates/:jobId', (req, res) => {
    const jobId = req.params.jobId;
    console.log('Job ID:', jobId);

    // First query: Fetch applications for the specific job
    const applicationsQuery = 'SELECT * FROM application WHERE job_id = $1';

    connection.query(applicationsQuery, [jobId], (err, applicationsResult) => {
        if (err) {
            console.error('Error fetching applications:', err);
            return res.status(500).json({ error: 'Failed to fetch applications' });
        }

        console.log('Applications:', applicationsResult.rows); // Print the applications

        // Second query: Get all candidates (no filtering by jobId)
        const candidatesQuery = 'SELECT * FROM candidates';

        connection.query(candidatesQuery, (err, candidatesResult) => {
            if (err) {
                console.error('Error fetching candidates:', err);
                return res.status(500).json({ error: 'Failed to fetch candidates' });
            }

            console.log('Candidates:', candidatesResult.rows); // Print all candidates

            // Combined query to fetch applications with candidate details for the specific job
            const query = `
                SELECT
                    a.application_id,
                    a.candidate_id,
                    a.job_id,
                    a.submission_time,
                    c.full_name,
                    c.email
                FROM application a
                JOIN candidates c ON a.candidate_id = c.candidate_id
                WHERE a.job_id = $1
                ORDER BY a.submission_time DESC;
            `;

            connection.query(query, [jobId], (err, results) => {
                if (err) {
                    console.error('Error fetching combined results:', err);
                    return res.status(500).json({ error: 'Failed to fetch shortlisted candidates' });
                }

                console.log('Combined Results:', results.rows); // Print combined data
                res.json(results.rows); // Send the combined results as JSON response
            });
        });
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
            SET job_title = $1, location = $2, job_description = $3 
            WHERE job_id = $4;
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
            const selectSkillIdsQuery = 'SELECT skill_id, skill_name FROM skills WHERE skill_name IN ($1)';
            connection.query(selectSkillIdsQuery, [skillArray], (err, skillResults) => {
                if (err) {
                    return connection.rollback(() => {
                        res.status(500).json({ error: 'Failed to retrieve skill IDs' });
                    });
                }

                // Update jobskills table with job ID and skill IDs
                const jobSkillsValues = skillResults.map(skill => [jobId, skill.skill_id]);
                const deleteOldSkillsQuery = 'DELETE FROM jobskills WHERE job_id = $1';
                connection.query(deleteOldSkillsQuery, [jobId], (err, results) => {
                    if (err) {
                        return connection.rollback(() => {
                            res.status(500).json({ error: 'Failed to delete old job skills' });
                        });
                    }

                    const insertJobSkillsQuery = 'INSERT INTO jobskills (job_id, skill_id) VALUES $1';
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

