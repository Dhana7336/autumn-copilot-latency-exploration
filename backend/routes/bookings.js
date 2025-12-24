const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

const DATA_PATH = path.resolve(__dirname, '../data/bookings.json');

/**
 * GET /api/bookings - Retrieve all bookings
 */
router.get('/', async (req, res) => {
  try {
    const data = await fs.readFile(DATA_PATH, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load bookings' });
  }
});

/**
 * POST /api/bookings - Create a new booking
 */
router.post('/', async (req, res) => {
  try {
    const { roomId, checkIn, checkOut, guestName } = req.body;
    const data = await fs.readFile(DATA_PATH, 'utf8');
    const bookings = JSON.parse(data);
    const newBooking = {
      id: `b${Date.now()}`,
      roomId,
      checkIn,
      checkOut,
      guestName,
      createdAt: new Date().toISOString()
    };
    bookings.push(newBooking);
    await fs.writeFile(DATA_PATH, JSON.stringify(bookings, null, 2), 'utf8');
    res.status(201).json(newBooking);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

module.exports = router;
