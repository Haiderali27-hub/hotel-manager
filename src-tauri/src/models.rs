#![allow(dead_code)]

use serde::{Deserialize, Serialize};

// ===== CORE MODELS =====

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Resource {
    pub id: i64,
    pub number: String,
    pub room_type: String,
    pub daily_rate: f64,
    pub is_occupied: bool,
    pub guest_id: Option<i64>,
    pub guest_name: Option<String>,
}

// Backwards-compatible alias (commands/TS types can be migrated gradually)
pub type Room = Resource;

#[derive(Debug, Serialize, Deserialize)]
pub struct NewCustomer {
    pub name: String,
    pub phone: Option<String>,
    pub room_id: Option<i64>,  // Changed to Option to support walk-in customers
    pub check_in: String, // YYYY-MM-DD format
    pub check_out: Option<String>, // YYYY-MM-DD format
    pub daily_rate: f64,
}

pub type NewGuest = NewCustomer;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Customer {
    pub id: i64,
    pub name: String,
    pub phone: Option<String>,
    pub room_id: Option<i64>,  // Changed to Option to support walk-in customers
    pub check_in: String,
    pub check_out: Option<String>,
    pub daily_rate: f64,
    pub status: String, // 'active' or 'checked_out'
    pub created_at: String,
    pub updated_at: String,
}

pub type Guest = Customer;

#[derive(Debug, Serialize, Deserialize)]
pub struct ActiveCustomerRow {
    pub guest_id: i64,
    pub name: String,
    pub room_number: Option<String>,  // Changed to Option for walk-in customers
    pub check_in: String,
    pub check_out: Option<String>,
    pub daily_rate: f64,
    pub is_walkin: bool,  // New field to identify walk-in customers
}

pub type ActiveGuestRow = ActiveCustomerRow;

#[derive(Debug, Serialize, Deserialize)]
pub struct MenuItem {
    pub id: i64,
    pub name: String,
    pub sku: Option<String>,
    pub barcode: Option<String>,
    pub price: f64,
    pub category: String,
    pub description: String,
    pub is_available: bool,
    pub stock_quantity: i32,
    pub track_stock: i32,
    pub low_stock_limit: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StockAdjustmentItemInput {
    pub menu_item_id: i64,
    pub mode: String, // set | add | remove
    pub quantity: i32,
    pub note: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StockAdjustmentSummary {
    pub id: i64,
    pub adjustment_date: String,
    pub reason: Option<String>,
    pub notes: Option<String>,
    pub item_count: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StockAdjustmentItemRow {
    pub id: i64,
    pub adjustment_id: i64,
    pub menu_item_id: i64,
    pub item_name: String,
    pub previous_stock: i32,
    pub quantity_change: i32,
    pub new_stock: i32,
    pub note: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StockAdjustmentDetails {
    pub adjustment: StockAdjustmentSummary,
    pub items: Vec<StockAdjustmentItemRow>,
}

// ===== SALES RETURNS / REFUNDS =====

#[derive(Debug, Serialize, Deserialize)]
pub struct SaleReturnItemInput {
    pub sale_item_id: i64,
    pub quantity: i32,
    pub note: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReturnableSaleItem {
    pub sale_item_id: i64,
    pub menu_item_id: Option<i64>,
    pub item_name: String,
    pub unit_price: f64,
    pub sold_qty: i32,
    pub returned_qty: i32,
    pub remaining_qty: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaleReturnSummary {
    pub id: i64,
    pub sale_id: i64,
    pub return_date: String,
    pub refund_method: Option<String>,
    pub refund_amount: f64,
    pub item_count: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaleReturnItemRow {
    pub id: i64,
    pub return_id: i64,
    pub sale_item_id: i64,
    pub menu_item_id: Option<i64>,
    pub item_name: String,
    pub unit_price: f64,
    pub quantity: i32,
    pub line_total: f64,
    pub note: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaleReturnDetails {
    pub ret: SaleReturnSummary,
    pub items: Vec<SaleReturnItemRow>,
}

// ===== BUSINESS MODE STATUS =====

#[derive(Debug, Serialize, Deserialize)]
pub struct BusinessModeStatus {
    pub mode: String,
    pub locked: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProductCategory {
    pub id: i64,
    pub name: String,
    pub color: Option<String>,
    pub emoji: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NewOrderItem {
    pub menu_item_id: Option<i64>,
    pub item_name: String,
    pub unit_price: f64,
    pub quantity: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NewFoodOrder {
    pub customer_type: String, // 'GUEST' or 'WALK_IN'
    pub guest_id: Option<i64>,
    pub customer_name: Option<String>,
    pub items: Vec<NewOrderItem>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OrderSummary {
    pub id: i64,
    pub customer_type: String,
    pub customer_name: Option<String>,
    pub created_at: String,
    pub paid: bool,
    pub paid_at: Option<String>,
    pub total_amount: f64,
    pub items: Vec<OrderItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OrderItem {
    pub id: i64,
    pub item_name: String,
    pub unit_price: f64,
    pub quantity: i64,
    pub line_total: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExpenseInput {
    pub date: String, // YYYY-MM-DD format
    pub category: String,
    pub description: Option<String>,
    pub amount: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExpenseRow {
    pub id: i64,
    pub date: String,
    pub category: String,
    pub description: Option<String>,
    pub amount: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CheckoutTotals {
    pub room_total: f64,
    pub unpaid_food: f64,
    pub grand_total: f64,
    pub stay_days: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DashboardStats {
    pub total_guests_this_month: i64,
    pub total_income: f64,
    pub total_expenses: f64,
    pub profit_loss: f64,
    pub total_food_orders: i64,
    pub active_guests: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MonthlyReport {
    pub income: f64,
    pub expenses: f64,
    pub profit_loss: f64,
}

// ===== HISTORY & FILTERS =====

#[derive(Debug, Serialize, Deserialize)]
pub struct HistoryQuery {
    pub tab: String, // 'guests', 'orders', 'expenses'
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub room_id: Option<i64>,
    pub guest_id: Option<i64>,
    pub category: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HistoryRow {
    pub id: i64,
    pub date: String,
    pub description: String,
    pub amount: Option<f64>,
    pub details: serde_json::Value,
}

// ===== SALES MODELS (De-hotelified) =====

#[derive(Debug, Serialize, Deserialize)]
pub struct OrderItemInput {
    pub menu_item_id: Option<i64>,
    pub item_name: String,
    pub unit_price: f64,
    pub quantity: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaleSummary {
    pub id: i64,
    pub created_at: String,
    pub paid: bool,
    pub paid_at: Option<String>,
    pub total_amount: f64,
    pub items: String, // comma-separated list
    pub guest_id: Option<i64>,
    pub guest_name: Option<String>,
}

// Backwards-compatible alias (older command/TS naming)
pub type FoodOrderSummary = SaleSummary;

#[derive(Debug, Serialize, Deserialize)]
pub struct SaleRecord {
    pub id: i64,
    pub guest_id: Option<i64>,
    pub customer_type: String,
    pub customer_name: Option<String>,
    pub created_at: String,
    pub paid: bool,
    pub paid_at: Option<String>,
    pub total_amount: f64,
}

// Backwards-compatible alias
pub type FoodOrderInfo = SaleRecord;

#[derive(Debug, Serialize, Deserialize)]
pub struct OrderItemDetail {
    pub id: i64,
    pub menu_item_id: Option<i64>,
    pub item_name: String,
    pub quantity: i64,
    pub unit_price: f64,
    pub line_total: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaleDetails {
    pub order: SaleRecord,
    pub items: Vec<OrderItemDetail>,
}

// Backwards-compatible alias
pub type FoodOrderDetails = SaleDetails;

// ===== PAYMENTS (Partial / Pay-Later) =====

#[derive(Debug, Serialize, Deserialize)]
pub struct SalePayment {
    pub id: i64,
    pub sale_id: i64,
    pub amount: f64,
    pub method: String,
    pub note: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SalePaymentSummary {
    pub sale_id: i64,
    pub total_amount: f64,
    pub amount_paid: f64,
    pub balance_due: f64,
    pub paid: bool,
    pub paid_at: Option<String>,
    pub payments: Vec<SalePayment>,
}

// ===== INVENTORY MODELS =====

#[derive(Debug, Serialize, Deserialize)]
pub struct LowStockItem {
    pub id: i64,
    pub name: String,
    pub stock_quantity: i32,
    pub low_stock_limit: i32,
}

// ===== SHIFT MANAGEMENT MODELS =====

#[derive(Debug, Serialize, Deserialize)]
pub struct ShiftSummary {
    pub id: i64,
    pub opened_at: String,
    pub closed_at: Option<String>,
    pub opened_by: i64,
    pub closed_by: Option<i64>,
    pub start_cash: f64,
    pub end_cash_expected: f64,
    pub end_cash_actual: f64,
    pub difference: f64,
    pub total_sales: f64,
    pub total_expenses: f64,
    pub status: String, // 'open' or 'closed'
    pub notes: Option<String>,
}

// ===== EXPENSE MODELS =====

#[derive(Debug, Serialize, Deserialize)]
pub struct ExpenseRecord {
    pub id: i64,
    pub date: String,
    pub category: String,
    pub description: Option<String>,
    pub amount: f64,
}

// ===== SUPPLIERS & PURCHASES (Stock-In) =====

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Supplier {
    pub id: i64,
    pub name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub notes: Option<String>,
    pub is_active: bool,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PurchaseItemInput {
    pub menu_item_id: Option<i64>,
    pub item_name: String,
    pub quantity: i32,
    pub unit_cost: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PurchaseItemRow {
    pub id: i64,
    pub purchase_id: i64,
    pub menu_item_id: Option<i64>,
    pub item_name: String,
    pub quantity: i32,
    pub unit_cost: f64,
    pub line_total: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PurchaseSummary {
    pub id: i64,
    pub purchase_date: String,
    pub supplier_id: Option<i64>,
    pub supplier_name: Option<String>,
    pub reference: Option<String>,
    pub notes: Option<String>,
    pub total_amount: f64,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PurchaseDetails {
    pub purchase: PurchaseSummary,
    pub items: Vec<PurchaseItemRow>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SupplierPayment {
    pub id: i64,
    pub supplier_id: i64,
    pub purchase_id: Option<i64>,
    pub amount: f64,
    pub method: String,
    pub note: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SupplierBalanceSummary {
    pub supplier_id: i64,
    pub supplier_name: String,
    pub total_purchases: f64,
    pub amount_paid: f64,
    pub balance_due: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CustomerBalanceSummary {
    pub customer_id: i64,
    pub customer_name: String,
    pub total_sales: f64,
    pub amount_paid: f64,
    pub balance_due: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CustomerSaleBalanceRow {
    pub sale_id: i64,
    pub created_at: String,
    pub total_amount: f64,
    pub amount_paid: f64,
    pub balance_due: f64,
    pub paid: bool,
}

// ===== LOYALTY SYSTEM MODELS (Phase 5) =====

#[derive(Debug, Serialize, Deserialize)]
pub struct PointTransaction {
    pub id: i64,
    pub customer_id: i64,
    pub order_id: Option<i64>,
    pub points_change: i64,
    pub reason: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoyaltyConfig {
    pub points_per_dollar: f64, // e.g., 0.1 = 10 cents earns 1 point
    pub dollars_per_point: f64, // e.g., 0.1 = 1 point = 10 cents discount
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RedeemPointsResult {
    pub discount_amount: f64,
    pub points_used: i64,
    pub remaining_points: i64,
}
