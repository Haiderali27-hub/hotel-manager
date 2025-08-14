const express = require('express');
const db = require('../models/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all rooms
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, type } = req.query;
    
    let whereClause = '';
    let params = [];

    if (status) {
      whereClause += ' WHERE status = ?';
      params.push(status);
    }

    if (type) {
      whereClause += status ? ' AND' : ' WHERE';
      whereClause += ' room_type = ?';
      params.push(type);
    }

    const stmt = db.prepare(`
      SELECT * FROM rooms${whereClause}
      ORDER BY room_number
    `);
    
    const rooms = stmt.all(...params);
    res.json(rooms);
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// Get single room
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const stmt = db.prepare('SELECT * FROM rooms WHERE id = ?');
    const room = stmt.get(id);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json(room);
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

// Create new room
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      roomNumber,
      roomType,
      capacity,
      pricePerNight,
      amenities,
      description
    } = req.body;

    if (!roomNumber || !roomType || !pricePerNight) {
      return res.status(400).json({ error: 'Room number, type, and price are required' });
    }

    // Check if room number already exists
    const existingRoom = db.prepare('SELECT id FROM rooms WHERE room_number = ?').get(roomNumber);
    if (existingRoom) {
      return res.status(400).json({ error: 'Room number already exists' });
    }

    const stmt = db.prepare(`
      INSERT INTO rooms (
        room_number, room_type, capacity, price_per_night,
        amenities, description, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    const result = stmt.run(
      roomNumber,
      roomType,
      capacity || 2,
      pricePerNight,
      amenities,
      description
    );

    res.status(201).json({
      message: 'Room created successfully',
      roomId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Update room
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      roomNumber,
      roomType,
      capacity,
      pricePerNight,
      status,
      amenities,
      description
    } = req.body;

    // Check if room exists
    const existingRoom = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!existingRoom) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check if room number conflicts with another room
    if (roomNumber !== existingRoom.room_number) {
      const conflictRoom = db.prepare('SELECT id FROM rooms WHERE room_number = ? AND id != ?').get(roomNumber, id);
      if (conflictRoom) {
        return res.status(400).json({ error: 'Room number already exists' });
      }
    }

    const stmt = db.prepare(`
      UPDATE rooms SET
        room_number = ?, room_type = ?, capacity = ?, price_per_night = ?,
        status = ?, amenities = ?, description = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
      roomNumber,
      roomType,
      capacity,
      pricePerNight,
      status,
      amenities,
      description,
      id
    );

    res.json({ message: 'Room updated successfully' });
  } catch (error) {
    console.error('Update room error:', error);
    res.status(500).json({ error: 'Failed to update room' });
  }
});

// Delete room
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if room has active guests
    const activeGuests = db.prepare(`
      SELECT COUNT(*) as count FROM guests 
      WHERE room_number = (SELECT room_number FROM rooms WHERE id = ?) 
      AND status = 'active'
    `).get(id);

    if (activeGuests.count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete room with active guests' 
      });
    }

    const stmt = db.prepare('DELETE FROM rooms WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

// Get room availability
router.get('/availability/check', authenticateToken, async (req, res) => {
  try {
    const { checkIn, checkOut, roomType } = req.query;

    if (!checkIn || !checkOut) {
      return res.status(400).json({ error: 'Check-in and check-out dates are required' });
    }

    let query = `
      SELECT r.* FROM rooms r
      WHERE r.status = 'available'
      AND r.id NOT IN (
        SELECT DISTINCT g.room_number 
        FROM guests g 
        WHERE g.status = 'active'
        AND (
          (g.checkin_date <= ? AND (g.checkout_date IS NULL OR g.checkout_date >= ?))
        )
      )
    `;

    let params = [checkOut, checkIn];

    if (roomType) {
      query += ' AND r.room_type = ?';
      params.push(roomType);
    }

    query += ' ORDER BY r.room_number';

    const stmt = db.prepare(query);
    const availableRooms = stmt.all(...params);

    res.json({
      availableRooms,
      checkIn,
      checkOut,
      roomType: roomType || 'all'
    });
  } catch (error) {
    console.error('Room availability error:', error);
    res.status(500).json({ error: 'Failed to check room availability' });
  }
});

module.exports = router;
