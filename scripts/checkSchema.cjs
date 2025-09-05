const Database = require('better-sqlite3');

try {
  console.log('Checking rooms table schema...');
  const db = new Database('./db/hotel.db');
  
  // Get rooms table schema
  const roomsSchema = db.prepare("PRAGMA table_info(rooms)").all();
  console.log('\n🏨 ROOMS table columns:');
  roomsSchema.forEach(col => {
    console.log(`  - ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : ''} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
  });
  
  // Get guests table schema  
  const guestsSchema = db.prepare("PRAGMA table_info(guests)").all();
  console.log('\n👥 GUESTS table columns:');
  guestsSchema.forEach(col => {
    console.log(`  - ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : ''} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
  });
  
  // Get menu_items table schema
  const menuSchema = db.prepare("PRAGMA table_info(menu_items)").all();
  console.log('\n🍽️ MENU_ITEMS table columns:');
  menuSchema.forEach(col => {
    console.log(`  - ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : ''} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
  });
  
  db.close();
  console.log('\n✅ Schema check completed!');
  
} catch (error) {
  console.error('❌ Error:', error.message);
}
