const express = require('express');
const db = require('../models/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all guests with pagination
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '';
    let params = [];

    if (status) {
      whereClause += ' WHERE status = ?';
      params.push(status);
    }

    if (search) {
      whereClause += status ? ' AND' : ' WHERE';
      whereClause += ' (name LIKE ? OR email LIKE ? OR phone LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Get total count
    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM guests${whereClause}`);
    const { total } = countStmt.get(...params);

    // Get guests
    const guestsStmt = db.prepare(`
      SELECT * FROM guests${whereClause}
      ORDER BY checkin_date DESC
      LIMIT ? OFFSET ?
    `);
    
    const guests = guestsStmt.all(...params, limit, offset);

    res.json({
      guests,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalGuests: total,
        hasNext: offset + limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get guests error:', error);
    res.status(500).json({ error: 'Failed to fetch guests' });
  }
});

// Get single guest by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const stmt = db.prepare('SELECT * FROM guests WHERE id = ?');
    const guest = stmt.get(id);

    if (!guest) {
      return res.status(404).json({ error: 'Guest not found' });
    }

    res.json(guest);
  } catch (error) {
    console.error('Get guest error:', error);
    res.status(500).json({ error: 'Failed to fetch guest' });
  }
});

// Create new guest
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      address,
      idNumber,
      roomNumber,
      checkinDate,
      checkoutDate,
      totalAmount,
      paidAmount,
      notes
    } = req.body;

    if (!name || !roomNumber || !checkinDate) {
      return res.status(400).json({ error: 'Name, room number, and check-in date are required' });
    }

    const balanceAmount = (totalAmount || 0) - (paidAmount || 0);
    const paymentStatus = balanceAmount <= 0 ? 'paid' : 'pending';

    const stmt = db.prepare(`
      INSERT INTO guests (
        name, email, phone, address, id_number, room_number,
        checkin_date, checkout_date, total_amount, paid_amount,
        balance_amount, payment_status, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    const result = stmt.run(
      name, email, phone, address, idNumber, roomNumber,
      checkinDate, checkoutDate, totalAmount, paidAmount,
      balanceAmount, paymentStatus, notes
    );

    // Update room status to occupied
    const updateRoomStmt = db.prepare('UPDATE rooms SET status = ? WHERE room_number = ?');
    updateRoomStmt.run('occupied', roomNumber);

    // Add revenue entry
    if (paidAmount > 0) {
      const revenueStmt = db.prepare(`
        INSERT INTO revenue (
          source, description, amount, revenue_date, guest_id, room_number,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      
      revenueStmt.run(
        'room_booking',
        `Room booking payment from ${name}`,
        paidAmount,
        checkinDate,
        result.lastInsertRowid,
        roomNumber
      );
    }

    res.status(201).json({
      message: 'Guest added successfully',
      guestId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Create guest error:', error);
    res.status(500).json({ error: 'Failed to create guest' });
  }
});

// Update guest
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      phone,
      address,
      idNumber,
      roomNumber,
      checkinDate,
      checkoutDate,
      totalAmount,
      paidAmount,
      status,
      notes
    } = req.body;

    // Check if guest exists
    const existingGuest = db.prepare('SELECT * FROM guests WHERE id = ?').get(id);
    if (!existingGuest) {
      return res.status(404).json({ error: 'Guest not found' });
    }

    const balanceAmount = (totalAmount || 0) - (paidAmount || 0);
    const paymentStatus = balanceAmount <= 0 ? 'paid' : 'pending';

    const stmt = db.prepare(`
      UPDATE guests SET
        name = ?, email = ?, phone = ?, address = ?, id_number = ?,
        room_number = ?, checkin_date = ?, checkout_date = ?,
        total_amount = ?, paid_amount = ?, balance_amount = ?,
        payment_status = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
      name, email, phone, address, idNumber, roomNumber,
      checkinDate, checkoutDate, totalAmount, paidAmount,
      balanceAmount, paymentStatus, status, notes, id
    );

    // Update room status if room changed or guest checked out
    if (roomNumber !== existingGuest.room_number) {
      // Free up old room
      const freeOldRoomStmt = db.prepare('UPDATE rooms SET status = ? WHERE room_number = ?');
      freeOldRoomStmt.run('available', existingGuest.room_number);
      
      // Occupy new room
      const occupyNewRoomStmt = db.prepare('UPDATE rooms SET status = ? WHERE room_number = ?');
      occupyNewRoomStmt.run('occupied', roomNumber);
    }

    if (status === 'checked_out') {
      const freeRoomStmt = db.prepare('UPDATE rooms SET status = ? WHERE room_number = ?');
      freeRoomStmt.run('available', roomNumber);
    }

    res.json({ message: 'Guest updated successfully' });
  } catch (error) {
    console.error('Update guest error:', error);
    res.status(500).json({ error: 'Failed to update guest' });
  }
});

// Delete guest
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get guest info before deletion
    const guest = db.prepare('SELECT room_number FROM guests WHERE id = ?').get(id);
    if (!guest) {
      return res.status(404).json({ error: 'Guest not found' });
    }

    // Delete guest
    const stmt = db.prepare('DELETE FROM guests WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Guest not found' });
    }

    // Free up room
    const freeRoomStmt = db.prepare('UPDATE rooms SET status = ? WHERE room_number = ?');
    freeRoomStmt.run('available', guest.room_number);

    res.json({ message: 'Guest deleted successfully' });
  } catch (error) {
    console.error('Delete guest error:', error);
    res.status(500).json({ error: 'Failed to delete guest' });
  }
});

// Check out guest
router.post('/:id/checkout', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { checkoutDate, additionalCharges = 0, notes } = req.body;

    const guest = db.prepare('SELECT * FROM guests WHERE id = ?').get(id);
    if (!guest) {
      return res.status(404).json({ error: 'Guest not found' });
    }

    const finalAmount = guest.total_amount + additionalCharges;
    const finalBalance = finalAmount - guest.paid_amount;

    const stmt = db.prepare(`
      UPDATE guests SET
        checkout_date = ?,
        total_amount = ?,
        balance_amount = ?,
        status = 'checked_out',
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(checkoutDate || new Date().toISOString(), finalAmount, finalBalance, notes, id);

    // Free up room
    const freeRoomStmt = db.prepare('UPDATE rooms SET status = ? WHERE room_number = ?');
    freeRoomStmt.run('available', guest.room_number);

    res.json({ 
      message: 'Guest checked out successfully',
      finalBalance 
    });
  } catch (error) {
    console.error('Checkout guest error:', error);
    res.status(500).json({ error: 'Failed to check out guest' });
  }
});

module.exports = router;
