const sqlite = require('better-sqlite3');

// Open the database
const db = sqlite('./db/hotel.db');

console.log('\n=== GUEST TABLE SCHEMA ===');
const guestSchema = db.prepare("PRAGMA table_info(guests)").all();
guestSchema.forEach(col => {
  console.log(`Column: ${col.name}, Type: ${col.type}, NotNull: ${col.notnull}, Default: ${col.dflt_value}`);
});

console.log('\n=== GUEST DATA ===');
const guests = db.prepare('SELECT * FROM guests LIMIT 5').all();
guests.forEach(guest => {
  console.log('Guest:', guest);
});

console.log('\n=== ROOM TABLE SCHEMA ===');
const roomSchema = db.prepare("PRAGMA table_info(rooms)").all();
roomSchema.forEach(col => {
  console.log(`Column: ${col.name}, Type: ${col.type}, NotNull: ${col.notnull}, Default: ${col.dflt_value}`);
});

console.log('\n=== ROOM DATA ===');
const rooms = db.prepare('SELECT * FROM rooms LIMIT 5').all();
rooms.forEach(room => {
  console.log('Room:', room);
});

db.close();
