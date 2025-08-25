const Database = require('better-sqlite3');
const path = require('path');

try {
    console.log('Checking food_order_items table schema...\n');
    
    // Path to the database file
    const dbPath = path.join(__dirname, '..', 'db', 'hotel.db');
    console.log(`Database path: ${dbPath}`);
    
    const db = new Database(dbPath);
    
    // Check if food_order_items table exists
    const tableExists = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='food_order_items'
    `).get();
    
    if (tableExists) {
        console.log('✅ food_order_items table exists!');
        
        // Get table schema
        const schema = db.prepare(`
            SELECT sql FROM sqlite_master 
            WHERE type='table' AND name='food_order_items'
        `).get();
        
        console.log('\n📋 Food Order Items table schema:');
        console.log(schema.sql);
        
        // Get column info
        const columns = db.prepare("PRAGMA table_info(food_order_items)").all();
        console.log('\n📋 Food Order Items table columns:');
        columns.forEach(col => {
            const nullable = col.notnull ? 'NOT NULL' : '';
            const pk = col.pk ? 'PRIMARY KEY' : '';
            console.log(`  - ${col.name}: ${col.type} ${nullable} ${pk}`.trim());
        });
        
        // Check if there are any records
        const count = db.prepare("SELECT COUNT(*) as count FROM food_order_items").get();
        console.log(`\n📊 Total food order items: ${count.count}`);
        
        // Show recent items if any
        if (count.count > 0) {
            const recentItems = db.prepare(`
                SELECT * FROM food_order_items 
                ORDER BY order_id DESC, id DESC 
                LIMIT 5
            `).all();
            console.log('\n📝 Recent food order items:');
            recentItems.forEach(item => {
                console.log(`  Order ${item.order_id}: Item ${item.menu_item_id}, Qty ${item.quantity}, Price $${item.unit_price}`);
            });
        }
        
    } else {
        console.log('❌ food_order_items table does NOT exist!');
        
        // List all tables
        const tables = db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        `).all();
        
        console.log('\n📋 Available tables:');
        tables.forEach(table => {
            console.log(`  - ${table.name}`);
        });
    }
    
    db.close();
    console.log('\n✅ Food Order Items table schema check completed!');
    
} catch (error) {
    console.error('❌ Error checking food_order_items schema:', error.message);
    process.exit(1);
}
