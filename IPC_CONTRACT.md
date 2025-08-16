# 🔗 IPC Contract Documentation

This document defines the complete interface between the frontend and backend. All commands, parameters, return types, and error codes are frozen and guaranteed stable.

## 🎯 Overview

- **Protocol**: Tauri IPC via `invoke("command_name", params)`
- **Data Format**: JSON serialization
- **Error Handling**: String error codes (see Error Codes section)
- **Date Format**: ISO 8601 strings (`YYYY-MM-DD`)
- **Currency**: Numbers (USD, 2 decimal places implied)

## 📋 Commands Reference

### Room Management

#### `add_room`
**Purpose**: Add a new room to the hotel
**Parameters**: 
```json
{
  "number": "string",      // Room number (e.g., "101")
  "dailyRate": "number"    // Daily rate in USD
}
```
**Returns**: `number` (Room ID)
**Errors**: `ROOM_NUMBER_EXISTS`, `NEGATIVE_AMOUNT`, `EMPTY_FIELD`
**Example**:
```ts
const roomId = await invoke("add_room", { number: "101", dailyRate: 150.0 });
```

#### `get_rooms`
**Purpose**: Get all rooms with current status
**Parameters**: None
**Returns**: Array of Room objects
```json
[
  {
    "id": 1,
    "number": "101",
    "daily_rate": 150.0,
    "is_occupied": false,
    "guest_id": null
  }
]
```
**Errors**: `DATABASE_ERROR`

#### `update_room`
**Purpose**: Update room details
**Parameters**: 
```json
{
  "roomId": "number",
  "number": "string?",      // Optional
  "daily_rate": "number?"   // Optional
}
```
**Returns**: `boolean` (Success status)
**Errors**: `ROOM_NOT_FOUND`, `ROOM_OCCUPIED`, `ROOM_NUMBER_EXISTS`

#### `delete_room`
**Purpose**: Delete a room (only if not occupied)
**Parameters**: 
```json
{
  "roomId": "number"
}
```
**Returns**: `boolean` (Success status)
**Errors**: `ROOM_NOT_FOUND`, `ROOM_OCCUPIED`

---

### Guest Management

#### `add_guest`
**Purpose**: Check in a new guest
**Parameters**: 
```json
{
  "name": "string",
  "phone": "string?",      // Optional
  "room_id": "number",
  "check_in": "string",    // YYYY-MM-DD format
  "check_out": "string?",  // YYYY-MM-DD format, optional
  "daily_rate": "number"
}
```
**Returns**: `number` (Guest ID)
**Errors**: `ROOM_NOT_FOUND`, `ROOM_OCCUPIED`, `INVALID_DATE_FORMAT`, `NEGATIVE_AMOUNT`, `EMPTY_FIELD`

#### `get_active_guests`
**Purpose**: Get all currently checked-in guests
**Parameters**: None
**Returns**: Array of Guest objects
```json
[
  {
    "id": 1,
    "name": "John Doe",
    "phone": "555-0123",
    "room_id": 1,
    "check_in": "2025-08-16",
    "check_out": null,
    "daily_rate": 150.0,
    "total_bill": 300.0,
    "is_active": true
  }
]
```
**Errors**: `DATABASE_ERROR`

#### `get_all_guests`
**Purpose**: Get all guests (active and checked out)
**Parameters**: None
**Returns**: Array of Guest objects
**Errors**: `DATABASE_ERROR`

#### `get_guest`
**Purpose**: Get specific guest details with current bill
**Parameters**: 
```json
{
  "guestId": "number"
}
```
**Returns**: Guest object
**Errors**: `GUEST_NOT_FOUND`

#### `checkout_guest`
**Purpose**: Check out guest and calculate final bill
**Parameters**: 
```json
{
  "guestId": "number",
  "checkOutDate": "string"  // YYYY-MM-DD format
}
```
**Returns**: `number` (Final bill amount)
**Errors**: `GUEST_NOT_FOUND`, `GUEST_NOT_ACTIVE`, `INVALID_DATE_FORMAT`

---

### Menu Management

#### `get_menu_items`
**Purpose**: Get all menu items
**Parameters**: None
**Returns**: Array of MenuItem objects
```json
[
  {
    "id": 1,
    "name": "Chicken Burger",
    "price": 12.99,
    "category": "Main Course",
    "is_available": true
  }
]
```
**Errors**: `DATABASE_ERROR`

#### `add_menu_item`
**Purpose**: Add new menu item
**Parameters**: 
```json
{
  "name": "string",
  "price": "number",
  "category": "string",
  "is_available": "boolean?"  // Optional, defaults to true
}
```
**Returns**: `number` (Menu item ID)
**Errors**: `NEGATIVE_AMOUNT`, `EMPTY_FIELD`

#### `update_menu_item`
**Purpose**: Update menu item details
**Parameters**: 
```json
{
  "itemId": "number",
  "name": "string?",         // Optional
  "price": "number?",        // Optional
  "category": "string?",     // Optional
  "is_available": "boolean?" // Optional
}
```
**Returns**: `boolean` (Success status)
**Errors**: `MENU_ITEM_NOT_FOUND`, `NEGATIVE_AMOUNT`

#### `delete_menu_item`
**Purpose**: Delete a menu item
**Parameters**: 
```json
{
  "itemId": "number"
}
```
**Returns**: `boolean` (Success status)
**Errors**: `MENU_ITEM_NOT_FOUND`

---

### Food Orders

#### `add_food_order`
**Purpose**: Create new food order for a guest
**Parameters**: 
```json
{
  "order": {
    "guest_id": "number",
    "items": [
      {
        "menu_item_id": "number",
        "quantity": "number",
        "unit_price": "number"
      }
    ]
  }
}
```
**Returns**: `number` (Food order ID)
**Errors**: `GUEST_NOT_FOUND`, `GUEST_NOT_ACTIVE`, `MENU_ITEM_NOT_FOUND`, `NEGATIVE_AMOUNT`

#### `get_food_orders`
**Purpose**: Get all food orders
**Parameters**: None
**Returns**: Array of FoodOrder objects
```json
[
  {
    "id": 1,
    "guest_id": 1,
    "order_date": "2025-08-16",
    "total_amount": 25.98,
    "is_paid": false,
    "items": [
      {
        "menu_item_id": 1,
        "quantity": 2,
        "unit_price": 12.99
      }
    ]
  }
]
```
**Errors**: `DATABASE_ERROR`

#### `get_guest_orders`
**Purpose**: Get food orders for specific guest
**Parameters**: 
```json
{
  "guestId": "number"
}
```
**Returns**: Array of FoodOrder objects
**Errors**: `GUEST_NOT_FOUND`

#### `mark_order_paid`
**Purpose**: Mark food order as paid/unpaid
**Parameters**: 
```json
{
  "orderId": "number"
}
```
**Returns**: `boolean` (Success status)
**Errors**: `ORDER_NOT_FOUND`

---

### Expense Management

#### `add_expense`
**Purpose**: Record a business expense
**Parameters**: 
```json
{
  "date": "string",        // YYYY-MM-DD format
  "category": "string",
  "description": "string",
  "amount": "number"
}
```
**Returns**: `number` (Expense ID)
**Errors**: `INVALID_DATE_FORMAT`, `NEGATIVE_AMOUNT`, `EMPTY_FIELD`

#### `get_expenses`
**Purpose**: Get all expense records
**Parameters**: None
**Returns**: Array of ExpenseRecord objects
```json
[
  {
    "id": 1,
    "date": "2025-08-16",
    "category": "Utilities",
    "description": "Electricity bill",
    "amount": 250.0
  }
]
```
**Errors**: `DATABASE_ERROR`

#### `get_expenses_by_date_range`
**Purpose**: Get expenses within date range
**Parameters**: 
```json
{
  "startDate": "string",   // YYYY-MM-DD format
  "endDate": "string"      // YYYY-MM-DD format
}
```
**Returns**: Array of ExpenseRecord objects
**Errors**: `INVALID_DATE_FORMAT`

#### `update_expense`
**Purpose**: Update expense record
**Parameters**: 
```json
{
  "expenseId": "number",
  "date": "string?",       // Optional
  "category": "string?",   // Optional
  "description": "string?", // Optional
  "amount": "number?"      // Optional
}
```
**Returns**: `boolean` (Success status)
**Errors**: `EXPENSE_NOT_FOUND`, `INVALID_DATE_FORMAT`, `NEGATIVE_AMOUNT`

#### `delete_expense`
**Purpose**: Delete expense record
**Parameters**: 
```json
{
  "expenseId": "number"
}
```
**Returns**: `boolean` (Success status)
**Errors**: `EXPENSE_NOT_FOUND`

---

### Dashboard & Analytics

#### `dashboard_stats`
**Purpose**: Get comprehensive dashboard statistics
**Parameters**: None
**Returns**: DashboardStats object
```json
{
  "total_guests_this_month": 15,
  "total_income": 4500.0,
  "total_expenses": 1200.0,
  "profit_loss": 3300.0,
  "total_food_orders": 45,
  "active_guests": 8,
  "available_rooms": 12,
  "occupied_rooms": 8,
  "occupancy_rate": 66.7
}
```
**Errors**: `DATABASE_ERROR`

---

### Authentication

#### `login_admin`
**Purpose**: Authenticate admin user
**Parameters**: 
```json
{
  "username": "string",
  "password": "string"
}
```
**Returns**: AdminUser object
```json
{
  "id": 1,
  "username": "admin",
  "created_at": "2025-08-16T10:30:00Z"
}
```
**Errors**: `INVALID_CREDENTIALS`

#### `validate_admin_session`
**Purpose**: Check if session token is valid
**Parameters**: 
```json
{
  "sessionToken": "string"
}
```
**Returns**: `boolean` (Valid status)
**Errors**: `SESSION_EXPIRED`, `UNAUTHORIZED`

#### `logout_admin`
**Purpose**: Invalidate session token
**Parameters**: 
```json
{
  "sessionToken": "string"
}
```
**Returns**: `boolean` (Success status)
**Errors**: `SESSION_EXPIRED`

---

### Export & Print

#### `export_history_csv`
**Purpose**: Export data to CSV file
**Parameters**: 
```json
{
  "tab": "string",         // "guests", "orders", "expenses", "rooms"
  "filters": {
    "start_date": "string?",  // Optional, YYYY-MM-DD
    "end_date": "string?",    // Optional, YYYY-MM-DD
    "guest_id": "number?",    // Optional
    "room_id": "number?",     // Optional
    "category": "string?"     // Optional
  }
}
```
**Returns**: `string` (File path to generated CSV)
**Errors**: `INVALID_DATE_FORMAT`, `DATABASE_ERROR`
**Example**: `C:\Users\DELL\AppData\Local\hotel-app\exports\guests_20250816-143052.csv`

#### `build_order_receipt_html`
**Purpose**: Generate HTML receipt for food order
**Parameters**: 
```json
{
  "orderId": "number"
}
```
**Returns**: `string` (HTML content ready for printing)
**Errors**: `ORDER_NOT_FOUND`
**Usage**: 
```ts
const html = await invoke("build_order_receipt_html", { orderId: 123 });
const newWindow = window.open('', '_blank');
newWindow.document.write(html);
newWindow.print();
```

#### `build_final_invoice_html`
**Purpose**: Generate HTML invoice for guest checkout
**Parameters**: 
```json
{
  "guestId": "number"
}
```
**Returns**: `string` (HTML content ready for printing)
**Errors**: `GUEST_NOT_FOUND`
**Usage**: Same as receipt above

---

### Database Management

#### `create_database_backup`
**Purpose**: Create backup of current database
**Parameters**: None
**Returns**: `string` (Backup file path)
**Errors**: `DATABASE_ERROR`

#### `reset_database`
**Purpose**: Reset database with fresh seed data
**Parameters**: None
**Returns**: `boolean` (Success status)
**Errors**: `DATABASE_ERROR`

#### `get_database_path`
**Purpose**: Get current database file location
**Parameters**: None
**Returns**: `string` (Database file path)
**Errors**: None

---

## ❌ Error Codes

All backend errors return standardized string codes:

### Room Errors
- `ROOM_NOT_FOUND` - Room ID does not exist
- `ROOM_OCCUPIED` - Cannot modify/delete occupied room
- `ROOM_NUMBER_EXISTS` - Room number already taken

### Guest Errors
- `GUEST_NOT_FOUND` - Guest ID does not exist
- `GUEST_NOT_ACTIVE` - Guest is already checked out
- `GUEST_ALREADY_CHECKED_OUT` - Cannot checkout twice

### Menu Errors
- `MENU_ITEM_NOT_FOUND` - Menu item ID does not exist
- `MENU_ITEM_UNAVAILABLE` - Item is marked as unavailable

### Order Errors
- `ORDER_NOT_FOUND` - Food order ID does not exist
- `ORDER_ALREADY_PAID` - Cannot modify paid order

### Validation Errors
- `INVALID_DATE_FORMAT` - Date must be YYYY-MM-DD format
- `NEGATIVE_AMOUNT` - Amounts must be positive numbers
- `EMPTY_FIELD` - Required field is empty

### Authentication Errors
- `INVALID_CREDENTIALS` - Wrong username/password
- `SESSION_EXPIRED` - Session token is no longer valid
- `UNAUTHORIZED` - Missing or invalid authentication

### Database Errors
- `DATABASE_ERROR` - General database operation failed
- `CONSTRAINT_VIOLATION` - Database constraint failed

---

## 📁 File System Paths

All file operations use these standard locations:

- **Database**: `%APPDATA%\hotel-app\hotel.db`
- **Exports**: `%APPDATA%\hotel-app\exports\`
- **Backups**: `%APPDATA%\hotel-app\backups\`

Example full paths:
- `C:\Users\DELL\AppData\Local\hotel-app\hotel.db`
- `C:\Users\DELL\AppData\Local\hotel-app\exports\guests_20250816-143052.csv`
- `C:\Users\DELL\AppData\Local\hotel-app\backups\hotel_backup_20250816-143052.db`

---

## 🔒 Contract Guarantee

This IPC contract is **FROZEN** and will not change during frontend development. All commands, parameters, return types, and error codes are stable and guaranteed.

**Version**: 1.0  
**Last Updated**: August 16, 2025  
**Status**: Production Ready ✅
