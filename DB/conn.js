
const mysql = require('mysql');


// Create a connection to the MySQL database
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'onlineexam'
});

module.exports = connection;
