const Database = require('better-sqlite3');

try {
  console.log('Checking guests table schema...');
  const db = new Database('./db/hotel.db');
  
  // Get table schema
  const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='guests'").get();
  console.log('\n📋 Guests table schema:');
  console.log(schema.sql);
  
  // Get column info
  const columns = db.prepare("PRAGMA table_info(guests)").all();
  console.log('\n📋 Guests table columns:');
  columns.forEach(col => {
    console.log(`  - ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
  });
  
  db.close();
  console.log('\n✅ Guests table schema check completed!');
  
} catch (error) {
  console.error('❌ Error:', error.message);
}
