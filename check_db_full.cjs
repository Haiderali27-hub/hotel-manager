const Database = require('better-sqlite3');

const db = new Database('db/hotel.db');

try {
  // Check all columns
  const data = db.prepare("SELECT * FROM admin_auth").all();
  console.log('All data:');
  data.forEach(row => {
    Object.keys(row).forEach(key => {
      console.log(`${key}:`, row[key]);
    });
  });
  
} catch (error) {
  console.error('Error:', error);
} finally {
  db.close();
}
