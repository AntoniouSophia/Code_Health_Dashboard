const mysql = require("mysql2/promise");
const config = require("../config.js");

const pool = mysql.createPool({
  ...config.db,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: "Z"
});

module.exports = pool;