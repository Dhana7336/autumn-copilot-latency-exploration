/**
 * Copilot Router - Main Entry Point
 * Routes split into smaller modules for better performance
 */

const express = require('express');
const router = express.Router();

const dataLoader = require('../services/dataLoader');
const { generatePricingRecommendation } = require('../pricing/competitorPricing');
const { calculateOccupancy, estimateRevenueImpact } = require('../utils/revenueCalculations');

// Import split route modules
const copilotChat = require('./copilotChat');
const copilotDashboard = require('./copilotDashboard');
const copilotApply = require('./copilotApply');

// Import existing sub-routers
const chatRoutes = require('./chatRoutes');
const actionRoutes = require('./actionRoutes');
const dataRoutes = require('./dataRoutes');
const agentRoutes = require('./agentRoutes');

// Mount main routes
router.use('/chat', copilotChat);
router.use('/dashboard', copilotDashboard);
router.use('/apply', copilotApply);

// Mount additional sub-routers
router.use('/chat-simple', chatRoutes);
router.use('/actions', actionRoutes);
router.use('/data', dataRoutes);
router.use('/agent-flow', agentRoutes);

// Suggest endpoint
router.post('/suggest', async (req, res) => {
  try {
    const { roomType, intent } = req.body || {};

    const roomsData = dataLoader.rooms || [];
    const competitors = dataLoader.competitors || [];
    const reservations = dataLoader.reservations || [];

    const enrichedRooms = roomsData.map(room => {
      const type = room.room_type || room['Room Type'] || 'Unknown';
      const basePrice = room.base_price || room['Base Price'] || 150;
      const totalRooms = room.total_rooms || room['Total Rooms'] || 10;

      const occupancyData = calculateOccupancy(reservations, type, totalRooms);
      const pricingRec = generatePricingRecommendation(type, basePrice, competitors, occupancyData.rate);

      return {
        id: (type || 'unknown').toLowerCase().replace(/\s+/g, '-'),
        name: type,
        currentPrice: basePrice,
        occupancy: occupancyData.rate,
        competitorAvg: pricingRec.competitorAvg,
        totalRooms,
        bookedRooms: occupancyData.bookedRooms,
        recommendation: pricingRec
      };
    });

    let targetRooms = enrichedRooms;
    if (roomType) {
      targetRooms = enrichedRooms.filter(r => r.name.toLowerCase().includes(roomType.toLowerCase()));
    }

    const suggestions = targetRooms.map(room => {
      const rec = room.recommendation;
      const impact = estimateRevenueImpact(room.currentPrice, rec.suggestedPrice, room.occupancy, room.totalRooms, 30);

      return {
        roomType: room.name,
        currentPrice: room.currentPrice,
        suggestedPrice: rec.suggestedPrice,
        change: rec.priceChange,
        occupancy: Math.round(room.occupancy * 100) + '%',
        competitorAvg: rec.competitorAvg,
        reasoning: rec.reasoning,
        impact: {
          projectedRevenue: impact.projectedRevenue,
          revenueDelta: impact.revenueDelta,
          riskLevel: impact.riskLevel
        }
      };
    });

    res.json({
      ok: true,
      suggestions,
      context: {
        totalRooms: targetRooms.reduce((sum, r) => sum + r.totalRooms, 0),
        avgOccupancy: Math.round(targetRooms.reduce((sum, r) => sum + r.occupancy, 0) / targetRooms.length * 100) + '%',
        intent: intent || 'review'
      }
    });

  } catch (err) {
    console.error('Suggest error:', err);
    res.status(500).json({ error: 'Failed to generate suggestions', details: err.message });
  }
});

// Redirect endpoints for compatibility
router.post('/llm', (req, res, next) => {
  router.handle({ ...req, url: '/chat', method: 'POST' }, res, next);
});

router.get('/dashboard/current-suggestions', (req, res, next) => {
  router.handle({ ...req, url: '/dashboard', method: 'GET' }, res, next);
});

// Direct data routes
router.get('/rooms', (req, res) => {
  try {
    res.json(dataLoader.rooms || []);
  } catch (err) {
    console.error('Failed to load rooms:', err);
    res.status(500).json({ error: 'Failed to load rooms' });
  }
});

router.get('/reservations', (req, res) => {
  try {
    const reservations = dataLoader.reservations || [];
    res.json({ success: true, data: reservations, count: reservations.length });
  } catch (err) {
    console.error('Failed to load reservations:', err);
    res.status(500).json({ error: 'Failed to load reservations' });
  }
});

module.exports = router;
