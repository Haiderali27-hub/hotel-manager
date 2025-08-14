const sqlite = require('better-sqlite3');

// Open the database (it will create the file if it doesn't exist)
const db = sqlite('./db/hotel.db');

// Prepare an SQL statement to insert a new guest
const stmt = db.prepare(`
  INSERT INTO guests (name, room, checkin_date, checkout_date)
  VALUES (?, ?, ?, ?)
`);

// Run the insertion
stmt.run("John Doe", 101, "2025-08-12", "2025-08-15");

console.log("Guest added successfully.");