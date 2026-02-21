const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Create db directory if it doesn't exist
const dbDir = path.join(__dirname, '..', 'db');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(path.join(dbDir, 'hotel.db'));

console.log('🚀 Starting database seeding...');

try {
    // ===== CREATE TABLES =====
    console.log('📋 Creating database tables...');

    // Drop existing tables if they exist (to handle schema changes)
    db.exec('DROP TABLE IF EXISTS food_orders');
    db.exec('DROP TABLE IF EXISTS revenue');
    db.exec('DROP TABLE IF EXISTS expenses');
    db.exec('DROP TABLE IF EXISTS guests');
    db.exec('DROP TABLE IF EXISTS rooms');
    db.exec('DROP TABLE IF EXISTS menu_items');
    db.exec('DROP TABLE IF EXISTS admin_auth');

    // Rooms table
    db.exec(`
        CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_number TEXT UNIQUE NOT NULL,
            room_type TEXT NOT NULL,
            price_per_night REAL NOT NULL,
            status TEXT NOT NULL DEFAULT 'available',
            max_occupancy INTEGER NOT NULL DEFAULT 2,
            amenities TEXT,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Guests table
    db.exec(`
        CREATE TABLE IF NOT EXISTS guests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            room_id INTEGER NOT NULL,
            checkin_date TEXT NOT NULL,
            checkout_date TEXT,
            total_amount REAL,
            paid_amount REAL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'active',
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(room_id) REFERENCES rooms(id)
        )
    `);

    // Menu items table
    db.exec(`
        CREATE TABLE IF NOT EXISTS menu_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            description TEXT,
            price REAL NOT NULL,
            is_available BOOLEAN NOT NULL DEFAULT 1,
            preparation_time INTEGER,
            ingredients TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Food orders table
    db.exec(`
        CREATE TABLE IF NOT EXISTS food_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guest_id INTEGER,
            room_number TEXT NOT NULL,
            items TEXT NOT NULL,
            total_amount REAL NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            order_date TEXT NOT NULL,
            delivery_time TEXT,
            special_instructions TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(guest_id) REFERENCES guests(id)
        )
    `);

    // Expenses table
    db.exec(`
        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            description TEXT NOT NULL,
            amount REAL NOT NULL,
            expense_date TEXT NOT NULL,
            payment_method TEXT,
            receipt_number TEXT,
            vendor TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Revenue table
    db.exec(`
        CREATE TABLE IF NOT EXISTS revenue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT NOT NULL,
            description TEXT,
            amount REAL NOT NULL,
            revenue_date TEXT NOT NULL,
            guest_id INTEGER,
            payment_method TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(guest_id) REFERENCES guests(id)
        )
    `);

    // ===== SEED ROOMS =====
    console.log('🏨 Adding sample rooms...');

    const insertRoom = db.prepare(`
        INSERT OR REPLACE INTO rooms (room_number, room_type, price_per_night, status, max_occupancy, amenities, description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const rooms = [
        ['101', 'single', 3500, 'available', 1, '["WiFi", "TV", "AC", "Mini Bar"]', 'Cozy single room with garden view'],
        ['102', 'single', 3500, 'available', 1, '["WiFi", "TV", "AC", "Mini Bar"]', 'Comfortable single room'],
        ['103', 'double', 5500, 'available', 2, '["WiFi", "TV", "AC", "Mini Bar", "Balcony"]', 'Spacious double room with balcony'],
        ['104', 'double', 5500, 'occupied', 2, '["WiFi", "TV", "AC", "Mini Bar", "Balcony"]', 'Premium double room'],
        ['105', 'suite', 8500, 'available', 4, '["WiFi", "TV", "AC", "Mini Bar", "Kitchenette", "Living Area"]', 'Luxury suite with separate living area'],
        ['201', 'single', 3800, 'available', 1, '["WiFi", "TV", "AC", "Mini Bar", "City View"]', 'Single room with city view'],
        ['202', 'double', 6000, 'occupied', 2, '["WiFi", "TV", "AC", "Mini Bar", "Balcony", "Sea View"]', 'Double room with sea view'],
        ['203', 'deluxe', 7500, 'available', 3, '["WiFi", "TV", "AC", "Mini Bar", "Jacuzzi", "Premium Amenities"]', 'Deluxe room with jacuzzi'],
        ['204', 'suite', 9000, 'maintenance', 4, '["WiFi", "TV", "AC", "Mini Bar", "Kitchenette", "Living Area", "Balcony"]', 'Premium suite under maintenance'],
        ['301', 'deluxe', 8000, 'available', 3, '["WiFi", "TV", "AC", "Mini Bar", "Jacuzzi", "Premium Amenities", "Terrace"]', 'Deluxe room with private terrace']
    ];

    for (const room of rooms) {
        insertRoom.run(...room);
    }

    // ===== SEED MENU ITEMS =====
    console.log('🍽️ Adding sample menu items...');

    const insertMenuItem = db.prepare(`
        INSERT OR REPLACE INTO menu_items (name, category, description, price, is_available, preparation_time, ingredients)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const menuItems = [
        // Breakfast
        ['Continental Breakfast', 'breakfast', 'Fresh bread, butter, jam, tea/coffee', 850, 1, 15, 'Bread, butter, jam, tea, coffee'],
        ['Desi Breakfast', 'breakfast', 'Paratha, omelet, tea', 950, 1, 20, 'Wheat flour, eggs, tea'],
        ['English Breakfast', 'breakfast', 'Eggs, beans, toast, sausage, tea/coffee', 1200, 1, 25, 'Eggs, beans, bread, sausage'],
        ['Pancakes', 'breakfast', 'Fluffy pancakes with syrup and butter', 750, 1, 20, 'Flour, eggs, milk, syrup'],

        // Lunch
        ['Chicken Karahi', 'lunch', 'Traditional spicy chicken curry', 1800, 1, 35, 'Chicken, tomatoes, spices, oil'],
        ['Beef Biryani', 'lunch', 'Aromatic rice with tender beef', 2200, 1, 45, 'Rice, beef, spices, yogurt'],
        ['Dal Makhani', 'lunch', 'Creamy black lentil curry', 1200, 1, 30, 'Black lentils, cream, spices'],
        ['Grilled Fish', 'lunch', 'Fresh fish with herbs and spices', 2500, 1, 25, 'Fish, herbs, spices'],
        ['Vegetable Curry', 'lunch', 'Mixed seasonal vegetables', 1000, 1, 25, 'Mixed vegetables, spices'],

        // Dinner
        ['Mutton Karahi', 'dinner', 'Traditional mutton curry', 2800, 1, 50, 'Mutton, tomatoes, spices'],
        ['Chicken BBQ', 'dinner', 'Grilled chicken with BBQ sauce', 2200, 1, 30, 'Chicken, BBQ sauce, spices'],
        ['Seekh Kebab', 'dinner', 'Grilled minced meat skewers', 1800, 1, 25, 'Minced meat, spices'],
        ['Fish Curry', 'dinner', 'Spicy fish curry with rice', 2000, 1, 30, 'Fish, curry spices, rice'],

        // Snacks
        ['Samosa (2 pcs)', 'snacks', 'Crispy fried pastry with filling', 180, 1, 10, 'Flour, potatoes, spices'],
        ['Pakora', 'snacks', 'Mixed vegetable fritters', 250, 1, 15, 'Vegetables, gram flour, spices'],
        ['French Fries', 'snacks', 'Golden crispy potato fries', 350, 1, 12, 'Potatoes, oil, salt'],
        ['Chicken Roll', 'snacks', 'Spiced chicken wrapped in paratha', 450, 1, 20, 'Chicken, paratha, vegetables'],
        ['Club Sandwich', 'snacks', 'Multi-layer sandwich with chicken', 650, 1, 15, 'Bread, chicken, vegetables'],

        // Beverages
        ['Tea (Chai)', 'beverages', 'Traditional Pakistani tea', 120, 1, 5, 'Tea leaves, milk, sugar'],
        ['Coffee', 'beverages', 'Hot brewed coffee', 180, 1, 5, 'Coffee beans, milk, sugar'],
        ['Fresh Orange Juice', 'beverages', 'Freshly squeezed orange juice', 280, 1, 8, 'Fresh oranges'],
        ['Mango Juice', 'beverages', 'Fresh mango juice', 320, 1, 8, 'Fresh mangoes'],
        ['Lassi', 'beverages', 'Traditional yogurt drink', 250, 1, 5, 'Yogurt, sugar, ice'],
        ['Soft Drinks', 'beverages', 'Coke, Pepsi, Sprite, etc.', 150, 1, 2, 'Carbonated drinks'],
        ['Mineral Water', 'beverages', 'Chilled mineral water bottle', 80, 1, 1, 'Mineral water']
    ];

    for (const item of menuItems) {
        insertMenuItem.run(...item);
    }

    // ===== ADD SAMPLE GUESTS =====
    console.log('👥 Adding sample guests...');

    const insertGuest = db.prepare(`
        INSERT OR REPLACE INTO guests (name, email, phone, room_id, checkin_date, total_amount, paid_amount, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const guests = [
        ['Ahmed Hassan', 'ahmed.hassan@email.com', '+92-300-1234567', 4, '2025-08-10', 11000, 5500, 'active', 'VIP guest, prefers room service'],
        ['Sara Khan', 'sara.khan@email.com', '+92-301-9876543', 7, '2025-08-12', 12000, 6000, 'active', 'Corporate booking, late checkout requested'],
    ];

    for (const guest of guests) {
        insertGuest.run(...guest);
    }

    // ===== ADD SAMPLE REVENUE & EXPENSES =====
    console.log('💰 Adding sample financial data...');

    const insertRevenue = db.prepare(`
        INSERT OR REPLACE INTO revenue (source, description, amount, revenue_date, payment_method)
        VALUES (?, ?, ?, ?, ?)
    `);

    const insertExpense = db.prepare(`
        INSERT OR REPLACE INTO expenses (category, description, amount, expense_date, payment_method, vendor)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Revenue entries
    const revenues = [
        ['room_booking', 'Room 104 - Ahmed Hassan', 5500, '2025-08-10', 'card'],
        ['room_booking', 'Room 202 - Sara Khan', 6000, '2025-08-12', 'cash'],
        ['food_order', 'Room service orders', 3500, '2025-08-13', 'cash'],
        ['services', 'Laundry service', 800, '2025-08-13', 'card'],
        ['room_booking', 'Previous guest checkout', 7500, '2025-08-09', 'bank_transfer']
    ];

    for (const revenue of revenues) {
        insertRevenue.run(...revenue);
    }

    // Expense entries
    const expenses = [
        ['maintenance', 'Room 301 AC repair', 8500, '2025-08-11', 'cash', 'Cool Tech Services'],
        ['supplies', 'Kitchen ingredients and supplies', 15000, '2025-08-12', 'card', 'Metro Cash & Carry'],
        ['utilities', 'Electricity bill', 18000, '2025-08-10', 'bank_transfer', 'LESCO'],
        ['staff', 'Staff salaries', 45000, '2025-08-01', 'bank_transfer', 'Payroll'],
        ['marketing', 'Online advertising', 5000, '2025-08-09', 'card', 'Google Ads']
    ];

    for (const expense of expenses) {
        insertExpense.run(...expense);
    }

    console.log('✅ Database seeding completed successfully!');
    console.log('=== SEEDED DATA SUMMARY ===');
    console.log(`Rooms: ${db.prepare('SELECT COUNT(*) FROM rooms').get()['COUNT(*)']}`);
    console.log(`Menu Items: ${db.prepare('SELECT COUNT(*) FROM menu_items').get()['COUNT(*)']}`);
    console.log(`Guests: ${db.prepare('SELECT COUNT(*) FROM guests').get()['COUNT(*)']}`);
    console.log(`Revenue Entries: ${db.prepare('SELECT COUNT(*) FROM revenue').get()['COUNT(*)']}`);
    console.log(`Expense Entries: ${db.prepare('SELECT COUNT(*) FROM expenses').get()['COUNT(*)']}`);
    console.log('============================');

} catch (error) {
    console.error('❌ Error seeding database:', error);
} finally {
    db.close();
}
