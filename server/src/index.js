// server/src/index.js
require('dotenv').config();
const express = require('express');
const sql = require('mssql/msnodesqlv8');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// DB configuration from .env
const dbConfig = {
  server: process.env.DB_HOST,        // "kittu"  (or "kittu\\SQLEXPRESS" if that's what SSMS shows)
  database: process.env.DB_NAME,      // "ReactAppDB"
  driver: 'msnodesqlv8',
  options: {
    trustedConnection: true,          // use current Windows user
    trustServerCertificate: true,
    encrypt: false
  }
};
const pool = new sql.ConnectionPool(dbConfig);
const poolConnect = pool.connect()
  .then(() => console.log('✅ Connected to MSSQL'))
  .catch(err => console.error('❌ DB connection error:', err));

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    await poolConnect;
    const request = pool.request();
    request.input('user', sql.VarChar, username);
    request.input('pwd', sql.VarChar, password);
    const result = await request.query(`
      SELECT TOP 1 *
      FROM Users
      WHERE username = @user AND password = @pwd
    `);
    if (result.recordset.length === 1) {
      // In production return a signed JWT or session token
      res.json({ success: true, user: result.recordset[0] });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server listening on ${PORT}`));

