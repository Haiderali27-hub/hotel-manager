import { invoke } from "@tauri-apps/api/core";

// ===== TYPE DEFINITIONS =====

export interface Room {
  id: number;
  number: string;
  is_active: boolean;
}

export interface NewGuest {
  name: string;
  phone?: string;
  room_id: number;
  check_in: string; // YYYY-MM-DD
  check_out?: string; // YYYY-MM-DD
  daily_rate: number;
}

export interface ActiveGuestRow {
  guest_id: number;
  name: string;
  room_number: string;
  check_in: string;
  daily_rate: number;
}

export interface MenuItem {
  id: number;
  name: string;
  price: number;
  is_active: boolean;
}

export interface NewOrderItem {
  menu_item_id?: number;
  item_name: string;
  unit_price: number;
  quantity: number;
}

export interface NewFoodOrder {
  customer_type: 'GUEST' | 'WALK_IN';
  guest_id?: number;
  customer_name?: string;
  items: NewOrderItem[];
}

export interface OrderSummary {
  id: number;
  customer_type: string;
  customer_name?: string;
  created_at: string;
  paid: boolean;
  paid_at?: string;
  total_amount: number;
  items: OrderItem[];
}

export interface OrderItem {
  id: number;
  item_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface ExpenseInput {
  date: string; // YYYY-MM-DD
  category: string;
  description?: string;
  amount: number;
}

export interface ExpenseRow {
  id: number;
  date: string;
  category: string;
  description?: string;
  amount: number;
}

export interface CheckoutTotals {
  room_total: number;
  unpaid_food: number;
  grand_total: number;
  stay_days: number;
}

export interface DashboardStats {
  total_guests_this_month: number;
  total_income: number;
  total_expenses: number;
  profit_loss: number;
  total_food_orders: number;
  active_guests: number;
}

export interface MonthlyReport {
  income: number;
  expenses: number;
  profit_loss: number;
}

export interface HistoryQuery {
  tab: 'guests' | 'orders' | 'expenses';
  date_from?: string;
  date_to?: string;
  room_id?: number;
  guest_id?: number;
  category?: string;
}

export interface HistoryRow {
  id: number;
  date: string;
  description: string;
  amount?: number;
  details: any;
}

// ===== ROOM COMMANDS =====

export async function addRoom(number: string): Promise<Room> {
  return invoke("add_room", { number });
}

export async function getRooms(): Promise<Room[]> {
  return invoke("get_rooms");
}

export async function deleteRoom(id: number): Promise<void> {
  return invoke("delete_room", { id });
}

// ===== GUEST COMMANDS =====

export async function addGuest(g: NewGuest): Promise<number> {
  return invoke("add_guest", { g });
}

export async function getActiveGuests(): Promise<ActiveGuestRow[]> {
  return invoke("get_active_guests");
}

export async function editGuest(
  guestId: number, 
  newRoomId?: number, 
  newCheckout?: string, 
  newRate?: number
): Promise<void> {
  return invoke("edit_guest", { 
    guest_id: guestId, 
    new_room_id: newRoomId, 
    new_checkout: newCheckout, 
    new_rate: newRate 
  });
}

export async function checkoutGuest(
  guestId: number, 
  discountFlat?: number, 
  discountPct?: number
): Promise<CheckoutTotals> {
  return invoke("checkout_guest", { 
    guest_id: guestId, 
    discount_flat: discountFlat, 
    discount_pct: discountPct 
  });
}

// ===== MENU COMMANDS =====

export async function addMenuItem(name: string, price: number): Promise<number> {
  return invoke("add_menu_item", { name, price });
}

export async function getMenuItems(): Promise<MenuItem[]> {
  return invoke("get_menu_items");
}

export async function updateMenuItem(
  id: number, 
  name?: string, 
  price?: number, 
  isActive?: boolean
): Promise<void> {
  return invoke("update_menu_item", { 
    id, 
    name, 
    price, 
    is_active: isActive 
  });
}

// ===== ORDER COMMANDS =====

export async function addFoodOrder(order: NewFoodOrder): Promise<number> {
  return invoke("add_food_order", { order });
}

export async function getFoodOrdersByGuest(guestId: number): Promise<OrderSummary[]> {
  return invoke("get_food_orders_by_guest", { guest_id: guestId });
}

export async function markOrderPaid(orderId: number, paid: boolean): Promise<void> {
  return invoke("mark_order_paid", { order_id: orderId, paid });
}

// ===== EXPENSE COMMANDS =====

export async function addExpense(e: ExpenseInput): Promise<number> {
  return invoke("add_expense", { e });
}

export async function getExpenses(
  dateFrom: string, 
  dateTo: string, 
  category?: string
): Promise<ExpenseRow[]> {
  return invoke("get_expenses", { 
    date_from: dateFrom, 
    date_to: dateTo, 
    category 
  });
}

// ===== REPORTS & DASHBOARD =====

export async function dashboardStats(): Promise<DashboardStats> {
  return invoke("dashboard_stats");
}

export async function monthlyReport(year: number, month: number): Promise<MonthlyReport> {
  return invoke("monthly_report", { year, month });
}

export async function history(query: HistoryQuery): Promise<HistoryRow[]> {
  return invoke("history", { query });
}

// ===== EXPORT & PRINT =====

export async function buildOrderReceiptHtml(orderId: number): Promise<string> {
  return invoke("build_order_receipt_html", { order_id: orderId });
}

export async function buildFinalInvoiceHtml(
  guestId: number, 
  discountFlat?: number, 
  discountPct?: number
): Promise<string> {
  return invoke("build_final_invoice_html", { 
    guest_id: guestId, 
    discount_flat: discountFlat, 
    discount_pct: discountPct 
  });
}

export async function exportHistoryCsv(tab: string, filters: HistoryQuery): Promise<string> {
  return invoke("export_history_csv", { tab, filters });
}

export async function backupDatabase(targetDir: string): Promise<string> {
  return invoke("backup_database", { target_dir: targetDir });
}

// ===== UTILITY FUNCTIONS =====

// Helper function to print HTML content
export function printHtml(htmlContent: string): void {
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
    printWindow.close();
  }
}

// Helper function to open file in system default application
export async function openFile(filePath: string): Promise<void> {
  // This would need to be implemented with Tauri's shell API
  // or a custom command if needed
  console.log(`File saved to: ${filePath}`);
}
