import { invoke } from "@tauri-apps/api/core";

// Extend Window interface for Tauri
declare global {
  interface Window {
    __TAURI_INTERNALS__?: any;
  }
}

// Check if we're running in Tauri environment
const isTauri = typeof window !== 'undefined' && window.__TAURI_INTERNALS__;

if (!isTauri) {
  console.warn('Tauri APIs not available - running in web mode');
}
// ============================================================================
// TYPE DEFINITIONS - IPC Contract
// ============================================================================

/**
 * Print a receipt for a food order
 * @param orderId - ID of the order to print receipt for
 * @returns Success message
 */
export const printOrderReceipt = (orderId: number): Promise<string> => 
  invoke("print_order_receipt", { orderId });

// ============================================================================

// Room Management
export interface Room {
  id: number;
  number: string;
  room_type: string;
  daily_rate: number;
  is_occupied: boolean;
  guest_id?: number;
  guest_name?: string;
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
  room_id?: number;  // Changed to optional to support walk-in customers
  check_in: string;
  check_out?: string;
  daily_rate: number;
  status: string; // 'active' or 'checked_out'
  created_at: string;
  updated_at: string;
}

export interface ActiveGuestRow {
  guest_id: number;
  name: string;
  room_number?: string;  // Optional for walk-in customers
  check_in: string;
  check_out?: string;
  daily_rate: number;
  is_walkin: boolean;  // New field to identify walk-in customers
}

export interface NewGuest {
  name: string;
  phone?: string;
  room_id?: number;  // Optional for walk-in customers
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
  item_name: string;
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

export interface FoodOrderSummary {
  id: number;
  created_at: string;
  paid: boolean;
  paid_at?: string;
  total_amount: number;
  items: string; // comma-separated list like "Pizza x2, Burger x1"
  guest_id?: number;
  guest_name?: string;
}

export interface FoodOrderInfo {
  id: number;
  guest_id?: number;
  customer_type: string;
  customer_name?: string;
  created_at: string;
  paid: boolean;
  paid_at?: string;
  total_amount: number;
}

export interface OrderItemDetail {
  id: number;
  menu_item_id?: number;
  item_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface FoodOrderDetails {
  order: FoodOrderInfo;
  items: OrderItemDetail[];
}

export interface NewFoodOrder {
  guest_id: number | null;  // Allow null for walk-in customers
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
  date_from?: string;
  date_to?: string;
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
export const addRoom = async (room: NewRoom): Promise<number> => {
  const params = { 
    number: room.number, 
    roomType: room.room_type,  // Use camelCase to match expected parameter
    dailyRate: room.daily_rate  // Use camelCase to match expected parameter
  };
  
  try {
    const result = await invoke("add_room", params);
    return result as number;
  } catch (error) {
    throw error;
  }
};

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
 * Get available rooms for guest assignment/editing
 * @param guestId - Optional guest ID to include their current room
 * @returns Array of available rooms
 * @example
 * ```ts
 * const availableRooms = await getAvailableRoomsForGuest(123);
 * console.log(`Found ${availableRooms.length} available rooms`);
 * ```
 */
export const getAvailableRoomsForGuest = (guestId?: number): Promise<Room[]> => 
  invoke("get_available_rooms_for_guest", { guestId: guestId || null });

/**
 * Update room details
 * @param roomId - ID of the room to update
 * @param updates - Fields to update
 * @returns Success status
 */
export const updateRoom = (roomId: number, updates: Partial<NewRoom>): Promise<boolean> => 
  invoke("update_room", { room_id: roomId, number: updates.number, daily_rate: updates.daily_rate });

/**
 * Delete a room from the system
 * @param roomId - ID of the room to delete
 * @returns Success status
 */
export const deleteRoom = async (roomId: number): Promise<boolean> => {
  try {
    const result = await invoke("delete_room", { id: roomId });
    return result as boolean;
  } catch (error) {
    throw error;
  }
};

/**
 * Clean up any soft-deleted rooms that might be blocking room number reuse
 * @returns Number of rooms cleaned up
 */
export const cleanupSoftDeletedRooms = async (): Promise<string> => {
  try {
    const result = await invoke("cleanup_soft_deleted_rooms");
    return result as string;
  } catch (error) {
    throw error;
  }
};

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
export const addGuest = async (guest: NewGuest): Promise<number> => {
  const params = { 
    name: guest.name,
    phone: guest.phone,
    roomId: guest.room_id || null,  // Use camelCase to match expected parameter
    checkIn: guest.check_in,        // Use camelCase to match expected parameter
    checkOut: guest.check_out,      // Use camelCase to match expected parameter
    dailyRate: guest.daily_rate     // Use camelCase to match expected parameter
  };
  
  try {
    const result = await invoke("add_guest", params);
    return result as number;
  } catch (error) {
    throw error;
  }
};

/**
 * Get all currently active guests
 * @returns Array of active guests with their details
 */
export const getActiveGuests = (): Promise<ActiveGuestRow[]> => 
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
  invoke("update_guest", { 
    guest_id: guestId,
    name: updates.name,
    phone: updates.phone,
    room_id: updates.room_id,
    check_in: updates.check_in,
    check_out: updates.check_out === undefined ? null : updates.check_out,
    daily_rate: updates.daily_rate
  });

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
export const updateMenuItem = async (itemId: number, updates: Partial<NewMenuItem>): Promise<boolean> => {
  const params = { 
    itemId: itemId,  // Try camelCase since error mentions 'itemId'
    name: updates.name,
    price: updates.price,
    category: updates.category,
    is_available: updates.is_available  // Use snake_case to match backend
  };
  
  try {
    const result = await invoke("update_menu_item", params);
    return result as boolean;
  } catch (error) {
    throw error;
  }
};

/**
 * Delete a menu item
 * @param itemId - ID of the menu item to delete
 * @returns Success status
 */
export const deleteMenuItem = async (itemId: number): Promise<boolean> => {
  try {
    const result = await invoke("delete_menu_item", { itemId: itemId });
    return result as boolean;
  } catch (error) {
    throw error;
  }
};

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
 *     { menu_item_id: 1, item_name: "Chicken Burger", quantity: 2, unit_price: 12.99 },
 *     { menu_item_id: 5, item_name: "French Fries", quantity: 1, unit_price: 8.50 }
 *   ]
 * });
 * ```
 */
export const addFoodOrder = async (order: NewFoodOrder): Promise<number> => {
  const params = { 
    guestId: order.guest_id,
    customerType: order.guest_id ? 'active' : 'walkin',
    customerName: order.guest_id ? undefined : 'Walk-in Customer',
    items: order.items
  };
  
  try {
    const result = await invoke("add_food_order", params);
    return result as number;
  } catch (error) {
    throw error;
  }
};

/**
 * Get all food orders
 * @returns Array of all food orders with summary details
 */
export const getFoodOrders = (): Promise<FoodOrderSummary[]> => 
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
export const getFoodOrdersByGuest = (guestId: number): Promise<FoodOrderSummary[]> => 
  invoke("get_food_orders_by_guest", { guestId });

/**
 * Mark a food order as paid
 * @param orderId - ID of the order to mark as paid
 * @returns Success status
 */
export const markOrderPaid = (orderId: number): Promise<string> => 
  invoke("mark_order_paid", { orderId });

/**
 * Toggle payment status of a food order (paid/unpaid)
 * @param orderId - ID of the order to toggle payment status
 * @returns Success message
 */
export const toggleFoodOrderPayment = (orderId: number): Promise<string> => 
  invoke("toggle_food_order_payment", { orderId });

/**
 * Delete a food order and all its items
 * @param orderId - ID of the order to delete
 * @returns Success message
 */
export const deleteFoodOrder = (orderId: number): Promise<string> => 
  invoke("delete_food_order", { orderId });

/**
 * Get detailed information about a food order including all items
 * @param orderId - ID of the order to get details for
 * @returns Order details with items
 */
export const getOrderDetails = (orderId: number): Promise<FoodOrderDetails> => 
  invoke("get_order_details", { orderId });

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
 * Export history data to CSV with file dialog (user chooses location)
 * @param tab - Data type to export ("guests", "orders", "expenses", "rooms")
 * @param filters - Optional filters for the export
 * @returns File path of the generated CSV
 * @example
 * ```ts
 * const filePath = await exportHistoryCsvWithDialog("guests", {
 *   start_date: "2025-01-01",
 *   end_date: "2025-08-16"
 * });
 * console.log(`CSV exported to: ${filePath}`);
 * ```
 */
export const exportHistoryCsvWithDialog = (tab: string, filters: ExportFilters = {}): Promise<string> => 
  invoke("export_history_csv_with_dialog", { tab, filters });

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

/**
 * Generate HTML for final invoice with discount information
 * @param guestId - ID of the guest
 * @param discountType - Type of discount ('flat' or 'percentage')
 * @param discountAmount - Amount or percentage of discount
 * @param discountDescription - Description/reason for discount
 * @returns HTML string ready for printing with discount included
 * @example
 * ```ts
 * const html = await buildFinalInvoiceHtmlWithDiscount(123, "percentage", 10, "Senior discount");
 * const newWindow = window.open('', '_blank');
 * newWindow?.document.write(html);
 * newWindow?.print();
 * ```
 */
export const buildFinalInvoiceHtmlWithDiscount = (
  guestId: number, 
  discountType: string, 
  discountAmount: number, 
  discountDescription: string
): Promise<string> => 
  invoke("build_final_invoice_html_with_discount", { 
    guestId, 
    discountType, 
    discountAmount, 
    discountDescription 
  });

/**
 * Check out a guest with optional discount and calculate final bill
 * @param guestId - ID of the guest to check out  
 * @param checkOutDate - Date of checkout (YYYY-MM-DD format)
 * @param discountType - Type of discount ('flat' or 'percentage')
 * @param discountAmount - Amount or percentage of discount
 * @param discountDescription - Description/reason for discount
 * @returns Final bill amount after discount
 * @example
 * ```typescript
 * const finalBill = await checkoutGuestWithDiscount(123, "2025-08-20", "percentage", 10, "Senior citizen discount");
 * console.log(`Final bill: ${finalBill.toFixed(2)}`);
 * ```
 */
export const checkoutGuestWithDiscount = (
  guestId: number, 
  checkOutDate: string,
  discountType: 'flat' | 'percentage' = 'flat',
  discountAmount: number = 0,
  discountDescription: string = ''
): Promise<number> => 
  invoke("checkout_guest_with_discount", { 
    guestId, 
    checkOutDate, 
    discountType, 
    discountAmount, 
    discountDescription 
  });

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
    { menu_item_id: 1, item_name: "Chicken Burger", quantity: 2, unit_price: 12.99 },
    { menu_item_id: 2, item_name: "French Fries", quantity: 1, unit_price: 8.50 }
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

// ============================================================================
// TAX SETTINGS
// ============================================================================

/**
 * Set the tax rate for invoices
 * @param rate - Tax rate percentage (0-100)
 * @returns Success message
 */
export const setTaxRate = (rate: number): Promise<string> => 
  invoke("set_tax_rate", { rate });

/**
 * Get the current tax rate
 * @returns Tax rate percentage
 */
export const getTaxRate = (): Promise<number> => 
  invoke("get_tax_rate");

/**
 * Set whether tax is enabled for invoices
 * @param enabled - Whether tax should be applied
 * @returns Success message
 */
export const setTaxEnabled = (enabled: boolean): Promise<string> => 
  invoke("set_tax_enabled", { enabled });

/**
 * Get whether tax is currently enabled
 * @returns Whether tax is enabled
 */
export const getTaxEnabled = (): Promise<boolean> => 
  invoke("get_tax_enabled");
