use serde::{Deserialize, Serialize};

// ===== CORE MODELS =====

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Room {
    pub id: i64,
    pub number: String,
    pub room_type: String,
    pub daily_rate: f64,
    pub is_occupied: bool,
    pub guest_id: Option<i64>,
    pub guest_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NewGuest {
    pub name: String,
    pub phone: Option<String>,
    pub room_id: Option<i64>,  // Changed to Option to support walk-in customers
    pub check_in: String, // YYYY-MM-DD format
    pub check_out: Option<String>, // YYYY-MM-DD format
    pub daily_rate: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Guest {
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

#[derive(Debug, Serialize, Deserialize)]
pub struct ActiveGuestRow {
    pub guest_id: i64,
    pub name: String,
    pub room_number: Option<String>,  // Changed to Option for walk-in customers
    pub check_in: String,
    pub check_out: Option<String>,
    pub daily_rate: f64,
    pub is_walkin: bool,  // New field to identify walk-in customers
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MenuItem {
    pub id: i64,
    pub name: String,
    pub price: f64,
    pub category: String,
    pub is_available: bool,
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

// ===== FOOD ORDER MODELS =====

#[derive(Debug, Serialize, Deserialize)]
pub struct OrderItemInput {
    pub menu_item_id: Option<i64>,
    pub item_name: String,
    pub unit_price: f64,
    pub quantity: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FoodOrderSummary {
    pub id: i64,
    pub created_at: String,
    pub paid: bool,
    pub paid_at: Option<String>,
    pub total_amount: f64,
    pub items: String, // comma-separated list
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FoodOrderInfo {
    pub id: i64,
    pub guest_id: Option<i64>,
    pub customer_type: String,
    pub customer_name: Option<String>,
    pub created_at: String,
    pub paid: bool,
    pub paid_at: Option<String>,
    pub total_amount: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OrderItemDetail {
    pub id: i64,
    pub menu_item_id: Option<i64>,
    pub item_name: String,
    pub quantity: i64,
    pub unit_price: f64,
    pub total_price: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FoodOrderDetails {
    pub order: FoodOrderInfo,
    pub items: Vec<OrderItemDetail>,
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
