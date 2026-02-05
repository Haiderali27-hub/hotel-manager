import { invoke } from "@tauri-apps/api/core";

// Extend Window interface for Tauri
declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

// Check if we're running in Tauri environment
const isTauri = typeof window !== 'undefined' && window.__TAURI_INTERNALS__;

if (!isTauri) {
  console.warn('Tauri APIs not available - running in web mode');
}

async function invokeCompat<T>(
  primary: string,
  primaryArgs: Record<string, unknown> | undefined,
  fallback: string,
  fallbackArgs?: Record<string, unknown>
): Promise<T> {
  try {
    return await invoke<T>(primary, primaryArgs);
  } catch {
    return await invoke<T>(fallback, fallbackArgs ?? primaryArgs);
  }
}

// ============================================================================
// Store Profiles (Multi-store)
// ============================================================================

export interface StoreProfile {
  id: string;
  name: string;
  created_at: string;
}

export interface StoreProfilesStatus {
  active_profile_id: string;
  profiles: StoreProfile[];
}

export const listStoreProfiles = (): Promise<StoreProfilesStatus> =>
  invoke("list_store_profiles");

export const getActiveStoreProfile = (): Promise<StoreProfile> =>
  invoke("get_active_store_profile");

export const createStoreProfile = (name: string): Promise<StoreProfilesStatus> =>
  invoke("create_store_profile", { name });

export const setActiveStoreProfile = (profileId: string): Promise<StoreProfilesStatus> =>
  invoke("set_active_store_profile", { profileId });

export const deleteStoreProfile = (profileId: string): Promise<StoreProfilesStatus> =>
  invoke("delete_store_profile", { profileId });

export const updateActiveStoreName = (name: string): Promise<StoreProfile> =>
  invoke("update_active_store_name", { name });
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

export interface KitchenTicketItem {
  name: string;
  quantity: number;
  notes?: string;
}

export interface KitchenTicket {
  created_at: string;
  items: KitchenTicketItem[];
}

/**
 * Build HTML for a kitchen ticket (KOT) to print from the POS.
 */
export const buildKitchenTicketHtml = (ticket: KitchenTicket): Promise<string> =>
  invoke("build_kitchen_ticket_html", { ticket });

// ============================================================================

// Resource Management (legacy name: Room)
export interface Room {
  id: number;
  number: string;
  room_type: string;
  daily_rate: number;
  is_occupied: boolean;
  guest_id?: number;
  guest_name?: string;
}

// De-hotelified alias
export type Resource = Room;

// UI-facing generic alias (preferred)
export type Unit = Room;

export interface NewRoom {
  number: string;
  room_type: string;
  daily_rate: number;
}

// De-hotelified alias
export type NewResource = NewRoom;

// UI-facing generic alias (preferred)
export type NewUnit = NewRoom;

// Customer Management (legacy name: Guest)
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

export type Customer = Guest;

export interface ActiveGuestRow {
  guest_id: number;
  name: string;
  room_number?: string;  // Optional for walk-in customers
  check_in: string;
  check_out?: string;
  daily_rate: number;
  is_walkin: boolean;  // New field to identify walk-in customers
}

export type ActiveCustomerRow = ActiveGuestRow;

export interface NewGuest {
  name: string;
  phone?: string;
  room_id?: number;  // Optional for walk-in customers
  check_in: string;
  check_out?: string;
  daily_rate: number;
}

export type NewCustomer = NewGuest;

// Menu & Food Orders
export interface MenuItem {
  id: number;
  name: string;
  sku?: string;
  barcode?: string;
  price: number;
  category: string;
  description?: string;
  is_available: boolean;

  // Phase 4 inventory fields (optional for backward compatibility)
  track_stock?: number;      // 0 = service, 1 = physical product
  stock_quantity?: number;   // only meaningful when track_stock = 1
  low_stock_limit?: number;  // default: 5
}

export interface NewMenuItem {
  name: string;
  sku?: string;
  barcode?: string;
  price: number;
  category: string;
  description?: string;
  is_available?: boolean;

  // Phase 4 inventory fields
  track_stock?: number;
  stock_quantity?: number;
  low_stock_limit?: number;
}

export interface ProductCategory {
  id: number;
  name: string;
  color?: string;
  emoji?: string;
  created_at: string;
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

export type SaleSummary = FoodOrderSummary;

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

export type SaleRecord = FoodOrderInfo;

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

export type SaleDetails = FoodOrderDetails;

// ===== PAYMENTS (Partial / Pay-Later) =====

export interface SalePayment {
  id: number;
  sale_id: number;
  amount: number;
  method: string;
  note?: string;
  created_at: string;
}

export interface SalePaymentSummary {
  sale_id: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  paid: boolean;
  paid_at?: string;
  payments: SalePayment[];
}

export interface NewFoodOrder {
  guest_id: number | null;  // Allow null for walk-in customers
  items: OrderItem[];
}

export type NewSale = NewFoodOrder;

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

// ===== SUPPLIERS & PURCHASES (Stock-In) =====

export interface Supplier {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface NewSupplier {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

export interface PurchaseItemInput {
  menu_item_id?: number | null;
  item_name: string;
  quantity: number;
  unit_cost: number;
}

export interface PurchaseItemRow {
  id: number;
  purchase_id: number;
  menu_item_id?: number | null;
  item_name: string;
  quantity: number;
  unit_cost: number;
  line_total: number;
}

export interface PurchaseSummary {
  id: number;
  purchase_date: string;
  supplier_id?: number | null;
  supplier_name?: string | null;
  reference?: string | null;
  notes?: string | null;
  total_amount: number;
  created_at: string;
}

export interface PurchaseDetails {
  purchase: PurchaseSummary;
  items: PurchaseItemRow[];
}

export interface SupplierPayment {
  id: number;
  supplier_id: number;
  purchase_id?: number | null;
  amount: number;
  method: string;
  note?: string | null;
  created_at: string;
}

export interface SupplierBalanceSummary {
  supplier_id: number;
  supplier_name: string;
  total_purchases: number;
  amount_paid: number;
  balance_due: number;
}

export interface CustomerBalanceSummary {
  customer_id: number;
  customer_name: string;
  total_sales: number;
  amount_paid: number;
  balance_due: number;
}

export interface CustomerSaleBalanceRow {
  sale_id: number;
  created_at: string;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  paid: boolean;
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
  const primaryParams = {
    number: room.number,
    resourceType: room.room_type,
    dailyRate: room.daily_rate,
  };

  const fallbackParams = {
    number: room.number,
    roomType: room.room_type,
    dailyRate: room.daily_rate,
  };
  
  return invokeCompat<number>("add_resource", primaryParams, "add_room", fallbackParams);
};

// De-hotelified wrappers
export const addResource = (resource: NewResource): Promise<number> => addRoom(resource);

// UI-facing generic wrapper (preferred)
export const addUnit = (unit: NewUnit): Promise<number> => addRoom(unit);

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
  invokeCompat<Room[]>("get_resources", undefined, "get_rooms");

export const getResources = (): Promise<Resource[]> => getRooms();

// UI-facing generic wrapper (preferred)
export const getUnits = (): Promise<Unit[]> => getRooms();

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
  invokeCompat<Room[]>(
    "get_available_resources_for_customer",
    { customerId: guestId || null },
    "get_available_rooms_for_guest",
    { guestId: guestId || null }
  );

export const getAvailableResourcesForCustomer = (customerId?: number): Promise<Resource[]> =>
  getAvailableRoomsForGuest(customerId);

// UI-facing generic wrapper (preferred)
export const getAvailableUnitsForCustomer = (customerId?: number): Promise<Unit[]> =>
  getAvailableRoomsForGuest(customerId);

/**
 * Update room details
 * @param roomId - ID of the room to update
 * @param updates - Fields to update
 * @returns Success status
 */
export const updateRoom = (roomId: number, updates: Partial<NewRoom>): Promise<boolean> => 
  invokeCompat<boolean>(
    "update_resource",
    { resource_id: roomId, number: updates.number, daily_rate: updates.daily_rate },
    "update_room",
    { room_id: roomId, number: updates.number, daily_rate: updates.daily_rate }
  );

// UI-facing generic wrapper (preferred)
export const updateUnit = (unitId: number, updates: Partial<NewUnit>): Promise<boolean> =>
  updateRoom(unitId, updates);

/**
 * Delete a room from the system
 * @param roomId - ID of the room to delete
 * @returns Success status
 */
export const deleteRoom = async (roomId: number): Promise<boolean> => {
  return invokeCompat<boolean>("delete_resource", { id: roomId }, "delete_room", { id: roomId });
};

// UI-facing generic wrapper (preferred)
export const deleteUnit = (unitId: number): Promise<boolean> => deleteRoom(unitId);

/**
 * Clean up any soft-deleted rooms that might be blocking room number reuse
 * @returns Number of rooms cleaned up
 */
export const cleanupSoftDeletedRooms = async (): Promise<string> => {
  return invoke<string>("cleanup_soft_deleted_rooms");
};

// UI-facing generic wrapper (preferred)
export const cleanupSoftDeletedUnits = (): Promise<string> => cleanupSoftDeletedRooms();

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
  
  return invokeCompat<number>("add_customer", params, "add_guest", params);
};

// UI-facing generic wrapper (preferred)
export const addCustomer = (customer: NewCustomer): Promise<number> => addGuest(customer);

/**
 * Get all currently active guests
 * @returns Array of active guests with their details
 */
export const getActiveGuests = (): Promise<ActiveGuestRow[]> => 
  invokeCompat<ActiveGuestRow[]>("get_active_customers", undefined, "get_active_guests");

// UI-facing generic wrapper (preferred)
export const getActiveCustomers = (): Promise<ActiveCustomerRow[]> => getActiveGuests();

/**
 * Get all guests (active and checked out)
 * @returns Array of all guests
 */
export const getAllGuests = (): Promise<Guest[]> => 
  invokeCompat<Guest[]>("get_all_customers", undefined, "get_all_guests");

// UI-facing generic wrapper (preferred)
export const getCustomers = (): Promise<Customer[]> => getAllGuests();

/**
 * Get a specific guest by ID
 * @param guestId - ID of the guest
 * @returns Guest details with current bill
 */
export const getGuest = (guestId: number): Promise<Guest> => 
  invokeCompat<Guest>("get_customer", { customerId: guestId }, "get_guest", { guestId });

// UI-facing generic wrapper (preferred)
export const getCustomer = (customerId: number): Promise<Customer> => getGuest(customerId);

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
  invokeCompat<number>("checkout_customer", { customerId: guestId, checkOutDate }, "checkout_guest", { guestId, checkOutDate });

// UI-facing generic wrapper (preferred)
export const checkoutCustomer = (customerId: number, actionOutDate: string): Promise<number> =>
  checkoutGuest(customerId, actionOutDate);

/**
 * Update guest information
 * @param guestId - ID of the guest to update
 * @param updates - Fields to update
 * @returns Success status
 */
export const updateGuest = (guestId: number, updates: Partial<NewGuest>): Promise<boolean> => 
  invokeCompat<boolean>("update_customer", {
    guest_id: guestId,
    name: updates.name,
    phone: updates.phone,
    room_id: updates.room_id,
    check_in: updates.check_in,
    check_out: updates.check_out === undefined ? null : updates.check_out,
    daily_rate: updates.daily_rate
  }, "update_guest", { 
    guest_id: guestId,
    name: updates.name,
    phone: updates.phone,
    room_id: updates.room_id,
    check_in: updates.check_in,
    check_out: updates.check_out === undefined ? null : updates.check_out,
    daily_rate: updates.daily_rate
  });

// UI-facing generic wrapper (preferred)
export const updateCustomer = (customerId: number, updates: Partial<NewCustomer>): Promise<boolean> =>
  updateGuest(customerId, updates);

// Menu Management APIs
/**
 * Get all menu items
 * @returns Array of all menu items
 */
export const getMenuItems = (): Promise<MenuItem[]> => 
  invoke<unknown[]>("get_menu_items").then((rows) =>
    rows.map((raw: any) => {
      // Tauri commonly serializes struct fields / command params as camelCase.
      // Normalize to the app's snake_case `MenuItem` shape.
      const normalized: MenuItem = {
        ...raw,
        sku: raw.sku ?? raw.SKU ?? undefined,
        barcode: raw.barcode ?? raw.barCode ?? raw.Barcode ?? undefined,
        is_available: raw.is_available ?? raw.isAvailable ?? false,
        track_stock: raw.track_stock ?? raw.trackStock,
        stock_quantity: raw.stock_quantity ?? raw.stockQuantity,
        low_stock_limit: raw.low_stock_limit ?? raw.lowStockLimit,
        description: raw.description ?? ''
      };
      return normalized;
    })
  );

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
    sku: item.sku,
    barcode: item.barcode,
    price: item.price, 
    category: item.category, 
    description: item.description,
    isAvailable: item.is_available,
    trackStock: item.track_stock,
    stockQuantity: item.stock_quantity,
    lowStockLimit: item.low_stock_limit
  });

/**
 * Update menu item details
 * @param itemId - ID of the menu item
 * @param updates - Fields to update
 * @returns Success status
 */
export const updateMenuItem = async (itemId: number, updates: Partial<NewMenuItem>): Promise<boolean> => {
  const params = { 
    itemId: itemId,
    name: updates.name,
    sku: updates.sku,
    barcode: updates.barcode,
    price: updates.price,
    category: updates.category,
    description: updates.description,
    isAvailable: updates.is_available,
    trackStock: updates.track_stock,
    stockQuantity: updates.stock_quantity,
    lowStockLimit: updates.low_stock_limit
  };
  
  return invoke<boolean>("update_menu_item", params);
};

// ===== STOCK ADJUSTMENTS (Retail inventory audit) =====

export interface StockAdjustmentItemInput {
  menu_item_id: number;
  mode: 'set' | 'add' | 'remove';
  quantity: number;
  note?: string;
}

export interface StockAdjustmentSummary {
  id: number;
  adjustment_date: string;
  reason?: string | null;
  notes?: string | null;
  item_count: number;
  created_at: string;
}

export interface StockAdjustmentItemRow {
  id: number;
  adjustment_id: number;
  menu_item_id: number;
  item_name: string;
  previous_stock: number;
  quantity_change: number;
  new_stock: number;
  note?: string | null;
}

export interface StockAdjustmentDetails {
  adjustment: StockAdjustmentSummary;
  items: StockAdjustmentItemRow[];
}

export const addStockAdjustment = (args: {
  adjustment_date: string;
  reason?: string;
  notes?: string;
  items: StockAdjustmentItemInput[];
}): Promise<number> =>
  invoke<number>('add_stock_adjustment', {
    adjustmentDate: args.adjustment_date,
    reason: args.reason,
    notes: args.notes,
    items: args.items.map((it) => ({
      menuItemId: it.menu_item_id,
      mode: it.mode,
      quantity: it.quantity,
      note: it.note,
    })),
  });

export const getStockAdjustments = (): Promise<StockAdjustmentSummary[]> =>
  invoke<any[]>('get_stock_adjustments').then((rows) =>
    rows.map((raw) => ({
      id: raw.id,
      adjustment_date: raw.adjustment_date ?? raw.adjustmentDate,
      reason: raw.reason ?? null,
      notes: raw.notes ?? null,
      item_count: raw.item_count ?? raw.itemCount ?? 0,
      created_at: raw.created_at ?? raw.createdAt,
    }))
  );

export const getStockAdjustmentDetails = (adjustmentId: number): Promise<StockAdjustmentDetails> =>
  invoke<any>('get_stock_adjustment_details', { adjustmentId }).then((raw) => {
    const a = raw.adjustment ?? raw.stockAdjustment ?? raw;
    const items = (raw.items ?? []) as any[];
    return {
      adjustment: {
        id: a.id,
        adjustment_date: a.adjustment_date ?? a.adjustmentDate,
        reason: a.reason ?? null,
        notes: a.notes ?? null,
        item_count: a.item_count ?? a.itemCount ?? 0,
        created_at: a.created_at ?? a.createdAt,
      },
      items: items.map((it) => ({
        id: it.id,
        adjustment_id: it.adjustment_id ?? it.adjustmentId,
        menu_item_id: it.menu_item_id ?? it.menuItemId,
        item_name: it.item_name ?? it.itemName,
        previous_stock: it.previous_stock ?? it.previousStock,
        quantity_change: it.quantity_change ?? it.quantityChange,
        new_stock: it.new_stock ?? it.newStock,
        note: it.note ?? null,
      })),
    };
  });

// Product categories (for retail inventory)
export const getProductCategories = (): Promise<ProductCategory[]> =>
  invoke<ProductCategory[]>("get_product_categories");

export const addProductCategory = (name: string): Promise<number> =>
  invoke<number>("add_product_category", { name });

export const renameProductCategory = (categoryId: number, name: string): Promise<boolean> =>
  invoke<boolean>("rename_product_category", { categoryId, name });

export const updateProductCategory = (categoryId: number, updates: { name?: string; color?: string; emoji?: string }): Promise<boolean> =>
  invoke<boolean>("update_product_category", { categoryId, ...updates });

export const addProductCategoryWithStyle = (args: { name: string; color?: string; emoji?: string }): Promise<number> =>
  invoke<number>("add_product_category", args);

export const deleteProductCategory = (categoryId: number): Promise<boolean> =>
  invoke<boolean>("delete_product_category", { categoryId });

/**
 * Delete a menu item
 * @param itemId - ID of the menu item to delete
 * @returns Success status
 */
export const deleteMenuItem = async (itemId: number): Promise<boolean> => {
  return invoke<boolean>("delete_menu_item", { itemId: itemId });
};

// ===== OPTIONAL BARCODE / SKU FEATURES =====

export const getBarcodeEnabled = (): Promise<boolean> =>
  invoke<boolean>('get_barcode_enabled');

export const setBarcodeEnabled = (enabled: boolean): Promise<string> =>
  invoke<string>('set_barcode_enabled', { enabled });

// ===== RETURNS / REFUNDS =====

export interface ReturnableSaleItem {
  sale_item_id: number;
  menu_item_id: number | null;
  item_name: string;
  unit_price: number;
  sold_qty: number;
  returned_qty: number;
  remaining_qty: number;
}

export interface SaleReturnItemInput {
  sale_item_id: number;
  quantity: number;
  note?: string | null;
}

export interface SaleReturnSummary {
  id: number;
  sale_id: number;
  return_date: string;
  refund_method: string | null;
  refund_amount: number;
  item_count: number;
  created_at: string;
}

export interface SaleReturnItemRow {
  id: number;
  return_id: number;
  sale_item_id: number;
  menu_item_id: number | null;
  item_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  note: string | null;
}

export interface SaleReturnDetails {
  ret: SaleReturnSummary;
  items: SaleReturnItemRow[];
}

export const getSaleReturnableItems = (orderId: number): Promise<ReturnableSaleItem[]> =>
  invoke<ReturnableSaleItem[]>('get_sale_returnable_items', { orderId });

export const addSaleReturn = (args: {
  saleId: number;
  returnDate: string;
  refundMethod?: string | null;
  refundAmount?: number | null;
  note?: string | null;
  items: SaleReturnItemInput[];
}): Promise<number> =>
  invoke<number>('add_sale_return', {
    saleId: args.saleId,
    returnDate: args.returnDate,
    refundMethod: args.refundMethod ?? null,
    refundAmount: args.refundAmount ?? null,
    note: args.note ?? null,
    items: args.items,
  });

export const getSaleReturns = (limit?: number): Promise<SaleReturnSummary[]> =>
  invoke<SaleReturnSummary[]>('get_sale_returns', { limit: limit ?? null });

export const getSaleReturnDetails = (returnId: number): Promise<SaleReturnDetails> =>
  invoke<SaleReturnDetails>('get_sale_return_details', { returnId });

export const buildSaleReturnReceiptHtml = (returnId: number): Promise<string> =>
  invoke<string>('build_sale_return_receipt_html', { returnId });

export const printSaleReturnReceipt = (returnId: number): Promise<string> =>
  invoke<string>('print_sale_return_receipt', { returnId });

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
  
  return invokeCompat<number>("add_sale", params, "add_food_order", params);
};

// UI-facing generic wrapper (preferred)
export const addSale = (sale: NewSale): Promise<number> => addFoodOrder(sale);

/**
 * Get all food orders
 * @returns Array of all food orders with summary details
 */
export const getFoodOrders = (): Promise<FoodOrderSummary[]> => 
  invokeCompat<FoodOrderSummary[]>("get_sales", undefined, "get_food_orders");

// UI-facing generic wrapper (preferred)
export const getSales = (): Promise<SaleSummary[]> => getFoodOrders();

/**
 * Get food orders for a specific guest
 * @param guestId - ID of the guest
 * @returns Array of orders for that guest
 */
export const getGuestOrders = (guestId: number): Promise<FoodOrder[]> => 
  invokeCompat<FoodOrder[]>("get_sales_by_customer", { customerId: guestId }, "get_food_orders_by_guest", { guestId });

/**
 * Alias for getGuestOrders - same functionality
 * @param guestId - ID of the guest
 * @returns Array of orders for that guest
 */
export const getFoodOrdersByGuest = (guestId: number): Promise<FoodOrderSummary[]> => 
  invokeCompat<FoodOrderSummary[]>("get_sales_by_customer", { customerId: guestId }, "get_food_orders_by_guest", { guestId });

// UI-facing generic wrapper (preferred)
export const getSalesByCustomer = (customerId: number): Promise<SaleSummary[]> =>
  getFoodOrdersByGuest(customerId);

/**
 * Mark a food order as paid
 * @param orderId - ID of the order to mark as paid
 * @returns Success status
 */
export const markOrderPaid = (orderId: number): Promise<string> => 
  invokeCompat<string>("mark_sale_paid", { orderId }, "mark_order_paid", { orderId });

/**
 * Toggle payment status of a food order (paid/unpaid)
 * @param orderId - ID of the order to toggle payment status
 * @returns Success message
 */
export const toggleFoodOrderPayment = (orderId: number): Promise<string> => 
  invokeCompat<string>("toggle_sale_payment", { orderId }, "toggle_food_order_payment", { orderId });

// UI-facing generic wrapper (preferred)
export const toggleSalePayment = (saleId: number): Promise<string> => toggleFoodOrderPayment(saleId);

/**
 * Delete a food order and all its items
 * @param orderId - ID of the order to delete
 * @returns Success message
 */
export const deleteFoodOrder = (orderId: number): Promise<string> => 
  invokeCompat<string>("delete_sale", { orderId }, "delete_food_order", { orderId });

// UI-facing generic wrapper (preferred)
export const deleteSale = (saleId: number): Promise<string> => deleteFoodOrder(saleId);

/**
 * Get detailed information about a food order including all items
 * @param orderId - ID of the order to get details for
 * @returns Order details with items
 */
export const getOrderDetails = (orderId: number): Promise<FoodOrderDetails> => 
  invokeCompat<FoodOrderDetails>("get_sale_details", { orderId }, "get_order_details", { orderId });

// UI-facing generic wrapper (preferred)
export const getSaleDetails = (saleId: number): Promise<SaleDetails> => getOrderDetails(saleId);

/**
 * Add a payment to a sale (supports partial payments / pay-later).
 */
export const addSalePayment = (
  saleId: number,
  amount: number,
  method: string,
  note?: string
): Promise<SalePaymentSummary> =>
  invoke<SalePaymentSummary>("add_sale_payment", {
    saleId,
    amount,
    method,
    note,
  });

/**
 * Get payment summary for a sale (total, paid, balance, payments list).
 */
export const getSalePaymentSummary = (saleId: number): Promise<SalePaymentSummary> =>
  invoke<SalePaymentSummary>("get_sale_payment_summary", { saleId });

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

// ===== SUPPLIERS & PURCHASES (Stock-In) APIs =====

export const addSupplier = (supplier: NewSupplier): Promise<number> =>
  invoke('add_supplier', { ...supplier });

export const getSuppliers = (includeInactive?: boolean): Promise<Supplier[]> =>
  invoke('get_suppliers', { includeInactive });

export const updateSupplier = (
  supplierId: number,
  updates: Partial<NewSupplier> & { is_active?: boolean }
): Promise<string> => invoke('update_supplier', { supplierId, ...updates });

export const deleteSupplier = (supplierId: number): Promise<string> =>
  invoke('delete_supplier', { supplierId });

export type PurchasePaymentMode = 'pay_now' | 'pay_later' | 'pay_partial';

export const addPurchase = (args: {
  supplierId?: number | null;
  purchaseDate: string;
  reference?: string;
  notes?: string;
  items: PurchaseItemInput[];
  paymentMode?: PurchasePaymentMode;
  paymentAmount?: number;
  paymentMethod?: 'cash' | 'card' | 'mobile' | 'bank';
  paymentNote?: string;
  updateStock?: boolean;
}): Promise<number> =>
  invoke('add_purchase', { ...args });

export const getPurchases = (): Promise<PurchaseSummary[]> =>
  invoke('get_purchases');

export const getPurchaseDetails = (purchaseId: number): Promise<PurchaseDetails> =>
  invoke('get_purchase_details', { purchaseId });

export const deletePurchase = (purchaseId: number, rollbackStock?: boolean): Promise<string> =>
  invoke('delete_purchase', { purchaseId, rollbackStock });

export const addSupplierPayment = (args: {
  supplierId: number;
  purchaseId?: number | null;
  amount: number;
  method: 'cash' | 'card' | 'mobile' | 'bank';
  note?: string;
}): Promise<SupplierBalanceSummary> => invoke('add_supplier_payment', { ...args });

export const getSupplierPayments = (supplierId: number): Promise<SupplierPayment[]> =>
  invoke('get_supplier_payments', { supplierId });

export const getSupplierBalanceSummaries = (includeInactive?: boolean): Promise<SupplierBalanceSummary[]> =>
  invoke('get_supplier_balance_summaries', { includeInactive });

// ===== ACCOUNTS APIs =====

export const getCustomerBalanceSummaries = (): Promise<CustomerBalanceSummary[]> =>
  invoke('get_customer_balance_summaries');

export const getCustomerSaleBalances = (customerId: number): Promise<CustomerSaleBalanceRow[]> =>
  invoke('get_customer_sale_balances', { customerId });

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
): Promise<number> => {
  void discountType;
  void discountDescription;
  return invokeCompat<number>(
    "checkout_customer_with_discount",
    { customerId: guestId, checkOutDate, discountAmount },
    "checkout_guest_with_discount",
    { guestId, checkOutDate, discountAmount }
  );
};

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
export const handleApiError = (error: unknown): string => {
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
  if (error instanceof Error) {
    return error.message || 'An unexpected error occurred. Please try again.';
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

// ============================================================================
// LOYALTY SYSTEM (Phase 5)
// ============================================================================

export interface PointTransaction {
  id: number;
  customer_id: number;
  order_id?: number;
  points_change: number;
  reason: string;
  created_at: string;
}

export interface LoyaltyConfig {
  points_per_dollar: number;
  dollars_per_point: number;
}

/**
 * Get loyalty points configuration
 * @returns Tuple of [points_per_dollar, dollars_per_point]
 */
export const getLoyaltyConfig = (): Promise<[number, number]> => 
  invoke("get_loyalty_config");

/**
 * Set loyalty points configuration
 * @param pointsPerDollar - How many points earned per dollar spent (e.g., 0.1 = 1 point per $10)
 * @param dollarsPerPoint - Dollar value of each point (e.g., 0.1 = 1 point = $0.10)
 * @returns Success message
 */
export const setLoyaltyConfig = (pointsPerDollar: number, dollarsPerPoint: number): Promise<string> => 
  invoke("set_loyalty_config", { pointsPerDollar, dollarsPerPoint });

/**
 * Award loyalty points to a customer for a completed sale
 * @param customerId - ID of the customer
 * @param orderId - ID of the order/sale
 * @param orderTotal - Total amount of the order
 * @returns Number of points awarded
 */
export const awardLoyaltyPoints = (customerId: number, orderId: number, orderTotal: number): Promise<number> => 
  invoke("award_loyalty_points", { customerId, orderId, orderTotal });

/**
 * Get a customer's current loyalty points balance
 * @param customerId - ID of the customer
 * @returns Current points balance
 */
export const getCustomerLoyaltyPoints = (customerId: number): Promise<number> => 
  invoke("get_customer_loyalty_points", { customerId });

/**
 * Redeem loyalty points for a discount
 * @param customerId - ID of the customer
 * @param pointsToRedeem - Number of points to redeem
 * @returns Discount amount in dollars
 */
export const redeemLoyaltyPoints = (customerId: number, pointsToRedeem: number): Promise<number> => 
  invoke("redeem_loyalty_points", { customerId, pointsToRedeem });

/**
 * Get point transaction history for a customer
 * @param customerId - ID of the customer
 * @param limit - Maximum number of transactions to return (default: 50)
 * @returns Array of point transactions
 */
export const getPointTransactions = (customerId: number, limit?: number): Promise<PointTransaction[]> => 
  invoke("get_point_transactions", { customerId, limit });
