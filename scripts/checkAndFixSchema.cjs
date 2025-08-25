const Database = require('better-sqlite3');

try {
  console.log('Checking current database schema...');
  
  const db = new Database('./db/hotel.db');
  
  // Check existing schema
  const roomSchema = db.prepare('PRAGMA table_info(rooms)').all();
  const menuSchema = db.prepare('PRAGMA table_info(menu_items)').all();
  
  console.log('\n📋 Current Rooms table columns:');
  roomSchema.forEach(col => console.log(`  - ${col.name}: ${col.type} (default: ${col.dflt_value})`));
  
  console.log('\n📋 Current Menu Items table columns:');
  menuSchema.forEach(col => console.log(`  - ${col.name}: ${col.type} (default: ${col.dflt_value})`));
  
  // Check what columns we need to add
  const roomColumns = roomSchema.map(col => col.name);
  const menuColumns = menuSchema.map(col => col.name);
  
  console.log('\n🔍 Checking for missing columns...');
  
  const neededRoomColumns = ['room_type'];
  const neededMenuColumns = ['category', 'is_available'];
  
  const missingRoomColumns = neededRoomColumns.filter(col => !roomColumns.includes(col));
  const missingMenuColumns = neededMenuColumns.filter(col => !menuColumns.includes(col));
  
  console.log('Missing room columns:', missingRoomColumns);
  console.log('Missing menu columns:', missingMenuColumns);
  
  // Add missing columns
  if (missingRoomColumns.length > 0) {
    console.log('\n➕ Adding missing room columns...');
    if (missingRoomColumns.includes('room_type')) {
      db.exec("ALTER TABLE rooms ADD COLUMN room_type TEXT DEFAULT 'Standard'");
      console.log('  ✅ Added room_type column');
      
      // Update existing rooms with proper room types
      db.exec("UPDATE rooms SET room_type = 'Standard' WHERE number LIKE '1%'");
      db.exec("UPDATE rooms SET room_type = 'Deluxe' WHERE number LIKE '2%'");
      db.exec("UPDATE rooms SET room_type = 'Premium' WHERE number LIKE '3%'");
      console.log('  ✅ Updated existing rooms with room types');
    }
  }
  
  if (missingMenuColumns.length > 0) {
    console.log('\n➕ Adding missing menu columns...');
    if (missingMenuColumns.includes('category')) {
      db.exec("ALTER TABLE menu_items ADD COLUMN category TEXT DEFAULT 'Main Course'");
      console.log('  ✅ Added category column');
    }
    if (missingMenuColumns.includes('is_available')) {
      db.exec("ALTER TABLE menu_items ADD COLUMN is_available INTEGER DEFAULT 1");
      console.log('  ✅ Added is_available column');
    }
  }
  
  db.close();
  console.log('\n✅ Schema check and migration completed successfully!');
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
