const mysql = require("mysql2/promise"); // Import mysql2 instead of mysql

// Create a connection pool (recommended for better performance)
const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  database: "qr",
  password: "",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Promisify the pool.query method (not necessary for mysql2, but included for compatibility)

module.exports = { pool };