const Database = require('better-sqlite3');

try {
  console.log('Checking food_orders table schema...');
  const db = new Database('./db/hotel.db');
  
  // Get table schema
  const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='food_orders'").get();
  console.log('\n📋 Food Orders table schema:');
  console.log(schema.sql);
  
  // Get column info
  const columns = db.prepare("PRAGMA table_info(food_orders)").all();
  console.log('\n📋 Food Orders table columns:');
  columns.forEach(col => {
    console.log(`  - ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
  });
  
  db.close();
  console.log('\n✅ Food Orders table schema check completed!');
  
} catch (error) {
  console.error('❌ Error:', error.message);
}
