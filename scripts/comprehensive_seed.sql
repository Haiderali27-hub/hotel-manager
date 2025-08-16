-- ============================================================================
-- COMPREHENSIVE SEED DATA - Hotel Management System
-- ============================================================================
-- This script creates a full dataset for testing and development
-- Run this to get a realistic hotel with guests, orders, and history

-- Clear existing data (in correct order due to foreign keys)
DELETE FROM food_order_items;
DELETE FROM food_orders;
DELETE FROM expenses;
DELETE FROM guests;
DELETE FROM rooms;
DELETE FROM menu_items;
DELETE FROM admin_settings;

-- ===== ROOMS (20 rooms across different price tiers) =====
INSERT INTO rooms (number, daily_rate) VALUES
  -- Standard rooms (Floor 1)
  ('101', 120.00), ('102', 120.00), ('103', 120.00), ('104', 120.00), ('105', 120.00),
  ('106', 120.00), ('107', 120.00), ('108', 120.00),
  
  -- Deluxe rooms (Floor 2)  
  ('201', 180.00), ('202', 180.00), ('203', 180.00), ('204', 180.00), ('205', 180.00),
  ('206', 180.00), ('207', 180.00), ('208', 180.00),
  
  -- Premium suites (Floor 3)
  ('301', 250.00), ('302', 250.00), ('303', 280.00), ('304', 320.00);

-- ===== MENU ITEMS (Diverse restaurant menu) =====
INSERT INTO menu_items (name, price, category, is_available) VALUES
  -- Breakfast (6:00 AM - 11:00 AM)
  ('Continental Breakfast', 18.50, 'Breakfast', 1),
  ('Full English Breakfast', 24.00, 'Breakfast', 1),
  ('Pancakes with Maple Syrup', 16.00, 'Breakfast', 1),
  ('Fresh Fruit Bowl', 12.00, 'Breakfast', 1),
  ('Avocado Toast', 14.50, 'Breakfast', 1),
  
  -- Main Courses
  ('Grilled Chicken Breast', 28.00, 'Main Course', 1),
  ('Beef Tenderloin Steak', 42.00, 'Main Course', 1),
  ('Pan-Seared Salmon', 32.00, 'Main Course', 1),
  ('Vegetarian Pasta Primavera', 22.00, 'Main Course', 1),
  ('Lamb Curry with Rice', 26.00, 'Main Course', 1),
  ('Fish and Chips', 24.00, 'Main Course', 1),
  ('Chicken Caesar Salad', 20.00, 'Main Course', 1),
  
  -- Appetizers & Snacks
  ('Garlic Bread', 8.50, 'Appetizer', 1),
  ('Buffalo Wings (6pc)', 16.00, 'Appetizer', 1),
  ('Cheese Platter', 22.00, 'Appetizer', 1),
  ('Soup of the Day', 11.00, 'Appetizer', 1),
  ('Nachos Supreme', 18.00, 'Appetizer', 1),
  
  -- Desserts
  ('Chocolate Brownie', 12.00, 'Dessert', 1),
  ('Tiramisu', 14.00, 'Dessert', 1),
  ('Ice Cream (3 scoops)', 9.00, 'Dessert', 1),
  ('Cheesecake', 13.50, 'Dessert', 1),
  
  -- Beverages
  ('Coffee', 4.50, 'Beverage', 1),
  ('Tea Selection', 4.00, 'Beverage', 1),
  ('Fresh Orange Juice', 7.00, 'Beverage', 1),
  ('Coca Cola', 3.50, 'Beverage', 1),
  ('Mineral Water', 3.00, 'Beverage', 1),
  ('Red Wine (Glass)', 12.00, 'Beverage', 1),
  ('White Wine (Glass)', 11.00, 'Beverage', 1),
  ('Local Beer', 6.50, 'Beverage', 1),
  
  -- Room Service
  ('Club Sandwich', 19.00, 'Room Service', 1),
  ('Burger and Fries', 21.00, 'Room Service', 1),
  ('Pizza Margherita', 18.00, 'Room Service', 1);

-- ===== GUESTS (Mix of current and historical) =====
-- Current guests (checked in, active)
INSERT INTO guests (name, phone, room_id, check_in, check_out, daily_rate, is_active) VALUES
  ('John Smith', '+1-555-0101', 1, '2025-08-14', NULL, 120.00, 1),          -- 3 days
  ('Sarah Johnson', '+1-555-0102', 5, '2025-08-15', NULL, 120.00, 1),        -- 2 days  
  ('Michael Chen', '+1-555-0103', 9, '2025-08-16', NULL, 180.00, 1),         -- 1 day
  ('Emily Davis', '+1-555-0104', 12, '2025-08-13', NULL, 180.00, 1),         -- 4 days
  ('Robert Wilson', '+1-555-0105', 17, '2025-08-15', NULL, 250.00, 1),       -- 2 days
  ('Lisa Anderson', '+1-555-0106', 19, '2025-08-16', NULL, 250.00, 1),       -- 1 day
  
  -- Recent checkouts (this month)
  ('David Brown', '+1-555-0201', 2, '2025-08-10', '2025-08-13', 120.00, 0),   -- 3 days
  ('Jessica Garcia', '+1-555-0202', 6, '2025-08-08', '2025-08-11', 120.00, 0), -- 3 days
  ('Thomas Martinez', '+1-555-0203', 10, '2025-08-05', '2025-08-09', 180.00, 0), -- 4 days
  ('Amanda Rodriguez', '+1-555-0204', 13, '2025-08-01', '2025-08-05', 180.00, 0), -- 4 days
  ('Christopher Lee', '+1-555-0205', 18, '2025-08-03', '2025-08-07', 250.00, 0), -- 4 days
  
  -- Previous month guests (July)
  ('Jennifer Taylor', '+1-555-0301', 3, '2025-07-28', '2025-07-31', 120.00, 0), -- 3 days
  ('Daniel White', '+1-555-0302', 7, '2025-07-25', '2025-07-29', 120.00, 0),    -- 4 days
  ('Michelle Harris', '+1-555-0303', 11, '2025-07-20', '2025-07-24', 180.00, 0), -- 4 days
  ('Kevin Clark', '+1-555-0304', 14, '2025-07-15', '2025-07-19', 180.00, 0),    -- 4 days
  ('Ashley Lewis', '+1-555-0305', 20, '2025-07-10', '2025-07-14', 280.00, 0);   -- 4 days

-- ===== FOOD ORDERS (Realistic ordering patterns) =====
-- Current guests' orders (some paid, some pending)
INSERT INTO food_orders (guest_id, order_date, total_amount, is_paid) VALUES
  -- John Smith (Room 101) - 3 days, multiple orders
  (1, '2025-08-14', 42.50, 1),   -- Breakfast + coffee (Day 1)
  (1, '2025-08-14', 74.00, 1),   -- Dinner (Day 1)  
  (1, '2025-08-15', 22.50, 1),   -- Breakfast (Day 2)
  (1, '2025-08-15', 58.00, 0),   -- Lunch - UNPAID (Day 2)
  (1, '2025-08-16', 22.50, 0),   -- Breakfast - UNPAID (Day 3)
  
  -- Sarah Johnson (Room 105) - 2 days
  (2, '2025-08-15', 31.00, 1),   -- Breakfast + juice (Day 1)
  (2, '2025-08-15', 45.00, 1),   -- Dinner (Day 1)
  (2, '2025-08-16', 27.00, 0),   -- Breakfast - UNPAID (Day 2)
  
  -- Michael Chen (Room 201) - 1 day, high-end orders
  (3, '2025-08-16', 89.50, 0),   -- Breakfast + steak lunch - UNPAID
  
  -- Emily Davis (Room 204) - 4 days, frequent orders
  (4, '2025-08-13', 38.00, 1),   -- Day 1
  (4, '2025-08-14', 52.00, 1),   -- Day 2  
  (4, '2025-08-15', 43.50, 1),   -- Day 3
  (4, '2025-08-16', 29.00, 0),   -- Day 4 - UNPAID
  
  -- Robert Wilson (Room 301) - 2 days, premium guest
  (5, '2025-08-15', 95.00, 1),   -- High-end dinner
  (5, '2025-08-16', 67.50, 0),   -- Breakfast + lunch - UNPAID
  
  -- Lisa Anderson (Room 303) - 1 day
  (6, '2025-08-16', 34.50, 0),   -- Breakfast - UNPAID
  
  -- Historical orders (recent checkouts)
  (7, '2025-08-10', 45.00, 1),   -- David Brown
  (7, '2025-08-11', 38.50, 1),
  (7, '2025-08-12', 52.00, 1),
  
  (8, '2025-08-08', 33.00, 1),   -- Jessica Garcia  
  (8, '2025-08-09', 41.50, 1),
  (8, '2025-08-10', 29.00, 1),
  
  (9, '2025-08-05', 67.00, 1),   -- Thomas Martinez
  (9, '2025-08-06', 78.50, 1),
  (9, '2025-08-07', 43.00, 1),
  (9, '2025-08-08', 55.50, 1);

-- ===== FOOD ORDER ITEMS (Detailed order contents) =====
-- John Smith's orders
INSERT INTO food_order_items (order_id, menu_item_id, quantity, unit_price) VALUES
  -- Order 1: Breakfast + coffee
  (1, 2, 1, 24.00),  -- Full English Breakfast
  (1, 22, 1, 4.50),  -- Coffee  
  (1, 24, 1, 7.00),  -- Orange juice
  (1, 25, 2, 3.50),  -- Coca Cola x2
  
  -- Order 2: Dinner
  (2, 7, 1, 42.00),  -- Beef Tenderloin
  (2, 13, 1, 8.50),  -- Garlic bread
  (2, 26, 2, 12.00), -- Wine x2
  
  -- Order 3: Simple breakfast
  (3, 1, 1, 18.50),  -- Continental breakfast
  (3, 22, 1, 4.00),  -- Tea
  
  -- Order 4: Lunch (UNPAID)
  (4, 8, 1, 32.00),  -- Salmon
  (4, 16, 1, 11.00), -- Soup
  (4, 27, 1, 11.00), -- White wine
  (4, 22, 1, 4.00),  -- Coffee
  
  -- Order 5: Breakfast (UNPAID)
  (5, 3, 1, 16.00),  -- Pancakes
  (5, 24, 1, 7.00);  -- Orange juice

-- Sarah Johnson's orders  
INSERT INTO food_order_items (order_id, menu_item_id, quantity, unit_price) VALUES
  -- Order 6: Breakfast + juice
  (6, 1, 1, 18.50),  -- Continental breakfast
  (6, 24, 1, 7.00),  -- Orange juice
  (6, 4, 1, 12.00),  -- Fruit bowl
  
  -- Order 7: Dinner
  (7, 6, 1, 28.00),  -- Grilled chicken
  (7, 15, 1, 16.00),  -- Buffalo wings
  (7, 22, 1, 4.00),   -- Coffee
  
  -- Order 8: Breakfast (UNPAID)
  (8, 5, 1, 14.50),  -- Avocado toast
  (8, 22, 1, 4.00),  -- Coffee
  (8, 20, 1, 9.00);  -- Ice cream

-- Continue with more detailed order items for realism...
-- Michael Chen (premium orders)
INSERT INTO food_order_items (order_id, menu_item_id, quantity, unit_price) VALUES
  (9, 2, 1, 24.00),  -- Full breakfast
  (9, 7, 1, 42.00),  -- Beef steak
  (9, 15, 1, 22.00), -- Cheese platter
  (9, 22, 1, 4.50);  -- Coffee

-- ===== BUSINESS EXPENSES (6 months of realistic data) =====
INSERT INTO expenses (date, category, description, amount) VALUES
  -- August 2025 (current month)
  ('2025-08-01', 'Utilities', 'Electricity bill - July', 425.00),
  ('2025-08-03', 'Food & Beverage', 'Weekly grocery shopping', 380.50),
  ('2025-08-05', 'Maintenance', 'HVAC system repair - Room 205', 295.00),
  ('2025-08-07', 'Supplies', 'Cleaning supplies and linens', 180.75),
  ('2025-08-10', 'Food & Beverage', 'Weekly grocery shopping', 420.25),
  ('2025-08-12', 'Marketing', 'Google Ads campaign', 150.00),
  ('2025-08-14', 'Utilities', 'Water and sewer bill', 185.50),
  ('2025-08-16', 'Food & Beverage', 'Premium wine restock', 540.00),
  
  -- July 2025
  ('2025-07-28', 'Utilities', 'Electricity bill - June', 398.75),
  ('2025-07-25', 'Food & Beverage', 'Weekly grocery shopping', 365.00),
  ('2025-07-22', 'Maintenance', 'Plumbing repair - Room 108', 175.00),
  ('2025-07-20', 'Supplies', 'Bathroom amenities restock', 245.50),
  ('2025-07-18', 'Food & Beverage', 'Kitchen equipment lease', 320.00),
  ('2025-07-15', 'Insurance', 'Property insurance premium', 890.00),
  ('2025-07-12', 'Marketing', 'Print advertising', 125.00),
  ('2025-07-10', 'Utilities', 'Internet and phone bill', 95.50),
  ('2025-07-08', 'Food & Beverage', 'Weekly grocery shopping', 395.75),
  ('2025-07-05', 'Maintenance', 'Carpet cleaning - Floor 2', 280.00),
  ('2025-07-01', 'Supplies', 'Office supplies and reception', 165.25),
  
  -- June 2025  
  ('2025-06-28', 'Utilities', 'Electricity bill - May', 445.00),
  ('2025-06-25', 'Food & Beverage', 'Monthly beverage restock', 485.50),
  ('2025-06-22', 'Maintenance', 'Air conditioning service', 350.00),
  ('2025-06-20', 'Supplies', 'Guest room amenities', 295.75),
  ('2025-06-18', 'Marketing', 'Website maintenance', 200.00),
  ('2025-06-15', 'Food & Beverage', 'Special event catering supplies', 620.25),
  ('2025-06-12', 'Utilities', 'Gas bill', 125.50),
  ('2025-06-10', 'Maintenance', 'Elevator inspection', 185.00),
  ('2025-06-08', 'Supplies', 'Cleaning equipment replacement', 340.00),
  ('2025-06-05', 'Food & Beverage', 'Weekly grocery shopping', 410.75),
  ('2025-06-01', 'Insurance', 'Liability insurance', 675.00),
  
  -- May 2025
  ('2025-05-30', 'Utilities', 'Electricity bill - April', 385.25),
  ('2025-05-28', 'Food & Beverage', 'Weekend special menu items', 295.00),
  ('2025-05-25', 'Maintenance', 'Pool cleaning and chemicals', 215.50),
  ('2025-05-22', 'Supplies', 'Laundry service supplies', 180.00),
  ('2025-05-20', 'Marketing', 'Social media advertising', 175.00),
  ('2025-05-18', 'Food & Beverage', 'Quality wine selection', 485.75),
  ('2025-05-15', 'Maintenance', 'Garden and landscaping', 225.00),
  ('2025-05-12', 'Utilities', 'Water treatment system', 145.50),
  ('2025-05-10', 'Supplies', 'Guest welcome packages', 165.25),
  ('2025-05-08', 'Food & Beverage', 'Fresh seafood delivery', 380.00),
  ('2025-05-05', 'Maintenance', 'Fire safety system check', 295.00),
  ('2025-05-01', 'Supplies', 'Reception desk supplies', 95.75),
  
  -- April 2025
  ('2025-04-28', 'Utilities', 'Electricity bill - March', 420.00),
  ('2025-04-25', 'Food & Beverage', 'Easter special menu', 340.50),
  ('2025-04-22', 'Maintenance', 'Room 301 bathroom renovation', 1250.00),
  ('2025-04-20', 'Supplies', 'Spring cleaning supplies', 285.75),
  ('2025-04-18', 'Marketing', 'Spring promotion materials', 195.00),
  ('2025-04-15', 'Food & Beverage', 'Seasonal menu ingredients', 425.25),
  ('2025-04-12', 'Maintenance', 'HVAC filter replacement', 155.50),
  ('2025-04-10', 'Utilities', 'Phone system upgrade', 320.00),
  ('2025-04-08', 'Supplies', 'New guest room TVs', 1840.00),
  ('2025-04-05', 'Food & Beverage', 'Coffee machine maintenance', 185.00),
  ('2025-04-01', 'Insurance', 'Equipment insurance', 545.00),
  
  -- March 2025
  ('2025-03-30', 'Utilities', 'Electricity bill - February', 395.75),
  ('2025-03-28', 'Food & Beverage', 'Weekend buffet supplies', 465.00),
  ('2025-03-25', 'Maintenance', 'Parking lot resurfacing', 2150.00),
  ('2025-03-22', 'Supplies', 'Guest bathroom upgrades', 385.50),
  ('2025-03-20', 'Marketing', 'Travel website listings', 275.00),
  ('2025-03-18', 'Food & Beverage', 'Premium meat selection', 520.25),
  ('2025-03-15', 'Maintenance', 'Boiler service and repair', 425.00),
  ('2025-03-12', 'Utilities', 'Security system monitoring', 165.50),
  ('2025-03-10', 'Supplies', 'Bedding and linen replacement', 680.75),
  ('2025-03-08', 'Food & Beverage', 'International cuisine ingredients', 345.00),
  ('2025-03-05', 'Maintenance', 'Window cleaning service', 185.00),
  ('2025-03-01', 'Supplies', 'Guest welcome amenities', 225.25);

-- ===== ADMIN SETTINGS (Single admin user) =====
-- Password: 'admin123' (will be hashed by the application)
INSERT INTO admin_settings (key, value) VALUES
  ('admin_username', 'admin'),
  ('admin_password_hash', '$argon2id$v=19$m=19456,t=2,p=1$placeholder$placeholder'),
  ('hotel_name', 'Grand Vista Hotel'),
  ('hotel_address', '123 Main Street, Downtown'),
  ('hotel_phone', '+1-555-HOTEL-1'),
  ('currency_symbol', '$'),
  ('timezone', 'America/New_York'),
  ('check_in_time', '15:00'),
  ('check_out_time', '11:00');

-- Update room occupancy based on active guests
UPDATE rooms SET is_occupied = 1 WHERE id IN (
  SELECT DISTINCT room_id FROM guests WHERE is_active = 1
);

-- ===== SUMMARY =====
-- Rooms: 20 total (6 occupied, 14 available)
-- Guests: 6 active, 10 historical
-- Menu Items: 30 items across 6 categories  
-- Food Orders: 25+ orders (mix of paid/unpaid)
-- Expenses: 60+ entries across 6 months
-- Admin: Single admin user (username: admin, password: admin123)

-- ===== VERIFICATION QUERIES =====
-- Uncomment these to verify the seeded data:

-- SELECT 'ROOMS' as table_name, COUNT(*) as count FROM rooms
-- UNION SELECT 'GUESTS', COUNT(*) FROM guests  
-- UNION SELECT 'ACTIVE_GUESTS', COUNT(*) FROM guests WHERE is_active = 1
-- UNION SELECT 'MENU_ITEMS', COUNT(*) FROM menu_items
-- UNION SELECT 'FOOD_ORDERS', COUNT(*) FROM food_orders
-- UNION SELECT 'UNPAID_ORDERS', COUNT(*) FROM food_orders WHERE is_paid = 0
-- UNION SELECT 'EXPENSES', COUNT(*) FROM expenses
-- ORDER BY table_name;
