const Database = require('better-sqlite3');

try {
  console.log('Final schema verification...');
  
  const db = new Database('./db/hotel.db');
  
  // Check final schema
  const roomSchema = db.prepare('PRAGMA table_info(rooms)').all();
  const menuSchema = db.prepare('PRAGMA table_info(menu_items)').all();
  
  console.log('\n📋 Final Rooms table schema:');
  roomSchema.forEach(col => console.log(`  - ${col.name}: ${col.type} (default: ${col.dflt_value})`));
  
  console.log('\n📋 Final Menu Items table schema:');
  menuSchema.forEach(col => console.log(`  - ${col.name}: ${col.type} (default: ${col.dflt_value})`));
  
  // Check for additional missing columns we might need
  const roomColumns = roomSchema.map(col => col.name);
  const menuColumns = menuSchema.map(col => col.name);
  
  // Check if we need daily_rate and is_occupied for rooms
  if (!roomColumns.includes('daily_rate')) {
    console.log('\n➕ Adding daily_rate column to rooms...');
    db.exec("ALTER TABLE rooms ADD COLUMN daily_rate REAL DEFAULT 120.0");
    console.log('  ✅ Added daily_rate column');
  }
  
  if (!roomColumns.includes('is_occupied')) {
    console.log('\n➕ Adding is_occupied column to rooms...');
    db.exec("ALTER TABLE rooms ADD COLUMN is_occupied INTEGER DEFAULT 0");
    console.log('  ✅ Added is_occupied column');
  }
  
  if (!roomColumns.includes('guest_id')) {
    console.log('\n➕ Adding guest_id column to rooms...');
    db.exec("ALTER TABLE rooms ADD COLUMN guest_id INTEGER DEFAULT NULL");
    console.log('  ✅ Added guest_id column');
  }
  
  // Test the API calls directly
  console.log('\n🧪 Testing API calls...');
  
  const rooms = db.prepare('SELECT * FROM rooms LIMIT 5').all();
  console.log('Sample rooms:', rooms);
  
  const menuItems = db.prepare('SELECT * FROM menu_items LIMIT 5').all();
  console.log('Sample menu items:', menuItems);
  
  db.close();
  console.log('\n✅ All schema fixes completed!');
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
