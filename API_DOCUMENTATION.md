# Hotel Management System - API Documentation

## 📖 Overview
This document provides complete instructions for connecting the frontend UI to the backend APIs. All APIs are implemented as Tauri commands and can be called from the frontend using the `invoke` function.

## 🔧 Setup
```typescript
import { invoke } from '@tauri-apps/api/core';
```

---

## 🏨 **GUEST MANAGEMENT APIs**

### 📋 Get All Guests
**Function:** `get_all_guests`
**Purpose:** Retrieve all guests from the database

```typescript
// API Call
const guests = await invoke('get_all_guests');

// Response Type
interface Guest {
  id?: number;
  name: string;
  email: string;
  phone: string;
  room_id?: number;
  check_in_date?: string;
  check_out_date?: string;
  total_amount?: number;
  status: string; // "active", "checked_out", "reserved"
}

// Usage Example
try {
  const guestList = await invoke('get_all_guests') as Guest[];
  console.log('All guests:', guestList);
  // Update your UI guest list here
} catch (error) {
  console.error('Error fetching guests:', error);
}
```

### ➕ Add New Guest
**Function:** `add_guest`
**Purpose:** Add a new guest and assign room

```typescript
// API Call
const result = await invoke('add_guest', { guest: guestData });

// Input Data Structure
const newGuest: Guest = {
  name: "Ahmed Khan",
  email: "ahmed@example.com",
  phone: "+92-300-1234567",
  room_id: 5,
  check_in_date: "2025-08-14",
  check_out_date: null, // Optional
  total_amount: 15000.0,
  status: "active"
};

// Usage Example
try {
  const response = await invoke('add_guest', { guest: newGuest });
  console.log('Success:', response); // "Guest added successfully"
  // Refresh guest list in UI
  // Show success message
} catch (error) {
  console.error('Error adding guest:', error);
  // Show error message in UI
}
```

### ✏️ Edit Guest
**Function:** `edit_guest`
**Purpose:** Update existing guest information

```typescript
// API Call
const result = await invoke('edit_guest', { id: guestId, guest: updatedData });

// Usage Example
const updatedGuest: Guest = {
  name: "Ahmed Khan (Updated)",
  email: "ahmed.new@example.com",
  phone: "+92-300-1234567",
  room_id: 3, // Changed room
  check_in_date: "2025-08-14",
  check_out_date: "2025-08-20",
  total_amount: 18000.0,
  status: "active"
};

try {
  const response = await invoke('edit_guest', { 
    id: 1, 
    guest: updatedGuest 
  });
  console.log('Success:', response);
  // Update guest in UI list
} catch (error) {
  console.error('Error updating guest:', error);
}
```

### 🚪 Checkout Guest
**Function:** `checkout_guest`
**Purpose:** Check out a guest and free up their room

```typescript
// API Call
const result = await invoke('checkout_guest', { id: guestId });

// Usage Example
try {
  const response = await invoke('checkout_guest', { id: 1 });
  console.log('Success:', response); // "Guest checked out successfully"
  // Update guest status in UI
  // Update room availability
  // Show checkout confirmation
} catch (error) {
  console.error('Error checking out guest:', error);
}
```

---

## 🏠 **ROOM MANAGEMENT APIs**

### 📋 Get All Rooms
**Function:** `get_all_rooms`
**Purpose:** Retrieve all rooms with availability status

```typescript
// Response Type
interface Room {
  id?: number;
  room_number: string;
  room_type: string; // "single", "double", "suite", "deluxe"
  price: number;
  is_available: boolean;
  description?: string;
}

// Usage Example
try {
  const rooms = await invoke('get_all_rooms') as Room[];
  console.log('All rooms:', rooms);
  
  // Filter available rooms
  const availableRooms = rooms.filter(room => room.is_available);
  
  // Update room grid/list in UI
} catch (error) {
  console.error('Error fetching rooms:', error);
}
```

### ➕ Add New Room
**Function:** `add_room`
**Purpose:** Add a new room to the hotel

```typescript
const newRoom: Room = {
  room_number: "301",
  room_type: "deluxe",
  price: 8000.0,
  is_available: true,
  description: "Deluxe room with city view and premium amenities"
};

try {
  const response = await invoke('add_room', { room: newRoom });
  console.log('Success:', response);
  // Add room to UI grid
  // Show success notification
} catch (error) {
  console.error('Error adding room:', error);
}
```

### ✏️ Edit Room
**Function:** `edit_room`
**Purpose:** Update room information

```typescript
const updatedRoom: Room = {
  room_number: "301A",
  room_type: "suite",
  price: 10000.0,
  is_available: false,
  description: "Upgraded to suite with balcony"
};

try {
  const response = await invoke('edit_room', { 
    id: 5, 
    room: updatedRoom 
  });
  console.log('Success:', response);
  // Update room in UI grid
} catch (error) {
  console.error('Error updating room:', error);
}
```

### 🗑️ Delete Room
**Function:** `delete_room`
**Purpose:** Remove a room from the system

```typescript
try {
  const response = await invoke('delete_room', { id: 5 });
  console.log('Success:', response);
  // Remove room from UI grid
  // Show deletion confirmation
} catch (error) {
  console.error('Error deleting room:', error);
}
```

---

## 🍽️ **MENU MANAGEMENT APIs**

### 📋 Get All Menu Items
**Function:** `get_all_menu_items`
**Purpose:** Retrieve all menu items

```typescript
// Response Type
interface MenuItem {
  id?: number;
  name: string;
  category: string; // "breakfast", "lunch", "dinner", "beverages"
  price: number;
  description?: string;
  is_available: boolean;
}

// Usage Example
try {
  const menuItems = await invoke('get_all_menu_items') as MenuItem[];
  
  // Group by category for UI display
  const breakfast = menuItems.filter(item => item.category === 'breakfast');
  const lunch = menuItems.filter(item => item.category === 'lunch');
  const dinner = menuItems.filter(item => item.category === 'dinner');
  
  // Update menu display in UI
} catch (error) {
  console.error('Error fetching menu items:', error);
}
```

### ➕ Add Menu Item
**Function:** `add_menu_item`
**Purpose:** Add new food item to menu

```typescript
const newMenuItem: MenuItem = {
  name: "Chicken Karahi",
  category: "dinner",
  price: 800.0,
  description: "Traditional spicy chicken curry with fresh tomatoes",
  is_available: true
};

try {
  const response = await invoke('add_menu_item', { item: newMenuItem });
  console.log('Success:', response);
  // Add item to menu UI
} catch (error) {
  console.error('Error adding menu item:', error);
}
```

### ✏️ Edit Menu Item
**Function:** `edit_menu_item`
**Purpose:** Update menu item details

```typescript
const updatedItem: MenuItem = {
  name: "Special Chicken Karahi",
  category: "dinner",
  price: 900.0,
  description: "Premium chicken curry with special spices",
  is_available: true
};

try {
  const response = await invoke('edit_menu_item', { 
    id: 3, 
    item: updatedItem 
  });
  console.log('Success:', response);
  // Update item in menu UI
} catch (error) {
  console.error('Error updating menu item:', error);
}
```

### 🗑️ Delete Menu Item
**Function:** `delete_menu_item`
**Purpose:** Remove item from menu

```typescript
try {
  const response = await invoke('delete_menu_item', { id: 3 });
  console.log('Success:', response);
  // Remove item from menu UI
} catch (error) {
  console.error('Error deleting menu item:', error);
}
```

---

## 🛒 **ORDER MANAGEMENT APIs**

### 📋 Get All Orders
**Function:** `get_all_orders`
**Purpose:** Retrieve all food orders

```typescript
// Response Type
interface Order {
  id?: number;
  guest_id?: number;
  menu_item_id: number;
  quantity: number;
  total_price: number;
  status: string; // "pending", "preparing", "delivered", "cancelled"
  order_date: string;
}

// Usage Example
try {
  const orders = await invoke('get_all_orders') as Order[];
  
  // Filter by status for UI tabs
  const pendingOrders = orders.filter(order => order.status === 'pending');
  const completedOrders = orders.filter(order => order.status === 'delivered');
  
  // Update orders UI
} catch (error) {
  console.error('Error fetching orders:', error);
}
```

### ➕ Add New Order
**Function:** `add_order`
**Purpose:** Create a new food order

```typescript
const newOrder: Order = {
  guest_id: 1,
  menu_item_id: 5,
  quantity: 2,
  total_price: 1600.0,
  status: "pending",
  order_date: "2025-08-14"
};

try {
  const response = await invoke('add_order', { order: newOrder });
  console.log('Success:', response);
  // Add order to UI list
  // Show order confirmation
} catch (error) {
  console.error('Error creating order:', error);
}
```

### 🔄 Update Order Status
**Function:** `update_order_status`
**Purpose:** Update order progress

```typescript
try {
  const response = await invoke('update_order_status', { 
    id: 1, 
    status: "delivered" 
  });
  console.log('Success:', response);
  // Update order status in UI
} catch (error) {
  console.error('Error updating order status:', error);
}
```

---

## 💰 **FINANCIAL MANAGEMENT APIs**

### ➕ Add Revenue
**Function:** `add_revenue`
**Purpose:** Record income

```typescript
// Revenue Type
interface Revenue {
  id?: number;
  source: string; // "room_booking", "food_sale", "other"
  amount: number;
  date: string;
  description?: string;
}

const newRevenue: Revenue = {
  source: "room_booking",
  amount: 15000.0,
  date: "2025-08-14",
  description: "Room 301 - 3 nights"
};

try {
  const response = await invoke('add_revenue', { revenue: newRevenue });
  console.log('Success:', response);
  // Update financial dashboard
} catch (error) {
  console.error('Error adding revenue:', error);
}
```

### ➕ Add Expense
**Function:** `add_expense`
**Purpose:** Record business expenses

```typescript
// Expense Type
interface Expense {
  id?: number;
  category: string; // "utilities", "supplies", "maintenance", "salaries"
  amount: number;
  date: string;
  description?: string;
}

const newExpense: Expense = {
  category: "utilities",
  amount: 5000.0,
  date: "2025-08-14",
  description: "Monthly electricity bill"
};

try {
  const response = await invoke('add_expense', { expense: newExpense });
  console.log('Success:', response);
  // Update expense tracking UI
} catch (error) {
  console.error('Error adding expense:', error);
}
```

### 📊 Get Financial Summary
**Function:** `get_financial_summary`
**Purpose:** Get complete financial overview

```typescript
// Response Type
interface FinancialSummary {
  total_revenue: number;
  total_expenses: number;
  net_profit: number;
  recent_revenues: Revenue[];
  recent_expenses: Expense[];
}

try {
  const summary = await invoke('get_financial_summary') as FinancialSummary;
  
  // Update financial dashboard
  console.log('Total Revenue:', summary.total_revenue);
  console.log('Total Expenses:', summary.total_expenses);
  console.log('Net Profit:', summary.net_profit);
  
  // Display recent transactions
  console.log('Recent Revenues:', summary.recent_revenues);
  console.log('Recent Expenses:', summary.recent_expenses);
  
} catch (error) {
  console.error('Error fetching financial summary:', error);
}
```

---

## 📊 **DASHBOARD ANALYTICS API**

### 📈 Get Dashboard Statistics
**Function:** `get_dashboard_stats`
**Purpose:** Get real-time business metrics

```typescript
// Response Type
interface DashboardStats {
  totalGuests: number;
  activeGuests: number;
  totalIncome: number;
  totalExpenses: number;
  profitLoss: number;
  totalFoodOrders: number;
  currency: string;
}

try {
  const stats = await invoke('get_dashboard_stats') as DashboardStats;
  
  // Update dashboard cards
  console.log('Total Guests:', stats.totalGuests);
  console.log('Active Guests:', stats.activeGuests);
  console.log('Total Income:', stats.totalIncome);
  console.log('Total Expenses:', stats.totalExpenses);
  console.log('Profit/Loss:', stats.profitLoss);
  console.log('Food Orders:', stats.totalFoodOrders);
  
} catch (error) {
  console.error('Error fetching dashboard stats:', error);
}
```

---

## 🎨 **UI IMPLEMENTATION SUGGESTIONS**

### 📱 **Guest Management Screen**
```typescript
// Example React Component Structure
const GuestManagement = () => {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Fetch guests on component mount
  useEffect(() => {
    loadGuests();
  }, []);
  
  const loadGuests = async () => {
    setLoading(true);
    try {
      const guestList = await invoke('get_all_guests');
      setGuests(guestList);
    } catch (error) {
      // Show error toast
    } finally {
      setLoading(false);
    }
  };
  
  const handleAddGuest = async (guestData: Guest) => {
    try {
      await invoke('add_guest', { guest: guestData });
      loadGuests(); // Refresh list
      // Show success toast
    } catch (error) {
      // Show error toast
    }
  };
  
  const handleCheckout = async (guestId: number) => {
    try {
      await invoke('checkout_guest', { id: guestId });
      loadGuests(); // Refresh list
      // Show success notification
    } catch (error) {
      // Show error toast
    }
  };
  
  // Return JSX with guest list, add form, etc.
};
```

### 🏠 **Room Management Screen**
- Grid layout showing room cards
- Color coding: Green (available), Red (occupied), Yellow (maintenance)
- Quick actions: Add room, Edit room, View details
- Filter options: By type, availability, price range

### 🍽️ **Menu Management Screen**
- Tabbed interface by categories (Breakfast, Lunch, Dinner, Beverages)
- Item cards with images, prices, availability toggle
- Quick add/edit forms
- Search and filter functionality

### 🛒 **Order Management Screen**
- Order status pipeline: Pending → Preparing → Ready → Delivered
- Real-time order tracking
- Kitchen display mode
- Order history and analytics

### 💰 **Financial Dashboard**
- Revenue vs Expenses charts
- Monthly/weekly/daily views
- Quick add revenue/expense forms
- Financial reports and export

---

## 🔧 **Error Handling Best Practices**

```typescript
// Centralized error handling
const handleApiCall = async (apiFunction: () => Promise<any>, successMessage?: string) => {
  try {
    setLoading(true);
    const result = await apiFunction();
    if (successMessage) {
      showSuccessToast(successMessage);
    }
    return result;
  } catch (error) {
    console.error('API Error:', error);
    showErrorToast(error.message || 'An error occurred');
    throw error;
  } finally {
    setLoading(false);
  }
};

// Usage
const addGuest = (guestData: Guest) => 
  handleApiCall(
    () => invoke('add_guest', { guest: guestData }),
    'Guest added successfully!'
  );
```

---

## 📁 **Sample Data Available**

The database is pre-seeded with:
- **10 Rooms:** Various types (single, double, suite, deluxe) with Pakistani pricing
- **25 Menu Items:** Authentic Pakistani cuisine across all categories
- **2 Sample Guests:** With realistic Pakistani names and data
- **Financial Records:** Sample revenue and expense entries

---

## 🚀 **Getting Started Checklist**

1. ✅ **Import Tauri invoke function**
2. ✅ **Create TypeScript interfaces** (copy from above)
3. ✅ **Implement error handling wrapper**
4. ✅ **Create loading states** for all API calls
5. ✅ **Add success/error notifications**
6. ✅ **Build responsive UI components**
7. ✅ **Test with sample data**
8. ✅ **Add form validation**

---

## 💡 **Pro Tips**

1. **Always handle loading states** - Users should see feedback during API calls
2. **Implement optimistic updates** - Update UI immediately, rollback on error
3. **Cache data when appropriate** - Reduce unnecessary API calls
4. **Add confirmation dialogs** - For destructive actions (delete, checkout)
5. **Use real-time updates** - Refresh data after mutations
6. **Implement search/filter** - For better user experience with large lists
7. **Add keyboard shortcuts** - For power users
8. **Mobile-first design** - Ensure all screens work on mobile devices

---

This API documentation provides everything needed to build a complete hotel management frontend. All backend APIs are tested and ready to use! 🎉
