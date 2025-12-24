const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const dataLoader = require('../services/dataLoader');
const pricingEngine = require('../pricing/pricingEngine');
const actions = require('../copilot/actions');
const AUDIT_PATH = path.resolve(__dirname, '../data/audit.json');

// Get all rooms
router.get('/rooms', async (req, res) => {
  try {
    const rooms = dataLoader.rooms || [];
    res.json(rooms);
  } catch (err) {
    console.error('Failed to load rooms:', err);
    res.status(500).json({ error: 'Failed to load rooms' });
  }
});

// Get all reservations
router.get('/reservations', async (req, res) => {
  try {
    const reservations = dataLoader.reservations || [];
    res.json({
      success: true,
      data: reservations,
      count: reservations.length
    });
  } catch (err) {
    console.error('Failed to load reservations:', err);
    res.status(500).json({ error: 'Failed to load reservations' });
  }
});

// Get audit log
router.get('/audit', async (req, res) => {
  try {
    const data = await fs.readFile(AUDIT_PATH, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load audit log' });
  }
});

// Get dashboard data with current suggestions
router.get('/dashboard', async (req, res) => {
  try {
    const config = await actions.getActionConfig();
    const roomsData = dataLoader.rooms || [];
    const competitors = dataLoader.competitors || [];
    const reservations = dataLoader.reservations || [];
    
    // Prepare room data
    const enrichedRooms = roomsData.map(room => {
      const roomType = room.room_type || room['Room Type'];
      const basePrice = room.base_price || room['Base Price'] || 150;
      const todayStr = new Date().toISOString().split('T')[0];
      
      // Calculate competitor average
      const competitorPrices = competitors
        .filter(c => (c.room_type || c['Room Type']) === roomType)
        .map(c => parseFloat(c.avg_price || c['Avg Price'] || 0));
      const competitorAvg = competitorPrices.length > 0 
        ? competitorPrices.reduce((a, b) => a + b, 0) / competitorPrices.length 
        : basePrice;
      
      // Calculate occupancy
      const totalRoomsOfType = room.total_rooms || room['Total Rooms'] || 10;
      const bookedRooms = reservations.filter(res => {
        const resRoomType = res.room_type || res['Room Type'] || '';
        const baseRoomType = resRoomType.split('(')[0].trim();
        if (baseRoomType !== roomType && resRoomType !== roomType) return false;
        
        const status = (res.Status || res.status || '').toLowerCase();
        if (status !== 'confirmed' && status !== 'in-house') return false;
        
        const checkIn = res.check_in_date || res['Check In Date'] || res.checkInDate;
        const checkOut = res.check_out_date || res['Check Out Date'] || res.checkOutDate;
        if (!checkIn || !checkOut) return false;
        
        return checkIn <= todayStr && checkOut > todayStr;
      }).length;
      
      const occupancy = Math.min(bookedRooms / totalRoomsOfType, 1);
      
      return {
        id: roomType.toLowerCase().replace(/\s+/g, '-'),
        name: roomType,
        room_type: roomType,
        currentPrice: basePrice,
        occupancy: occupancy,
        competitorAvg: Math.round(competitorAvg),
        totalRooms: totalRoomsOfType,
        bookedRooms: bookedRooms
      };
    });
    
    // Generate pricing suggestions
    const { suggestions } = pricingEngine.generateSuggestions(enrichedRooms, 'review');
    
    // Calculate metrics
    const totalRooms = enrichedRooms.reduce((sum, r) => sum + r.totalRooms, 0);
    const totalBooked = enrichedRooms.reduce((sum, r) => sum + r.bookedRooms, 0);
    const overallOccupancy = totalBooked / totalRooms;
    const avgDailyRate = enrichedRooms.reduce((sum, r) => sum + r.currentPrice, 0) / enrichedRooms.length;
    const revPAR = avgDailyRate * overallOccupancy;
    
    // Get recent actions
    const auditLog = await fs.readFile(AUDIT_PATH, 'utf8')
      .then(d => JSON.parse(d))
      .catch(() => []);
    
    const recentActions = auditLog
      .slice(-5)
      .reverse()
      .map(entry => ({
        time: entry.time,
        operator: entry.operatorName || entry.operator,
        action: entry.intent,
        summary: entry.applied?.[0]?.message || 'Action applied'
      }));
    
    res.json({
      success: true,
      metrics: {
        avgDailyRate: Math.round(avgDailyRate),
        occupancy: Math.round(overallOccupancy * 100),
        revPAR: Math.round(revPAR),
        totalRooms,
        totalBooked
      },
      suggestions: suggestions.map(s => {
        const room = enrichedRooms.find(r => r.id === s.id);
        const priceDiff = ((s.suggested - room.currentPrice) / room.currentPrice) * 100;
        
        return {
          id: s.id,
          room: room.name,
          current: room.currentPrice,
          suggested: s.suggested,
          change: priceDiff.toFixed(1),
          competitorAvg: room.competitorAvg,
          occupancy: Math.round(room.occupancy * 100)
        };
      }),
      recentActions,
      roomDetails: enrichedRooms
    });
    
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to generate dashboard data' });
  }
});

module.exports = router;