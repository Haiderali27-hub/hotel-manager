const sqlite = require('better-sqlite3');

// Open the database
const db = sqlite('./db/hotel.db');

// Add additional tables for financial tracking
db.prepare(`
  CREATE TABLE IF NOT EXISTS revenue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    description TEXT,
    amount REAL NOT NULL,
    revenue_date TEXT NOT NULL,
    guest_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    expense_date TEXT NOT NULL,
    payment_method TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS food_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guest_id INTEGER,
    room_number INTEGER NOT NULL,
    items TEXT NOT NULL,
    total_amount REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    order_date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// Update guests table with additional columns
try {
  db.prepare('ALTER TABLE guests ADD COLUMN email TEXT').run();
} catch (e) { /* Column might already exist */ }

try {
  db.prepare('ALTER TABLE guests ADD COLUMN phone TEXT').run();
} catch (e) { /* Column might already exist */ }

try {
  db.prepare('ALTER TABLE guests ADD COLUMN total_amount REAL DEFAULT 0').run();
} catch (e) { /* Column might already exist */ }

try {
  db.prepare('ALTER TABLE guests ADD COLUMN paid_amount REAL DEFAULT 0').run();
} catch (e) { /* Column might already exist */ }

try {
  db.prepare('ALTER TABLE guests ADD COLUMN status TEXT DEFAULT "active"').run();
} catch (e) { /* Column might already exist */ }

// Add sample revenue data for current month
const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

const revenueData = [
  { source: 'room_booking', description: 'Room 101 booking', amount: 15000, date: `${currentMonth}-01` },
  { source: 'room_booking', description: 'Room 102 booking', amount: 12000, date: `${currentMonth}-02` },
  { source: 'room_booking', description: 'Room 103 booking', amount: 18000, date: `${currentMonth}-03` },
  { source: 'food_order', description: 'Restaurant order', amount: 5000, date: `${currentMonth}-01` },
  { source: 'food_order', description: 'Room service', amount: 3000, date: `${currentMonth}-02` },
  { source: 'laundry', description: 'Laundry service', amount: 2000, date: `${currentMonth}-01` },
  { source: 'parking', description: 'Parking fees', amount: 1500, date: `${currentMonth}-03` },
];

const revenueStmt = db.prepare(`
  INSERT INTO revenue (source, description, amount, revenue_date)
  VALUES (?, ?, ?, ?)
`);

revenueData.forEach(item => {
  revenueStmt.run(item.source, item.description, item.amount, item.date);
});

// Add sample expense data
const expenseData = [
  { category: 'utilities', description: 'Electricity bill', amount: 8000, date: `${currentMonth}-01`, payment_method: 'bank_transfer' },
  { category: 'supplies', description: 'Cleaning supplies', amount: 3000, date: `${currentMonth}-02`, payment_method: 'cash' },
  { category: 'maintenance', description: 'Room repairs', amount: 5000, date: `${currentMonth}-03`, payment_method: 'bank_transfer' },
  { category: 'staff', description: 'Staff salaries', amount: 25000, date: `${currentMonth}-01`, payment_method: 'bank_transfer' },
  { category: 'food', description: 'Kitchen supplies', amount: 4000, date: `${currentMonth}-02`, payment_method: 'cash' },
];

const expenseStmt = db.prepare(`
  INSERT INTO expenses (category, description, amount, expense_date, payment_method)
  VALUES (?, ?, ?, ?, ?)
`);

expenseData.forEach(item => {
  expenseStmt.run(item.category, item.description, item.amount, item.date, item.payment_method);
});

// Add sample food orders
const foodOrderData = [
  { guest_id: 1, room_number: 101, items: 'Breakfast combo, Coffee', amount: 1500, date: `${currentMonth}-01` },
  { guest_id: 1, room_number: 101, items: 'Lunch buffet', amount: 2000, date: `${currentMonth}-01` },
  { room_number: 102, items: 'Dinner, Soft drinks', amount: 2500, date: `${currentMonth}-02` },
  { room_number: 103, items: 'Snacks, Tea', amount: 800, date: `${currentMonth}-03` },
];

const orderStmt = db.prepare(`
  INSERT INTO food_orders (guest_id, room_number, items, total_amount, order_date, status)
  VALUES (?, ?, ?, ?, ?, 'completed')
`);

foodOrderData.forEach(item => {
  orderStmt.run(item.guest_id || null, item.room_number, item.items, item.amount, item.date);
});

// Add more guests for current month
const additionalGuests = [
  { name: 'Alice Johnson', email: 'alice@email.com', phone: '0300-1234567', room: 102, checkin: `${currentMonth}-05`, total: 15000, paid: 15000, status: 'active' },
  { name: 'Bob Smith', email: 'bob@email.com', phone: '0301-2345678', room: 103, checkin: `${currentMonth}-08`, total: 12000, paid: 8000, status: 'active' },
  { name: 'Carol Wilson', email: 'carol@email.com', phone: '0302-3456789', room: 104, checkin: `${currentMonth}-10`, checkout: `${currentMonth}-12`, total: 18000, paid: 18000, status: 'checked_out' },
];

const guestStmt = db.prepare(`
  INSERT INTO guests (name, email, phone, room, checkin_date, checkout_date, total_amount, paid_amount, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

additionalGuests.forEach(guest => {
  guestStmt.run(guest.name, guest.email, guest.phone, guest.room, guest.checkin, guest.checkout || null, guest.total, guest.paid, guest.status);
});

console.log("Sample data added successfully!");
console.log("=== DASHBOARD DATA ===");
console.log("Revenue entries:", revenueData.length);
console.log("Expense entries:", expenseData.length);
console.log("Food orders:", foodOrderData.length);
console.log("Additional guests:", additionalGuests.length);
console.log("=====================");

db.close();
