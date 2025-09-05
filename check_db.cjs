const Database = require('better-sqlite3');

const db = new Database('db/hotel.db');

try {
  // Check the schema
  const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='admin_auth'").get();
  console.log('Schema:', schema);
  
  // Check the data
  const data = db.prepare("SELECT username, password_hash, security_answer_hash FROM admin_auth").all();
  console.log('\nData:');
  data.forEach(row => {
    console.log('Username:', row.username);
    console.log('Password hash format:', row.password_hash.includes(':') ? 'hash:salt' : 'just hash');
    console.log('Security answer hash format:', row.security_answer_hash.includes(':') ? 'hash:salt' : 'just hash');
    console.log('Password hash length:', row.password_hash.length);
    console.log('Security answer hash length:', row.security_answer_hash.length);
    if (row.password_hash.includes(':')) {
      const [hash, salt] = row.password_hash.split(':');
      console.log('Password - Hash length:', hash.length, 'Salt length:', salt.length);
    }
    if (row.security_answer_hash.includes(':')) {
      const [hash, salt] = row.security_answer_hash.split(':');
      console.log('Security answer - Hash length:', hash.length, 'Salt length:', salt.length);
    }
  });
  
} catch (error) {
  console.error('Error:', error);
} finally {
  db.close();
}
