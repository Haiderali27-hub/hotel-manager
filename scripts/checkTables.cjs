const Database = require('better-sqlite3');

try {
  console.log('Checking database tables...');
  const db = new Database('./db/hotel.db');
  
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  console.log('\n📋 Available tables:');
  tables.forEach(table => console.log(`  - ${table.name}`));
  
  // Check specifically for food order related tables
  const foodTables = tables.filter(t => t.name.includes('food') || t.name.includes('order'));
  console.log('\n🍽️ Food/Order related tables:');
  if (foodTables.length === 0) {
    console.log('  - No food/order tables found!');
  } else {
    foodTables.forEach(table => console.log(`  - ${table.name}`));
  }
  
  db.close();
  console.log('\n✅ Database table check completed!');
  
} catch (error) {
  console.error('❌ Error:', error.message);
}
