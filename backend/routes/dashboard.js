const express = require('express');
const db = require('../models/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get dashboard statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format

    // Total guests this month
    const totalGuestsStmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM guests 
      WHERE strftime('%Y-%m', checkin_date) = ?
    `);
    const totalGuests = totalGuestsStmt.get(currentMonth).count;

    // Active guests (currently checked in)
    const activeGuestsStmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM guests 
      WHERE status = 'active' AND (checkout_date IS NULL OR checkout_date > datetime('now'))
    `);
    const activeGuests = activeGuestsStmt.get().count;

    // Total income this month
    const totalIncomeStmt = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM revenue 
      WHERE strftime('%Y-%m', revenue_date) = ?
    `);
    const totalIncome = totalIncomeStmt.get(currentMonth).total;

    // Total expenses this month
    const totalExpensesStmt = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM expenses 
      WHERE strftime('%Y-%m', expense_date) = ?
    `);
    const totalExpenses = totalExpensesStmt.get(currentMonth).total;

    // Profit/Loss calculation
    const profitLoss = totalIncome - totalExpenses;

    // Total food orders this month
    const totalFoodOrdersStmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM food_orders 
      WHERE strftime('%Y-%m', order_date) = ?
    `);
    const totalFoodOrders = totalFoodOrdersStmt.get(currentMonth).count;

    // Recent activity (last 10 guests)
    const recentGuestsStmt = db.prepare(`
      SELECT id, name, room_number, checkin_date, status
      FROM guests 
      ORDER BY checkin_date DESC 
      LIMIT 10
    `);
    const recentGuests = recentGuestsStmt.all();

    // Room occupancy
    const roomStatsStmt = db.prepare(`
      SELECT 
        COUNT(*) as total_rooms,
        COUNT(CASE WHEN status = 'occupied' THEN 1 END) as occupied_rooms,
        COUNT(CASE WHEN status = 'available' THEN 1 END) as available_rooms
      FROM rooms
    `);
    const roomStats = roomStatsStmt.get();

    res.json({
      totalGuests,
      activeGuests,
      totalIncome: parseFloat(totalIncome),
      totalExpenses: parseFloat(totalExpenses),
      profitLoss: parseFloat(profitLoss),
      totalFoodOrders,
      recentGuests,
      roomStats: {
        totalRooms: roomStats.total_rooms,
        occupiedRooms: roomStats.occupied_rooms,
        availableRooms: roomStats.available_rooms,
        occupancyRate: roomStats.total_rooms > 0 ? 
          ((roomStats.occupied_rooms / roomStats.total_rooms) * 100).toFixed(1) : 0
      },
      currency: 'PKR',
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// Get monthly revenue chart data
router.get('/revenue-chart', authenticateToken, async (req, res) => {
  try {
    const { months = 6 } = req.query;
    
    const revenueChartStmt = db.prepare(`
      SELECT 
        strftime('%Y-%m', revenue_date) as month,
        SUM(amount) as revenue
      FROM revenue 
      WHERE revenue_date >= date('now', '-${months} months')
      GROUP BY strftime('%Y-%m', revenue_date)
      ORDER BY month
    `);
    
    const chartData = revenueChartStmt.all();
    
    res.json(chartData);
  } catch (error) {
    console.error('Revenue chart error:', error);
    res.status(500).json({ error: 'Failed to fetch revenue chart data' });
  }
});

// Get expense breakdown
router.get('/expense-breakdown', authenticateToken, async (req, res) => {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    const expenseBreakdownStmt = db.prepare(`
      SELECT 
        category,
        SUM(amount) as total,
        COUNT(*) as count
      FROM expenses 
      WHERE strftime('%Y-%m', expense_date) = ?
      GROUP BY category
      ORDER BY total DESC
    `);
    
    const breakdown = expenseBreakdownStmt.all(currentMonth);
    
    res.json(breakdown);
  } catch (error) {
    console.error('Expense breakdown error:', error);
    res.status(500).json({ error: 'Failed to fetch expense breakdown' });
  }
});

module.exports = router;
