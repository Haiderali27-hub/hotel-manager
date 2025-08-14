const sqlite = require('better-sqlite3');

// Open or create the database
const db = sqlite('./db/hotel.db', { verbose: console.log });

// Create a table for guests if it doesn't exist
db.prepare(`
  CREATE TABLE IF NOT EXISTS guests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    room INTEGER,
    checkin_date TEXT,
    checkout_date TEXT
  )
`).run();

// Drop the old admin_auth table if it exists and create new one
db.prepare(`DROP TABLE IF EXISTS admin_auth`).run();
db.prepare(`DROP TABLE IF EXISTS admin_sessions`).run();
db.prepare(`DROP TABLE IF EXISTS audit_log`).run();

// Create a table for admin authentication with enhanced security
db.prepare(`
  CREATE TABLE admin_auth (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    security_question TEXT NOT NULL,
    security_answer_hash TEXT NOT NULL,
    current_otp TEXT,
    otp_expires_at DATETIME,
    password_reset_token TEXT,
    reset_token_expires_at DATETIME,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    password_changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// Create a table for active sessions
db.prepare(`
  CREATE TABLE admin_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_token TEXT UNIQUE NOT NULL,
    admin_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY (admin_id) REFERENCES admin_auth(id)
  )
`).run();

// Create audit log table for security tracking
db.prepare(`
  CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER,
    action TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    user_agent TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES admin_auth(id)
  )
`).run();

// Enhanced password hashing function
const crypto = require('crypto');

function hashPassword(password, salt = null) {
  if (!salt) {
    salt = crypto.randomBytes(32).toString('hex');
  }
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { hash: hash + ':' + salt };
}

// Generate secure OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
}

// Insert default admin user with security question
const defaultPassword = 'hotel123';
const defaultSecurityAnswer = 'Manager';
const securityQuestion = 'What is the default role of the first user?';

const passwordData = hashPassword(defaultPassword);
const answerData = hashPassword(defaultSecurityAnswer);

// Generate initial OTP (valid for 10 minutes)
const initialOTP = generateOTP();
const otpExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();

db.prepare(`
  INSERT INTO admin_auth (
    username, 
    password_hash, 
    security_question, 
    security_answer_hash,
    current_otp,
    otp_expires_at
  )
  VALUES (?, ?, ?, ?, ?, ?)
`).run(
  'admin', 
  passwordData.hash, 
  securityQuestion, 
  answerData.hash,
  initialOTP,
  otpExpiry
);

// Log the setup in audit log
db.prepare(`
  INSERT INTO audit_log (action, details, timestamp)
  VALUES ('SYSTEM_SETUP', 'Database initialized with default admin account', CURRENT_TIMESTAMP)
`).run();

console.log("Database and tables created successfully.");
console.log("=== ADMIN CREDENTIALS ===");
console.log("Username: admin");
console.log("Password: hotel123");
console.log("Security Question:", securityQuestion);
console.log("Security Answer: Manager");
console.log("Initial OTP:", initialOTP);
console.log("OTP expires in 10 minutes");
console.log("========================");
