const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

const DATA_PATH = path.resolve(__dirname, '../data/hotels.json');

/**
 * GET /api/hotels - Retrieve all hotels
 */
router.get('/', async (req, res) => {
  try {
    const data = await fs.readFile(DATA_PATH, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load hotels' });
  }
});

/**
 * GET /api/hotels/:id - Retrieve a specific hotel
 */
router.get('/:id', async (req, res) => {
  try {
    const data = await fs.readFile(DATA_PATH, 'utf8');
    const hotels = JSON.parse(data);
    const hotel = hotels.find(h => h.id === req.params.id);
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });
    res.json(hotel);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load hotel' });
  }
});

module.exports = router;
