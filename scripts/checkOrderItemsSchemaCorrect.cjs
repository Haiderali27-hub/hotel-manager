const Database = require('better-sqlite3');
const path = require('path');

try {
    console.log('Checking order_items table schema...\n');
    
    // Path to the database file
    const dbPath = path.join(__dirname, '..', 'db', 'hotel.db');
    console.log(`Database path: ${dbPath}`);
    
    const db = new Database(dbPath);
    
    // Get table schema
    const schema = db.prepare(`
        SELECT sql FROM sqlite_master 
        WHERE type='table' AND name='order_items'
    `).get();
    
    console.log('📋 Order Items table schema:');
    console.log(schema.sql);
    
    // Get column info
    const columns = db.prepare("PRAGMA table_info(order_items)").all();
    console.log('\n📋 Order Items table columns:');
    columns.forEach(col => {
        const nullable = col.notnull ? 'NOT NULL' : '';
        const pk = col.pk ? 'PRIMARY KEY' : '';
        console.log(`  - ${col.name}: ${col.type} ${nullable} ${pk}`.trim());
    });
    
    // Check if there are any records
    const count = db.prepare("SELECT COUNT(*) as count FROM order_items").get();
    console.log(`\n📊 Total order items: ${count.count}`);
    
    // Show recent items if any
    if (count.count > 0) {
        const recentItems = db.prepare(`
            SELECT oi.*, mi.name as item_name 
            FROM order_items oi
            LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
            ORDER BY oi.order_id DESC, oi.id DESC 
            LIMIT 5
        `).all();
        console.log('\n📝 Recent order items:');
        recentItems.forEach(item => {
            console.log(`  Order ${item.order_id}: ${item.item_name || 'Unknown'}, Qty ${item.quantity}, Price $${item.unit_price}`);
        });
    }
    
    db.close();
    console.log('\n✅ Order Items table schema check completed!');
    
} catch (error) {
    console.error('❌ Error checking order_items schema:', error.message);
    process.exit(1);
}
