const express = require('express');
const db = require('../models/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// ===== EXPENSE ROUTES =====

// Get all expenses
router.get('/expenses', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, category, startDate, endDate } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '';
    let params = [];

    if (category) {
      whereClause += ' WHERE category = ?';
      params.push(category);
    }

    if (startDate) {
      whereClause += category ? ' AND' : ' WHERE';
      whereClause += ' expense_date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      whereClause += (category || startDate) ? ' AND' : ' WHERE';
      whereClause += ' expense_date <= ?';
      params.push(endDate);
    }

    // Get total count
    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM expenses${whereClause}`);
    const { total } = countStmt.get(...params);

    // Get expenses
    const expensesStmt = db.prepare(`
      SELECT * FROM expenses${whereClause}
      ORDER BY expense_date DESC, created_at DESC
      LIMIT ? OFFSET ?
    `);
    
    const expenses = expensesStmt.all(...params, limit, offset);

    res.json({
      expenses,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalExpenses: total,
        hasNext: offset + limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// Get single expense
router.get('/expenses/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const stmt = db.prepare('SELECT * FROM expenses WHERE id = ?');
    const expense = stmt.get(id);

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.json(expense);
  } catch (error) {
    console.error('Get expense error:', error);
    res.status(500).json({ error: 'Failed to fetch expense' });
  }
});

// Create new expense
router.post('/expenses', authenticateToken, async (req, res) => {
  try {
    const {
      category,
      description,
      amount,
      expenseDate,
      paymentMethod,
      receiptNumber,
      notes
    } = req.body;

    if (!category || !description || !amount || !expenseDate) {
      return res.status(400).json({ error: 'Category, description, amount, and expense date are required' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    const stmt = db.prepare(`
      INSERT INTO expenses (
        category, description, amount, expense_date, payment_method,
        receipt_number, notes, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    const result = stmt.run(
      category,
      description,
      amount,
      expenseDate,
      paymentMethod,
      receiptNumber,
      notes,
      req.user.username
    );

    res.status(201).json({
      message: 'Expense created successfully',
      expenseId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// Update expense
router.put('/expenses/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      category,
      description,
      amount,
      expenseDate,
      paymentMethod,
      receiptNumber,
      notes
    } = req.body;

    // Check if expense exists
    const existingExpense = db.prepare('SELECT id FROM expenses WHERE id = ?').get(id);
    if (!existingExpense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    const stmt = db.prepare(`
      UPDATE expenses SET
        category = ?, description = ?, amount = ?, expense_date = ?,
        payment_method = ?, receipt_number = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
      category,
      description,
      amount,
      expenseDate,
      paymentMethod,
      receiptNumber,
      notes,
      id
    );

    res.json({ message: 'Expense updated successfully' });
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

// Delete expense
router.delete('/expenses/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const stmt = db.prepare('DELETE FROM expenses WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

// ===== REVENUE ROUTES =====

// Get all revenue
router.get('/revenue', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, source, startDate, endDate } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '';
    let params = [];

    if (source) {
      whereClause += ' WHERE source = ?';
      params.push(source);
    }

    if (startDate) {
      whereClause += source ? ' AND' : ' WHERE';
      whereClause += ' revenue_date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      whereClause += (source || startDate) ? ' AND' : ' WHERE';
      whereClause += ' revenue_date <= ?';
      params.push(endDate);
    }

    // Get total count
    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM revenue${whereClause}`);
    const { total } = countStmt.get(...params);

    // Get revenue
    const revenueStmt = db.prepare(`
      SELECT 
        r.*,
        g.name as guest_name
      FROM revenue r
      LEFT JOIN guests g ON r.guest_id = g.id
      ${whereClause}
      ORDER BY r.revenue_date DESC, r.created_at DESC
      LIMIT ? OFFSET ?
    `);
    
    const revenue = revenueStmt.all(...params, limit, offset);

    res.json({
      revenue,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalRevenue: total,
        hasNext: offset + limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get revenue error:', error);
    res.status(500).json({ error: 'Failed to fetch revenue' });
  }
});

// Create new revenue entry
router.post('/revenue', authenticateToken, async (req, res) => {
  try {
    const {
      source,
      description,
      amount,
      revenueDate,
      guestId,
      roomNumber,
      referenceNumber,
      notes
    } = req.body;

    if (!source || !amount || !revenueDate) {
      return res.status(400).json({ error: 'Source, amount, and revenue date are required' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    const stmt = db.prepare(`
      INSERT INTO revenue (
        source, description, amount, revenue_date, guest_id,
        room_number, reference_number, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    const result = stmt.run(
      source,
      description,
      amount,
      revenueDate,
      guestId,
      roomNumber,
      referenceNumber,
      notes
    );

    res.status(201).json({
      message: 'Revenue entry created successfully',
      revenueId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Create revenue error:', error);
    res.status(500).json({ error: 'Failed to create revenue entry' });
  }
});

// ===== FINANCIAL SUMMARY ROUTES =====

// Get financial summary
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const { period = 'month', startDate, endDate } = req.query;
    
    let dateFilter = '';
    let params = [];

    if (startDate && endDate) {
      dateFilter = 'WHERE date_field >= ? AND date_field <= ?';
      params = [startDate, endDate];
    } else {
      // Default to current month
      const currentMonth = new Date().toISOString().slice(0, 7);
      dateFilter = "WHERE strftime('%Y-%m', date_field) = ?";
      params = [currentMonth];
    }

    // Total revenue
    const revenueStmt = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM revenue
      ${dateFilter.replace('date_field', 'revenue_date')}
    `);
    const totalRevenue = revenueStmt.get(...params).total;

    // Total expenses
    const expenseStmt = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM expenses
      ${dateFilter.replace('date_field', 'expense_date')}
    `);
    const totalExpenses = expenseStmt.get(...params).total;

    // Revenue by source
    const revenueBySourceStmt = db.prepare(`
      SELECT source, SUM(amount) as total
      FROM revenue
      ${dateFilter.replace('date_field', 'revenue_date')}
      GROUP BY source
      ORDER BY total DESC
    `);
    const revenueBySource = revenueBySourceStmt.all(...params);

    // Expenses by category
    const expensesByCategoryStmt = db.prepare(`
      SELECT category, SUM(amount) as total
      FROM expenses
      ${dateFilter.replace('date_field', 'expense_date')}
      GROUP BY category
      ORDER BY total DESC
    `);
    const expensesByCategory = expensesByCategoryStmt.all(...params);

    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(2) : 0;

    res.json({
      summary: {
        totalRevenue: parseFloat(totalRevenue),
        totalExpenses: parseFloat(totalExpenses),
        netProfit: parseFloat(netProfit),
        profitMargin: parseFloat(profitMargin)
      },
      breakdown: {
        revenueBySource,
        expensesByCategory
      },
      period: {
        type: period,
        startDate: startDate || `${new Date().toISOString().slice(0, 7)}-01`,
        endDate: endDate || new Date().toISOString().slice(0, 10)
      },
      currency: 'PKR',
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Financial summary error:', error);
    res.status(500).json({ error: 'Failed to fetch financial summary' });
  }
});

module.exports = router;
