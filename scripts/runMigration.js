const Database = require('better-sqlite3');
const fs = require('fs');

try {
  console.log('Starting database migration...');
  
  const db = new Database('./db/hotel.db');
  const sql = fs.readFileSync('./scripts/fix_schema.sql', 'utf8');
  
  console.log('Running migration script...');
  db.exec(sql);
  console.log('✅ Database migration completed successfully');
  
  // Verify the schema
  const roomSchema = db.prepare('PRAGMA table_info(rooms)').all();
  const menuSchema = db.prepare('PRAGMA table_info(menu_items)').all();
  
  console.log('\n📋 Rooms table columns:');
  roomSchema.forEach(col => console.log(`  - ${col.name}: ${col.type} (default: ${col.dflt_value})`));
  
  console.log('\n📋 Menu Items table columns:');
  menuSchema.forEach(col => console.log(`  - ${col.name}: ${col.type} (default: ${col.dflt_value})`));
  
  db.close();
  console.log('\n✅ Migration completed! The database schema has been updated.');
  
} catch (error) {
  console.error('❌ Migration error:', error.message);
  process.exit(1);
}
