const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../models/database');

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later.'
});

// Register admin (only for initial setup)
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { username, password, email, fullName } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Check if admin already exists
    const existingAdmin = db.prepare('SELECT id FROM admin_auth WHERE username = ?').get(username);
    if (existingAdmin) {
      return res.status(400).json({ error: 'Admin already exists' });
    }

    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert new admin
    const stmt = db.prepare(`
      INSERT INTO admin_auth (username, password_hash, email, full_name, created_at, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    const result = stmt.run(username, passwordHash, email, fullName);

    res.status(201).json({
      message: 'Admin registered successfully',
      adminId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Get admin from database
    const stmt = db.prepare(`
      SELECT id, username, password_hash, email, full_name, role, is_active, 
             failed_login_attempts, locked_until
      FROM admin_auth 
      WHERE username = ?
    `);
    const admin = stmt.get(username);

    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!admin.is_active) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // Check if account is locked
    if (admin.locked_until && new Date() < new Date(admin.locked_until)) {
      return res.status(401).json({ error: 'Account is temporarily locked' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, admin.password_hash);

    if (!isValidPassword) {
      // Increment failed login attempts
      const updateStmt = db.prepare(`
        UPDATE admin_auth 
        SET failed_login_attempts = failed_login_attempts + 1,
            locked_until = CASE 
              WHEN failed_login_attempts >= 4 THEN datetime('now', '+30 minutes')
              ELSE locked_until
            END
        WHERE id = ?
      `);
      updateStmt.run(admin.id);

      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Reset failed login attempts and update last login
    const resetStmt = db.prepare(`
      UPDATE admin_auth 
      SET failed_login_attempts = 0, 
          locked_until = NULL, 
          last_login = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    resetStmt.run(admin.id);

    // Generate JWT token
    const token = jwt.sign(
      {
        id: admin.id,
        username: admin.username,
        role: admin.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        fullName: admin.full_name,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Verify token
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid token' });
      }

      // Get fresh user data
      const stmt = db.prepare(`
        SELECT id, username, email, full_name, role, is_active
        FROM admin_auth 
        WHERE id = ? AND is_active = 1
      `);
      const admin = stmt.get(decoded.id);

      if (!admin) {
        return res.status(403).json({ error: 'User not found or inactive' });
      }

      res.json({
        valid: true,
        user: {
          id: admin.id,
          username: admin.username,
          email: admin.email,
          fullName: admin.full_name,
          role: admin.role
        }
      });
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ error: 'Token verification failed' });
  }
});

module.exports = router;
