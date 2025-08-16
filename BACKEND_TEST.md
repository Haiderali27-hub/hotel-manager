# Backend API Testing Guide

## Test Commands in Browser Console

Open the Tauri app and test these commands in the browser developer console:

### 1. Test Room Management
```javascript
// Add a room
await window.__TAURI__.invoke('add_room', { number: 'TEST101' });

// Get all rooms
await window.__TAURI__.invoke('get_rooms');

// Delete room (use actual ID from get_rooms)
await window.__TAURI__.invoke('delete_room', { id: 1 });
```

### 2. Test Guest Management
```javascript
// Add a guest
await window.__TAURI__.invoke('add_guest', {
    name: 'John Doe',
    phone: '123-456-7890',
    room_id: 1,
    check_in: '2025-08-16',
    check_out: null,
    daily_rate: 100.0
});

// Get active guests
await window.__TAURI__.invoke('get_active_guests');

// Checkout guest (use actual guest_id)
await window.__TAURI__.invoke('checkout_guest', {
    guest_id: 1,
    discount_flat: null,
    discount_pct: null
});
```

### 3. Test Menu Management
```javascript
// Add menu item
await window.__TAURI__.invoke('add_menu_item', {
    name: 'Test Burger',
    price: 15.99
});

// Get menu items
await window.__TAURI__.invoke('get_menu_items');
```

### 4. Test Food Orders
```javascript
// Add food order
await window.__TAURI__.invoke('add_food_order', {
    guest_id: 1,
    customer_type: 'guest',
    customer_name: null,
    items: [
        {
            menu_item_id: 1,
            item_name: 'Test Burger',
            unit_price: 15.99,
            quantity: 2
        }
    ]
});

// Get orders for guest
await window.__TAURI__.invoke('get_food_orders_by_guest', { guest_id: 1 });

// Mark order paid
await window.__TAURI__.invoke('mark_order_paid', { order_id: 1 });
```

### 5. Test Expenses
```javascript
// Add expense
await window.__TAURI__.invoke('add_expense', {
    date: '2025-08-16',
    category: 'Utilities',
    description: 'Electricity bill',
    amount: 250.0
});

// Get expenses
await window.__TAURI__.invoke('get_expenses', {
    start_date: null,
    end_date: null
});
```

### 6. Test Dashboard
```javascript
// Get dashboard stats
await window.__TAURI__.invoke('dashboard_stats');
```

### 7. Test Authentication
```javascript
// Note: First time will fail until admin password is set
await window.__TAURI__.invoke('login_admin', { password: 'admin123' });
```

## Expected Results
- All commands should return successful results or meaningful error messages
- No crashes or undefined errors
- Database should persist data between app restarts
