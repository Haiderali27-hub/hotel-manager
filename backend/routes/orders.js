const express = require('express');
const db = require('../models/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all food orders
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, roomNumber } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '';
    let params = [];

    if (status) {
      whereClause += ' WHERE fo.status = ?';
      params.push(status);
    }

    if (roomNumber) {
      whereClause += status ? ' AND' : ' WHERE';
      whereClause += ' fo.room_number = ?';
      params.push(roomNumber);
    }

    // Get total count
    const countStmt = db.prepare(`
      SELECT COUNT(*) as total 
      FROM food_orders fo${whereClause}
    `);
    const { total } = countStmt.get(...params);

    // Get orders with guest information
    const ordersStmt = db.prepare(`
      SELECT 
        fo.*,
        g.name as guest_name,
        g.phone as guest_phone
      FROM food_orders fo
      LEFT JOIN guests g ON fo.guest_id = g.id
      ${whereClause}
      ORDER BY fo.order_date DESC
      LIMIT ? OFFSET ?
    `);
    
    const orders = ordersStmt.all(...params, limit, offset);

    // Parse order_items JSON for each order
    const ordersWithParsedItems = orders.map(order => ({
      ...order,
      order_items: JSON.parse(order.order_items || '[]')
    }));

    res.json({
      orders: ordersWithParsedItems,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalOrders: total,
        hasNext: offset + limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get single order by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const stmt = db.prepare(`
      SELECT 
        fo.*,
        g.name as guest_name,
        g.phone as guest_phone,
        g.email as guest_email
      FROM food_orders fo
      LEFT JOIN guests g ON fo.guest_id = g.id
      WHERE fo.id = ?
    `);
    
    const order = stmt.get(id);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Parse order_items JSON
    order.order_items = JSON.parse(order.order_items || '[]');

    res.json(order);
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Create new food order
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      guestId,
      roomNumber,
      orderItems,
      totalAmount,
      deliveryTime,
      notes
    } = req.body;

    if (!roomNumber || !orderItems || !totalAmount) {
      return res.status(400).json({ error: 'Room number, order items, and total amount are required' });
    }

    if (!Array.isArray(orderItems) || orderItems.length === 0) {
      return res.status(400).json({ error: 'Order items must be a non-empty array' });
    }

    // Validate guest exists if guestId provided
    if (guestId) {
      const guest = db.prepare('SELECT id FROM guests WHERE id = ?').get(guestId);
      if (!guest) {
        return res.status(400).json({ error: 'Guest not found' });
      }
    }

    const stmt = db.prepare(`
      INSERT INTO food_orders (
        guest_id, room_number, order_items, total_amount,
        delivery_time, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    const result = stmt.run(
      guestId,
      roomNumber,
      JSON.stringify(orderItems),
      totalAmount,
      deliveryTime,
      notes
    );

    // Add revenue entry for food order
    const revenueStmt = db.prepare(`
      INSERT INTO revenue (
        source, description, amount, revenue_date, guest_id, room_number,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    revenueStmt.run(
      'food_order',
      `Food order for room ${roomNumber}`,
      totalAmount,
      new Date().toISOString().split('T')[0],
      guestId,
      roomNumber
    );

    res.status(201).json({
      message: 'Food order created successfully',
      orderId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Update food order
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      guestId,
      roomNumber,
      orderItems,
      totalAmount,
      status,
      deliveryTime,
      notes
    } = req.body;

    // Check if order exists
    const existingOrder = db.prepare('SELECT * FROM food_orders WHERE id = ?').get(id);
    if (!existingOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const stmt = db.prepare(`
      UPDATE food_orders SET
        guest_id = ?, room_number = ?, order_items = ?, total_amount = ?,
        status = ?, delivery_time = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
      guestId,
      roomNumber,
      JSON.stringify(orderItems),
      totalAmount,
      status,
      deliveryTime,
      notes,
      id
    );

    res.json({ message: 'Order updated successfully' });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// Delete food order
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const stmt = db.prepare('DELETE FROM food_orders WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

// Update order status
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const validStatuses = ['pending', 'preparing', 'ready', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const stmt = db.prepare(`
      UPDATE food_orders SET
        status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const result = stmt.run(status, id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ message: 'Order status updated successfully' });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// Get orders by room number
router.get('/room/:roomNumber', authenticateToken, async (req, res) => {
  try {
    const { roomNumber } = req.params;
    const { status } = req.query;

    let whereClause = 'WHERE fo.room_number = ?';
    let params = [roomNumber];

    if (status) {
      whereClause += ' AND fo.status = ?';
      params.push(status);
    }

    const stmt = db.prepare(`
      SELECT 
        fo.*,
        g.name as guest_name,
        g.phone as guest_phone
      FROM food_orders fo
      LEFT JOIN guests g ON fo.guest_id = g.id
      ${whereClause}
      ORDER BY fo.order_date DESC
    `);
    
    const orders = stmt.all(...params);

    // Parse order_items JSON for each order
    const ordersWithParsedItems = orders.map(order => ({
      ...order,
      order_items: JSON.parse(order.order_items || '[]')
    }));

    res.json(ordersWithParsedItems);
  } catch (error) {
    console.error('Get room orders error:', error);
    res.status(500).json({ error: 'Failed to fetch room orders' });
  }
});

module.exports = router;
