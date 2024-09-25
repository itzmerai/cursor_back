const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');

const app = express();
const port = 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(cors({
    origin: 'http://localhost:5173' // Adjust the port if you're using Vite or a different frontend port
  }));
// Database connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',  // replace with your MySQL username
  password: '',  // replace with your MySQL password
  database: 'cursor'
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  console.log('Connected to the database');
});

app.get("/",(req, res)=> {
  res.json({ message: 'hello backend'});
});

// Login route
app.post('/login', (req, res) => {
  
    const { username, password } = req.body;
  
    // Check admin table
    db.query('SELECT * FROM admin WHERE admin_user = ? AND admin_password = ?', [username, password], (err, adminResults) => {
      if (err) {
        res.status(500).json({ error: 'Internal server error' });
        return;
      }
  
      if (adminResults.length > 0) {
        const admin = adminResults[0];
        const token = jwt.sign({ id: admin.admin_id, role: 'admin' }, 'your_jwt_secret', { expiresIn: '1h' });
        res.json({ token, role: 'admin' });
        return;
      }
  
      // Check students table
      db.query('SELECT * FROM students WHERE student_user = ? AND student_pass = ?', [username, password], (err, studentResults) => {
        if (err) {
          res.status(500).json({ error: 'Internal server error' });
          return;
        }
  
        if (studentResults.length > 0) {
          const student = studentResults[0];
          const token = jwt.sign({ id: student.student_id, role: 'student' }, 'your_jwt_secret', { expiresIn: '1h' });
          res.json({ token, role: 'student', studentId: student.student_id });
          return;
        }
  
        res.status(401).json({ error: 'Invalid credentials' });
      });
    });
  });
  
  

// Admin routes
app.post('/admin/company', (req, res) => {
    const { companyName, qrCode } = req.body;
  
    try {
      // Insert the company with the provided QR code
      db.query('INSERT INTO company (company_name, company_qr) VALUES (?, ?)', 
        [companyName, qrCode], 
        (err, result) => {
          if (err) {
            console.error('Error inserting company into database:', err);
            res.status(500).json({ error: 'Error adding company' });
            return;
          }
          res.json({ message: 'Company added successfully', companyId: result.insertId });
        }
      );
    } catch (error) {
      console.error('Error processing request:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
 
  app.get('/admin/companies', (req, res) => {
    db.query('SELECT company_id, company_name, company_qr FROM company', (err, results) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch companies' });
      }
      res.json(results);
    });
  });
    

app.post('/admin/student', (req, res) => {
    const { name, username, password } = req.body;
  
    // Insert the student into the database without hashing the password
    db.query('INSERT INTO students (student_name, student_user, student_pass) VALUES (?, ?, ?)', 
      [name, username, password], 
      (err, result) => {
        if (err) {
          console.error('Error inserting student into database:', err); // Log the error
          res.status(500).json({ error: 'Error adding student' });
          return;
        }
        res.json({ message: 'Student added successfully', studentId: result.insertId });
      }
    );
  });
  
  
// Student route
app.post('/student/scan', (req, res) => {
  const { studentId, companyQr, scanTime, address } = req.body;

  if (!address) {
    return res.status(400).json({ error: 'Address (location) is required' });
  }

  // Correct SQL query to find the company by the QR code text
  db.query('SELECT company_id FROM company WHERE company_qr = ?', [companyQr], (err, result) => {
    if (err) {
      console.error('Error fetching company:', err);
      return res.status(500).json({ error: 'Database error while fetching company' });
    }

    if (result.length === 0) {
      console.error('Company not found for QR code:', companyQr);
      return res.status(404).json({ error: 'Invalid QR code: Company not found' });
    }

    const companyId = result[0].company_id;

    // Parse the scanTime to create separate date and time fields
    const scanDate = new Date(scanTime);
    const date = scanDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    const time = scanDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }); // 12-hour format

    // Insert scan data into the timesheet table
    db.query('INSERT INTO timesheet (student_id, company_id, date, time, adress) VALUES (?, ?, ?, ?, ?)', 
      [studentId, companyId, date, time, address], 
      (err, result) => {
        if (err) {
          console.error('Error inserting into timesheet:', err);
          return res.status(500).json({ error: 'Database error while inserting scan' });
        }

        res.json({ message: 'Time in recorded successfully' });
      }
    );
  });
});

//timesheet route
app.get('/admin/timesheets', (req, res) => {
  const query = `
    SELECT time_id, student_id, company_id, date, time, adress 
    FROM timesheet
  `;

  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch timesheets' });
    }
    res.json(results);
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
