const { Pool } = require('pg');
require('dotenv').config(); 

const dbUrl = process.env.DB_URL;

// Create a pool of PostgreSQL connections using the URL
const pool = new Pool({
    connectionString: dbUrl,
    ssl: {
        rejectUnauthorized: false 
    }
});

// List of table creation queries in the correct order
const tableQueries = [
    `CREATE TABLE IF NOT EXISTS subjects (
        subject_id SERIAL PRIMARY KEY,
        subject_name VARCHAR(255) NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS recruiters (
        recruiter_id SERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        company_name VARCHAR(255),
        website VARCHAR(255),
        talent_acquisition BOOLEAN,
        company_size INT,
        industry VARCHAR(255)
    )`,

    `CREATE TABLE IF NOT EXISTS candidates (
        candidate_id SERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS JobPostings (
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

    `CREATE TABLE IF NOT EXISTS questions (
        question_id SERIAL PRIMARY KEY,
        subject_id INT,
        question TEXT NOT NULL,
        image_url VARCHAR(255),
        FOREIGN KEY (subject_id) REFERENCES subjects(subject_id)
    )`,

    `CREATE TABLE IF NOT EXISTS options (
        option_id SERIAL PRIMARY KEY,
        question_id INT,
        option_text TEXT NOT NULL,
        is_correct BOOLEAN NOT NULL,
        FOREIGN KEY (question_id) REFERENCES questions(question_id)
    )`,

    `CREATE TABLE IF NOT EXISTS application (
        application_id SERIAL PRIMARY KEY,
        candidate_id INT,
        job_id INT,
        resume TEXT,  -- You could store the resume as a URL or a file path
        experience TEXT,
        email VARCHAR(255),
        submission_time TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,  -- Use TIMESTAMPTZ for timestamp with timezone
        FOREIGN KEY (candidate_id) REFERENCES candidates(candidate_id),
        FOREIGN KEY (job_id) REFERENCES JobPostings(job_id)
    )`
];

async function createTables() {
    const client = await pool.connect(); // Get a client from the pool
    try {
        console.log('Connected to the PostgreSQL database!');

        // Execute each query in sequence
        for (const query of tableQueries) {
            try {
                const res = await client.query(query);  
                console.log('Table created or already exists:', res.command);
            } catch (err) {
                console.error('Error creating table:', err.stack);
            }
        }

        console.log('All queries executed successfully!');
    } catch (err) {
        console.error('Error connecting to the database:', err.stack);
    } finally {
        // Release the client back to the pool
        client.release();
    }
}

// Call the function to create tables
createTables();

module.exports = pool;
