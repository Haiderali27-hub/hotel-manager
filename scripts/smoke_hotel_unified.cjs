const Database = require('better-sqlite3');

const db = new Database('./db/hotel.db');
db.pragma('foreign_keys = ON');

const requiredTables = [
  'resources',
  'customers',
  'menu_items',
  'sales',
  'sale_items',
  'expenses',
  'hotel_rooms',
  'hotel_guests',
  'hotel_bookings',
  'restaurant_orders',
  'restaurant_order_items',
];

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const hasTable = (name) =>
  !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);

for (const table of requiredTables) {
  assert(hasTable(table), `Missing required table: ${table}`);
}

const now = new Date().toISOString();
const today = now.slice(0, 10);
const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const cleanup = db.transaction(() => {
  db.prepare("DELETE FROM restaurant_order_items WHERE restaurant_order_id IN (SELECT id FROM restaurant_orders WHERE customer_name LIKE 'Smoke%')").run();
  db.prepare("DELETE FROM restaurant_orders WHERE customer_name LIKE 'Smoke%'").run();
  db.prepare("DELETE FROM hotel_bookings WHERE notes LIKE 'smoke-%'").run();
  db.prepare("DELETE FROM hotel_guests WHERE full_name LIKE 'Smoke %'").run();
  db.prepare("DELETE FROM hotel_rooms WHERE room_number LIKE 'SMK-%'").run();
  db.prepare("DELETE FROM sale_items WHERE item_name LIKE 'Smoke %'").run();
  db.prepare("DELETE FROM sales WHERE customer_name LIKE 'Smoke%'").run();
  db.prepare("DELETE FROM menu_items WHERE name LIKE 'Smoke %'").run();
  db.prepare("DELETE FROM expenses WHERE description LIKE 'Smoke %'").run();
  db.prepare("DELETE FROM customers WHERE name LIKE 'Smoke %'").run();
  db.prepare("DELETE FROM resources WHERE number LIKE 'SMK-%'").run();
});

cleanup();

const runSmoke = db.transaction(() => {
  const resourceId = db
    .prepare(
      `INSERT INTO resources (number, room_type, daily_rate, is_occupied, is_active, resource_type, created_at, updated_at)
       VALUES (?, ?, ?, 0, 1, 'Room', ?, ?)`
    )
    .run('SMK-101', 'Standard', 2500, now, now).lastInsertRowid;

  const customerId = db
    .prepare(
      `INSERT INTO customers (name, phone, room_id, check_in, check_out, daily_rate, status, loyalty_points, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', 0, ?, ?)`
    )
    .run('Smoke Guest', '0000000000', Number(resourceId), today, tomorrow, 2500, now, now).lastInsertRowid;

  db.prepare(
    `INSERT INTO hotel_rooms (resource_id, room_number, room_type, base_rate, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'available', ?, ?)`
  ).run(Number(resourceId), 'SMK-101', 'Standard', 2500, now, now);

  const hotelGuestId = db
    .prepare(
      `INSERT INTO hotel_guests (customer_id, full_name, phone, email, id_document, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(Number(customerId), 'Smoke Guest', '0000000000', 'smoke@example.com', 'SMOKE-ID', now).lastInsertRowid;

  db.prepare(
    `INSERT INTO hotel_bookings (hotel_room_id, hotel_guest_id, check_in_date, check_out_date, nightly_rate, status, source, notes, created_at, updated_at)
     VALUES ((SELECT id FROM hotel_rooms WHERE room_number='SMK-101'), ?, ?, ?, ?, 'reserved', 'smoke', 'smoke-booking', ?, ?)`
  ).run(Number(hotelGuestId), today, tomorrow, 2500, now, now);

  const menuItemId = db
    .prepare(
      `INSERT INTO menu_items (name, sku, price, category, description, is_available, is_active, stock_quantity, track_stock, low_stock_limit, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, 1, 0, 0, 5, ?, ?)`
    )
    .run('Smoke Tea', 'SMOKE-TEA', 120, 'Beverages', 'Smoke menu item', now, now).lastInsertRowid;

  const saleId = db
    .prepare(
      `INSERT INTO sales (guest_id, customer_type, customer_name, created_at, paid, total_amount)
       VALUES (?, 'active', ?, ?, 0, ?)`
    )
    .run(Number(customerId), 'Smoke Guest', now, 240).lastInsertRowid;

  db.prepare(
    `INSERT INTO sale_items (order_id, menu_item_id, item_name, unit_price, quantity, line_total)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(Number(saleId), Number(menuItemId), 'Smoke Tea', 120, 2, 240);

  const restaurantOrderId = db
    .prepare(
      `INSERT INTO restaurant_orders (sale_id, customer_name, order_status, subtotal, tax_amount, discount_amount, total_amount, created_at, updated_at)
       VALUES (?, ?, 'open', 240, 0, 0, 240, ?, ?)`
    )
    .run(Number(saleId), 'Smoke Guest', now, now).lastInsertRowid;

  db.prepare(
    `INSERT INTO restaurant_order_items (restaurant_order_id, menu_item_id, item_name, quantity, unit_price, line_total, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(Number(restaurantOrderId), Number(menuItemId), 'Smoke Tea', 2, 120, 240, 'smoke-item');

  db.prepare(
    `INSERT INTO expenses (date, category, description, amount, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(today, 'Groceries', 'Smoke expense', 100, now);

  db.prepare(`UPDATE sales SET paid = 1, paid_at = ? WHERE id = ?`).run(now, Number(saleId));
  db.prepare(`UPDATE customers SET status = 'checked_out', check_out = ? WHERE id = ?`).run(today, Number(customerId));

  const historyRows = db
    .prepare(
      `SELECT s.id, s.customer_name, s.total_amount, s.paid, si.item_name
       FROM sales s
       JOIN sale_items si ON si.order_id = s.id
       WHERE s.customer_name LIKE 'Smoke%'
       ORDER BY s.id DESC`
    )
    .all();

  assert(historyRows.length >= 1, 'History query did not return expected smoke rows');

  return {
    resourceId,
    customerId,
    menuItemId,
    saleId,
    restaurantOrderId,
    historyRows: historyRows.length,
  };
});

try {
  const result = runSmoke();
  console.log('Unified hotel smoke passed:', result);
} catch (error) {
  console.error('Unified hotel smoke failed:', error.message);
  process.exit(1);
} finally {
  cleanup();
  db.close();
}
