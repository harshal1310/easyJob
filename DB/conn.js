const { Client } = require('pg');
require('dotenv').config(); 
//const dbUrl = process.env.DB_URL || "postgresql://jobportaldb_zvd9_user:me2CWcgxsoCYn8N8lOR3GWurMf95A5kc@dpg-ct2trbrtq21c73b86lug-a.oregon-postgres.render.com/jobportaldb_zvd9";
const dbUrl ="postgresql://jobportaldb_zvd9_user:me2CWcgxsoCYn8N8lOR3GWurMf95A5kc@dpg-ct2trbrtq21c73b86lug-a.oregon-postgres.render.com/jobportaldb_zvd9";
const connection = new Client({
    connectionString: dbUrl,
    ssl: {
        rejectUnauthorized: false
    },
});

/**
 * Connect to the PostgreSQL database.
 * This should only be called once when initializing the app.
 */
const connectToDatabase = async () => {
    if (connection._connected) {
        console.log('Already connected to the PostgreSQL database.');
        return;
    }

    try {
        await connection.connect();
        console.log('Connected to the PostgreSQL database!');
        await createTables(); // Create tables after successful connection
    } catch (err) {
        console.error('Error connecting to the database:', err);
    }
};







const createTables = async () => {
    const tableQueries = [
               

        // Create recruiters table
        `CREATE TABLE IF NOT EXISTS recruiters (
            recruiter_id SERIAL PRIMARY KEY,
            full_name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            company_name VARCHAR(255),
            website VARCHAR(255),
            talent_acquisition VARCHAR(255),  -- Changed from BOOLEAN to VARCHAR
            company_size VARCHAR(255),        -- Changed from INT to VARCHAR
            industry VARCHAR(255)
        )`,

        // Create candidates table
        `CREATE TABLE IF NOT EXISTS candidates (
            candidate_id SERIAL PRIMARY KEY,
            full_name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL
        )`,

        // Create jobpostings table
        `CREATE TABLE IF NOT EXISTS jobpostings (
            job_id SERIAL PRIMARY KEY,
            job_title VARCHAR(255) NOT NULL,
            location VARCHAR(255),
            experience_min INT,
            experience_max INT,
            job_description TEXT,
            created_by INT,  -- References recruiter_id from recruiters table
            company_name VARCHAR(255),
            date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,  -- Use TIMESTAMPTZ for timestamp with timezone
            FOREIGN KEY (created_by) REFERENCES recruiters(recruiter_id)
        )`,

        // Create skills table
        `CREATE TABLE IF NOT EXISTS skills (
            skill_id SERIAL PRIMARY KEY,
            skill_name VARCHAR(255) NOT NULL
        )`,

        // Create JobSkills table
        `CREATE TABLE IF NOT EXISTS "jobskills" (
            job_skill_id SERIAL PRIMARY KEY,  -- Unique ID for each job-skill pairing
            job_id INT NOT NULL,              -- Foreign key for the job
            skill_id INT NOT NULL,            -- Foreign key for the skill
            FOREIGN KEY (job_id) REFERENCES jobpostings (job_id) ON DELETE CASCADE,  -- Reference to the jobpostings table
            FOREIGN KEY (skill_id) REFERENCES skills (skill_id) ON DELETE CASCADE    -- Reference to the skills table
        )`,

        // Create application table
        `CREATE TABLE IF NOT EXISTS application (
            application_id SERIAL PRIMARY KEY,
            candidate_id INT REFERENCES candidates(candidate_id) ON DELETE CASCADE,
            job_id INT REFERENCES jobpostings(job_id) ON DELETE CASCADE,
            resume VARCHAR(255),  -- Store the resume file name or path
            experience TEXT,      -- Optional: If you want to store additional data like experience
            email VARCHAR(255),   -- Store candidate email (optional, can be removed if not required)
            submission_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- Automatically set to the current time
        )`,
        // Create shortlisted_candidates table
        `CREATE TABLE IF NOT EXISTS shortlisted_candidates (
            shortlisted_id SERIAL PRIMARY KEY,  -- Unique ID for each shortlisted record
            job_id INT NOT NULL,                -- Reference to the job posting
            candidate_id INT NOT NULL,          -- Reference to the candidate
            status INT NOT NULL,                -- Status of the candidate (e.g., 0 for pending, 1 for shortlisted)
            FOREIGN KEY (job_id) REFERENCES jobpostings(job_id) ON DELETE CASCADE,  -- Reference to jobpostings table
            FOREIGN KEY (candidate_id) REFERENCES candidates(candidate_id) ON DELETE CASCADE -- Reference to candidates table
        );`
    ];

    // Execute each query to create the tables
    for (const query of tableQueries) {
        try {
            await connection.query(query);
            console.log('Table created or already exists.');
        } catch (err) {
            console.error('Error creating table:', err.stack);
        }
    }
};


const insertSampleSkills = async () => {
    const skills = ['java', 'sql', 'react', 'node', 'javascript', 'python'];
    
    for (const skill of skills) {
        const checkSkillQuery = `SELECT 1 FROM skills WHERE skill_name = $1`;
        const result = await connection.query(checkSkillQuery, [skill]);

        if (result.rows.length === 0) {
            const insertSkillQuery = `INSERT INTO skills (skill_name) VALUES ($1)`;
            try {
                await connection.query(insertSkillQuery, [skill]);
                console.log(`Inserted skill: ${skill}`);
            } catch (err) {
                console.error('Error inserting skill:', err.stack);
            }
        } else {
            console.log(`Skill "${skill}" already exists.`);
        }
    }
};
insertSampleSkills();

// Connect to the database when the app starts
connectToDatabase();

// Export the connection object only
module.exports = connection;



