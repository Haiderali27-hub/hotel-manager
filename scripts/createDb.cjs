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

console.log("Database and table created successfully.");
