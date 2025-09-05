const Database = require('better-sqlite3');

try {
  console.log('Checking database triggers...');
  const db = new Database('./db/hotel.db');
  
  // Get all triggers
  const triggers = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='trigger' ORDER BY name").all();
  console.log('\n🔥 Database triggers:');
  if (triggers.length === 0) {
    console.log('  - No triggers found');
  } else {
    triggers.forEach(trigger => {
      console.log(`\n  📌 ${trigger.name}:`);
      console.log(`     ${trigger.sql}`);
    });
  }
  
  db.close();
  console.log('\n✅ Trigger check completed!');
  
} catch (error) {
  console.error('❌ Error:', error.message);
}
