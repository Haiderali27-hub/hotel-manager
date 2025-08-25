import { invoke } from "@tauri-apps/api/core";

// Extend Window interface for Tauri
declare global {
  interface Window {
    __TAURI__?: any;
  }
}

// Check if Tauri is available
const isTauri = typeof window !== 'undefined' && window.__TAURI__;

if (!isTauri) {
  console.warn('Tauri APIs not available - running in web mode');
}

// ============================================================================
// TYPE DEFINITIONS - IPC Contract Types
// ============================================================================

// Room Management
export interface Room {
  id: number;
  number: string;
  room_type: string;
  daily_rate: number;
  is_occupied: boolean;
  guest_id?: number;
}

export interface NewRoom {
  number: string;
  room_type: string;
  daily_rate: number;
}

// Guest Management
export interface Guest {
  id: number;
  name: string;
  phone?: string;
  room_id: number;
  check_in: string;
  check_out?: string;
  daily_rate: number;
  total_bill: number;
  is_active: boolean;
}

export interface NewGuest {
  name: string;
  phone?: string;
  room_id: number;
  check_in: string;
  check_out?: string;
  daily_rate: number;
}

// Menu & Food Orders
export interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  is_available: boolean;
}

export interface NewMenuItem {
  name: string;
  price: number;
  category: string;
  is_available?: boolean;
}

export interface OrderItem {
  menu_item_id: number;
  quantity: number;
  unit_price: number;
}

export interface FoodOrder {
  id: number;
  guest_id: number;
  order_date: string;
  total_amount: number;
  is_paid: boolean;
  items: OrderItem[];
}

export interface NewFoodOrder {
  guest_id: number;
  items: OrderItem[];
}

// Guest with orders for display purposes
export interface GuestWithOrders extends Guest {
  food_orders?: FoodOrder[];
  room_number?: number;
  check_in_date?: string;
  check_out_date?: string;
}

// Expenses
export interface ExpenseRecord {
  id: number;
  date: string;
  category: string;
  description: string;
  amount: number;
}

export interface NewExpense {
  date: string;
  category: string;
  description: string;
  amount: number;
}

// Dashboard & Analytics
export interface DashboardStats {
  total_guests_this_month: number;
  total_income: number;
  total_expenses: number;
  profit_loss: number;
  total_food_orders: number;
  active_guests: number;
  available_rooms: number;
  occupied_rooms: number;
  occupancy_rate: number;
}

// Authentication
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AdminUser {
  id: number;
  username: string;
  created_at: string;
}

// Export & Print
export interface ExportFilters {
  start_date?: string;
  end_date?: string;
  guest_id?: number;
  room_id?: number;
  category?: string;
}

// Database Statistics
export interface DatabaseStats {
  total_rooms: number;
  occupied_rooms: number;
  available_rooms: number;
  active_guests: number;
  total_guests: number;
  menu_items: number;
  food_orders: number;
  unpaid_orders: number;
  expenses: number;
}

// ============================================================================
// API CLIENT FUNCTIONS - Typed IPC Wrappers
// ============================================================================

// Room Management APIs
/**
 * Add a new room to the hotel
 * @param room - Room details with number and daily rate
 * @returns Room ID of the created room
 * @example
 * ```ts
 * const roomId = await addRoom({ number: "101", daily_rate: 150.0 });
 * ```
 */
export const addRoom = (room: NewRoom): Promise<number> => 
  invoke("add_room", { 
    number: room.number, 
    roomType: room.room_type, 
    dailyRate: room.daily_rate 
  });

/**
 * Get all rooms in the hotel
 * @returns Array of all rooms with their current status
 * @example
 * ```ts
 * const rooms = await getRooms();
 * console.log(`Found ${rooms.length} rooms`);
 * ```
 */
export const getRooms = (): Promise<Room[]> => 
  invoke("get_rooms");

/**
 * Update room details
 * @param roomId - ID of the room to update
 * @param updates - Fields to update
 * @returns Success status
 */
export const updateRoom = (roomId: number, updates: Partial<NewRoom>): Promise<boolean> => 
  invoke("update_room", { roomId, ...updates });

/**
 * Delete a room (only if not occupied)
 * @param roomId - ID of the room to delete
 * @returns Success status
 */
export const deleteRoom = (roomId: number): Promise<boolean> => 
  invoke("delete_room", { id: roomId });

// Guest Management APIs
/**
 * Add a new guest and check them into a room
 * @param guest - Guest details including room assignment
 * @returns Guest ID of the created guest
 * @example
 * ```ts
 * const guestId = await addGuest({
 *   name: "John Doe",
 *   phone: "555-0123",
 *   room_id: 1,
 *   check_in: "2025-08-16",
 *   daily_rate: 150.0
 * });
 * ```
 */
export const addGuest = (guest: NewGuest): Promise<number> => 
  invoke("add_guest", { ...guest });

/**
 * Get all currently active guests
 * @returns Array of active guests with their details
 */
export const getActiveGuests = (): Promise<Guest[]> => 
  invoke("get_active_guests");

/**
 * Get all guests (active and checked out)
 * @returns Array of all guests
 */
export const getAllGuests = (): Promise<Guest[]> => 
  invoke("get_all_guests");

/**
 * Get a specific guest by ID
 * @param guestId - ID of the guest
 * @returns Guest details with current bill
 */
export const getGuest = (guestId: number): Promise<Guest> => 
  invoke("get_guest", { guestId });

/**
 * Check out a guest and calculate final bill
 * @param guestId - ID of the guest to check out
 * @param checkOutDate - Date of checkout (YYYY-MM-DD format)
 * @returns Final bill amount
 * @example
 * ```ts
 * const finalBill = await checkoutGuest(123, "2025-08-20");
 * console.log(`Final bill: $${finalBill.toFixed(2)}`);
 * ```
 */
export const checkoutGuest = (guestId: number, checkOutDate: string): Promise<number> => 
  invoke("checkout_guest", { guestId, checkOutDate });

/**
 * Update guest information
 * @param guestId - ID of the guest to update
 * @param updates - Fields to update
 * @returns Success status
 */
export const updateGuest = (guestId: number, updates: Partial<NewGuest>): Promise<boolean> => 
  invoke("update_guest", { guestId, ...updates });

// Menu Management APIs
/**
 * Get all menu items
 * @returns Array of all menu items
 */
export const getMenuItems = (): Promise<MenuItem[]> => 
  invoke("get_menu_items");

/**
 * Add a new menu item
 * @param item - Menu item details
 * @returns Menu item ID
 * @example
 * ```ts
 * const itemId = await addMenuItem({
 *   name: "Chicken Burger",
 *   price: 12.99,
 *   category: "Main Course"
 * });
 * ```
 */
export const addMenuItem = (item: NewMenuItem): Promise<number> => 
  invoke("add_menu_item", { 
    name: item.name, 
    price: item.price, 
    category: item.category, 
    isAvailable: item.is_available 
  });

/**
 * Update menu item details
 * @param itemId - ID of the menu item
 * @param updates - Fields to update
 * @returns Success status
 */
export const updateMenuItem = (itemId: number, updates: Partial<NewMenuItem>): Promise<boolean> => 
  invoke("update_menu_item", { 
    itemId: itemId,
    name: updates.name,
    price: updates.price,
    category: updates.category,
    isAvailable: updates.is_available
  });

/**
 * Delete a menu item
 * @param itemId - ID of the menu item to delete
 * @returns Success status
 */
export const deleteMenuItem = (itemId: number): Promise<boolean> => 
  invoke("delete_menu_item", { itemId: itemId });

// Food Order APIs
/**
 * Create a new food order for a guest
 * @param order - Order details with items and quantities
 * @returns Food order ID
 * @example
 * ```ts
 * const orderId = await addFoodOrder({
 *   guest_id: 123,
 *   items: [
 *     { menu_item_id: 1, quantity: 2, unit_price: 12.99 },
 *     { menu_item_id: 5, quantity: 1, unit_price: 8.50 }
 *   ]
 * });
 * ```
 */
export const addFoodOrder = (order: NewFoodOrder): Promise<number> => 
  invoke("add_food_order", { order });

/**
 * Get all food orders
 * @returns Array of all food orders with details
 */
export const getFoodOrders = (): Promise<FoodOrder[]> => 
  invoke("get_food_orders");

/**
 * Get food orders for a specific guest
 * @param guestId - ID of the guest
 * @returns Array of orders for that guest
 */
export const getGuestOrders = (guestId: number): Promise<FoodOrder[]> => 
  invoke("get_food_orders_by_guest", { guestId });

/**
 * Alias for getGuestOrders - same functionality
 * @param guestId - ID of the guest
 * @returns Array of orders for that guest
 */
export const getFoodOrdersByGuest = (guestId: number): Promise<FoodOrder[]> => 
  getGuestOrders(guestId);

/**
 * Mark a food order as paid
 * @param orderId - ID of the order to mark as paid
 * @returns Success status
 */
export const markOrderPaid = (orderId: number): Promise<boolean> => 
  invoke("mark_order_paid", { orderId });

// Expense Management APIs
/**
 * Add a new business expense
 * @param expense - Expense details
 * @returns Expense ID
 * @example
 * ```ts
 * const expenseId = await addExpense({
 *   date: "2025-08-16",
 *   category: "Utilities",
 *   description: "Electricity bill",
 *   amount: 250.00
 * });
 * ```
 */
export const addExpense = (expense: NewExpense): Promise<number> => 
  invoke("add_expense", { ...expense });

/**
 * Get all expenses
 * @returns Array of all expense records
 */
export const getExpenses = (): Promise<ExpenseRecord[]> => 
  invoke("get_expenses");

/**
 * Get expenses within a date range
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @returns Array of expenses in date range
 */
export const getExpensesByDateRange = (startDate: string, endDate: string): Promise<ExpenseRecord[]> => 
  invoke("get_expenses_by_date_range", { startDate, endDate });

/**
 * Update an expense record
 * @param expenseId - ID of the expense to update
 * @param updates - Fields to update
 * @returns Success status
 */
export const updateExpense = (expenseId: number, updates: Partial<NewExpense>): Promise<boolean> => 
  invoke("update_expense", { expenseId, ...updates });

/**
 * Delete an expense record
 * @param expenseId - ID of the expense to delete
 * @returns Success status
 */
export const deleteExpense = (expenseId: number): Promise<boolean> => 
  invoke("delete_expense", { expenseId });

// Dashboard & Analytics APIs
/**
 * Get dashboard statistics and metrics
 * @returns Complete dashboard stats including revenue, occupancy, etc.
 * @example
 * ```ts
 * const stats = await getDashboardStats();
 * console.log(`Occupancy rate: ${stats.occupancy_rate.toFixed(1)}%`);
 * console.log(`Monthly profit: $${stats.profit_loss.toFixed(2)}`);
 * ```
 */
export const getDashboardStats = (): Promise<DashboardStats> => 
  invoke("dashboard_stats");

// Authentication APIs
/**
 * Admin login
 * @param credentials - Username and password
 * @returns Admin user details if successful
 * @example
 * ```ts
 * try {
 *   const admin = await loginAdmin({ username: "admin", password: "password123" });
 *   console.log(`Logged in as: ${admin.username}`);
 * } catch (error) {
 *   console.error("Login failed:", error);
 * }
 * ```
 */
export const loginAdmin = (credentials: LoginCredentials): Promise<AdminUser> => 
  invoke("login_admin", { ...credentials });

/**
 * Validate current admin session
 * @param sessionToken - Session token to validate
 * @returns True if session is valid
 */
export const validateAdminSession = (sessionToken: string): Promise<boolean> => 
  invoke("validate_admin_session", { sessionToken });

/**
 * Admin logout
 * @param sessionToken - Session token to invalidate
 * @returns Success status
 */
export const logoutAdmin = (sessionToken: string): Promise<boolean> => 
  invoke("logout_admin", { sessionToken });

/**
 * Get security question for password reset
 * @returns Security question text
 */
export const getSecurityQuestion = (): Promise<string> => 
  invoke("get_security_question");

/**
 * Reset admin password using security question
 * @param answer - Answer to security question
 * @param newPassword - New password to set
 * @returns Success status
 */
export const resetAdminPassword = (answer: string, newPassword: string): Promise<boolean> => 
  invoke("reset_admin_password", { answer, newPassword });

// Export & Print APIs
/**
 * Export data to CSV file
 * @param tab - Data type to export ("guests", "orders", "expenses", "rooms")
 * @param filters - Optional filters for the export
 * @returns File path of the generated CSV
 * @example
 * ```ts
 * const filePath = await exportHistoryCsv("guests", {
 *   start_date: "2025-01-01",
 *   end_date: "2025-08-16"
 * });
 * console.log(`CSV exported to: ${filePath}`);
 * ```
 */
export const exportHistoryCsv = (tab: string, filters: ExportFilters = {}): Promise<string> => 
  invoke("export_history_csv", { tab, filters });

/**
 * Generate HTML receipt for a food order
 * @param orderId - ID of the food order
 * @returns HTML string ready for printing
 * @example
 * ```ts
 * const html = await buildOrderReceiptHtml(123);
 * const newWindow = window.open('', '_blank');
 * newWindow?.document.write(html);
 * newWindow?.print();
 * ```
 */
export const buildOrderReceiptHtml = (orderId: number): Promise<string> => 
  invoke("build_order_receipt_html", { orderId });

/**
 * Generate HTML invoice for a guest's final bill
 * @param guestId - ID of the guest
 * @returns HTML string ready for printing
 * @example
 * ```ts
 * const html = await buildFinalInvoiceHtml(123);
 * const newWindow = window.open('', '_blank');
 * newWindow?.document.write(html);
 * newWindow?.print();
 * ```
 */
export const buildFinalInvoiceHtml = (guestId: number): Promise<string> => 
  invoke("build_final_invoice_html", { guestId });

// Database Management APIs
/**
 * Create a database backup
 * @returns File path of the backup
 */
export const createDatabaseBackup = (): Promise<string> => 
  invoke("create_database_backup");

/**
 * Reset database with fresh seed data
 * @returns Success status
 */
export const resetDatabase = (): Promise<boolean> => 
  invoke("reset_database");

/**
 * Get database file path
 * @returns Path to the current database file
 */
export const getDatabasePath = (): Promise<string> => 
  invoke("get_database_path");

/**
 * Get current database statistics
 * @returns Database statistics including record counts
 */
export const getDatabaseStats = (): Promise<DatabaseStats> => 
  invoke("get_database_stats");

// ============================================================================
// MOCK DATA FOR DEVELOPMENT
// ============================================================================

export const mockRoom: NewRoom = {
  number: "101",
  room_type: "Single Room",
  daily_rate: 150.0
};

export const mockGuest: NewGuest = {
  name: "John Doe",
  phone: "555-0123",
  room_id: 1,
  check_in: "2025-08-16",
  daily_rate: 150.0
};

export const mockMenuItem: NewMenuItem = {
  name: "Chicken Burger",
  price: 12.99,
  category: "Main Course",
  is_available: true
};

export const mockFoodOrder: NewFoodOrder = {
  guest_id: 1,
  items: [
    { menu_item_id: 1, quantity: 2, unit_price: 12.99 },
    { menu_item_id: 2, quantity: 1, unit_price: 8.50 }
  ]
};

export const mockExpense: NewExpense = {
  date: "2025-08-16",
  category: "Utilities",
  description: "Electricity bill",
  amount: 250.00
};

// ============================================================================
// ERROR HANDLING UTILITIES
// ============================================================================

/**
 * Standard error codes returned by the backend
 */
export const ErrorCodes = {
  // Room errors
  ROOM_NOT_FOUND: "ROOM_NOT_FOUND",
  ROOM_OCCUPIED: "ROOM_OCCUPIED",
  ROOM_NUMBER_EXISTS: "ROOM_NUMBER_EXISTS",
  
  // Guest errors
  GUEST_NOT_FOUND: "GUEST_NOT_FOUND",
  GUEST_NOT_ACTIVE: "GUEST_NOT_ACTIVE",
  GUEST_ALREADY_CHECKED_OUT: "GUEST_ALREADY_CHECKED_OUT",
  
  // Menu errors
  MENU_ITEM_NOT_FOUND: "MENU_ITEM_NOT_FOUND",
  MENU_ITEM_UNAVAILABLE: "MENU_ITEM_UNAVAILABLE",
  
  // Order errors
  ORDER_NOT_FOUND: "ORDER_NOT_FOUND",
  ORDER_ALREADY_PAID: "ORDER_ALREADY_PAID",
  
  // Validation errors
  INVALID_DATE_FORMAT: "INVALID_DATE_FORMAT",
  NEGATIVE_AMOUNT: "NEGATIVE_AMOUNT",
  EMPTY_FIELD: "EMPTY_FIELD",
  
  // Auth errors
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  UNAUTHORIZED: "UNAUTHORIZED",
  
  // Database errors
  DATABASE_ERROR: "DATABASE_ERROR",
  CONSTRAINT_VIOLATION: "CONSTRAINT_VIOLATION"
} as const;

/**
 * Utility function to handle API errors consistently
 * @param error - Error from invoke call
 * @returns User-friendly error message
 */
export const handleApiError = (error: any): string => {
  if (typeof error === 'string') {
    switch (error) {
      case ErrorCodes.ROOM_NOT_FOUND:
        return "Room not found. Please check the room number.";
      case ErrorCodes.ROOM_OCCUPIED:
        return "Room is currently occupied and cannot be modified.";
      case ErrorCodes.GUEST_NOT_FOUND:
        return "Guest not found. Please check the guest ID.";
      case ErrorCodes.INVALID_DATE_FORMAT:
        return "Invalid date format. Please use YYYY-MM-DD format.";
      case ErrorCodes.NEGATIVE_AMOUNT:
        return "Amount must be positive.";
      case ErrorCodes.INVALID_CREDENTIALS:
        return "Invalid username or password.";
      default:
        return error;
    }
  }
  return "An unexpected error occurred. Please try again.";
};
