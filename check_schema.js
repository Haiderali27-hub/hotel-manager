const Database = require('better-sqlite3');

try {
  const db = new Database('./db/hotel.db');
  
  console.log('=== ROOMS TABLE SCHEMA ===');
  const roomsInfo = db.prepare("PRAGMA table_info(rooms)").all();
  roomsInfo.forEach(col => {
    console.log(`${col.name}: ${col.type} (NOT NULL: ${col.notnull}, DEFAULT: ${col.dflt_value})`);
  });
  
  console.log('\n=== MENU_ITEMS TABLE SCHEMA ===');
  const menuInfo = db.prepare("PRAGMA table_info(menu_items)").all();
  menuInfo.forEach(col => {
    console.log(`${col.name}: ${col.type} (NOT NULL: ${col.notnull}, DEFAULT: ${col.dflt_value})`);
  });
  
  console.log('\n=== GUESTS TABLE SCHEMA ===');
  const guestsInfo = db.prepare("PRAGMA table_info(guests)").all();
  guestsInfo.forEach(col => {
    console.log(`${col.name}: ${col.type} (NOT NULL: ${col.notnull}, DEFAULT: ${col.dflt_value})`);
  });
  
  db.close();
} catch (error) {
  console.error('Error:', error.message);
}
