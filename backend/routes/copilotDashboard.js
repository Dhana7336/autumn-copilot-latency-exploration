/**
 * Copilot Dashboard Route
 * Handles dashboard data, metrics, and room information
 */

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

const dataLoader = require('../services/dataLoader');
const { generatePricingRecommendation } = require('../pricing/competitorPricing');
const { calculateOccupancy, calculateRevenue, estimateRevenueImpact } = require('../utils/revenueCalculations');

const AUDIT_PATH = path.resolve(__dirname, '../data/audit.json');

router.get('/', async (req, res) => {
  try {
    const roomsData = dataLoader.rooms || [];
    const competitors = dataLoader.competitors || [];
    const reservations = dataLoader.reservations || [];

    // Enrich rooms
    const enrichedRooms = roomsData.map(room => {
      const type = room.room_type || room['Room Type'] || 'Unknown';
      const basePrice = parseFloat(room.base_price || room['Base Price'] || 150);
      const totalRooms = parseInt(room.total_rooms || room['Total Rooms'] || 10);

      const occupancyData = calculateOccupancy(reservations, type, totalRooms);

      const roomForPricing = {
        room_type: type,
        base_price: basePrice,
        total_rooms: totalRooms,
        floor_price: basePrice * 0.75,
        ceiling_price: basePrice * 1.35
      };
      const pricingRec = generatePricingRecommendation(roomForPricing, competitors, reservations, {});

      return {
        id: (type || 'unknown').toLowerCase().replace(/\s+/g, '-'),
        name: type,
        currentPrice: basePrice,
        occupancy: occupancyData.rate,
        occupancyStatus: occupancyData.status,
        competitorAvg: pricingRec.competitor?.marketAverage || basePrice,
        totalRooms,
        bookedRooms: occupancyData.bookedRooms,
        recommendation: pricingRec
      };
    });

    // Calculate metrics
    const totalRooms = enrichedRooms.reduce((sum, r) => sum + r.totalRooms, 0);
    const totalBooked = enrichedRooms.reduce((sum, r) => sum + r.bookedRooms, 0);
    const avgPrice = enrichedRooms.length > 0
      ? enrichedRooms.reduce((sum, r) => sum + r.currentPrice, 0) / enrichedRooms.length
      : 0;
    const occupancyRate = totalRooms > 0 ? totalBooked / totalRooms : 0;
    const revenueData = calculateRevenue(reservations);

    // Generate suggestions
    const suggestions = enrichedRooms
      .filter(room => room.recommendation.action !== 'maintain')
      .map(room => {
        const rec = room.recommendation;
        const impact = estimateRevenueImpact(room.currentPrice, rec.suggestedPrice, room.occupancy, room.totalRooms, 30);

        return {
          id: room.id,
          room: room.name,
          current: room.currentPrice,
          suggested: rec.suggestedPrice,
          change: rec.priceChange,
          occupancy: Math.round(room.occupancy * 100) + '%',
          competitorAvg: rec.competitorAvg,
          reasoning: rec.reasoning,
          impact: { revenueDelta: impact.revenueDelta, riskLevel: impact.riskLevel }
        };
      });

    // Load action config for effective prices
    const actions = require('../copilot/actions');
    const actionConfig = await actions.getActionConfig();
    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();

    const activeTemporaryOffers = (actionConfig.temporaryOffers || []).filter(offer => {
      const start = new Date(offer.startDate);
      const end = new Date(offer.endDate);
      return now >= start && now <= end;
    });

    const todayOverrides = (actionConfig.overrides || []).filter(o => o.date === todayStr);

    // Get recent adjustments (flash sales, promotions applied via applyMultiplePromotions)
    const recentAdjustments = (actionConfig.adjustments || []).filter(adj => {
      // Consider adjustments from last 24 hours as "active"
      const adjTime = new Date(adj.timestamp);
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      return adjTime >= dayAgo;
    });

    const getEffectivePrice = (roomName, basePrice) => {
      const roomId = roomName.toLowerCase().replace(/\s+/g, '');

      // Check overrides first (highest priority)
      const roomOverrides = todayOverrides.filter(o =>
        o.roomId === roomId ||
        o.mappedRoomType?.toLowerCase() === roomName.toLowerCase() ||
        o.roomId?.toLowerCase() === roomName.toLowerCase()
      );

      if (roomOverrides.length > 0) {
        const latest = roomOverrides.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
        return { price: latest.newPrice, isTemporary: latest.isTemporary || false, tempOfferId: latest.tempOfferId, reason: latest.reason };
      }

      // Check temporary offers
      for (const offer of activeTemporaryOffers) {
        const roomPricing = offer.roomPricing?.find(rp =>
          rp.roomType?.toLowerCase() === roomName.toLowerCase() ||
          rp.roomType?.toLowerCase().includes(roomName.toLowerCase())
        );
        if (roomPricing) {
          return { price: roomPricing.newPrice, isTemporary: true, tempOfferId: offer.tempOfferId, reason: offer.reason, startDate: offer.startDate, endDate: offer.endDate };
        }
      }

      // Check recent adjustments (flash sales, promotions)
      for (const adj of recentAdjustments) {
        if (adj.roomTypes && adj.roomTypes.some(rt => rt.toLowerCase() === roomName.toLowerCase())) {
          return {
            price: adj.newPrice || basePrice,
            isTemporary: true,
            reason: adj.promotionType?.replace(/_/g, ' ') || 'Promotion',
            percentage: adj.percentage
          };
        }
      }

      return { price: basePrice, isTemporary: false };
    };

    // Helper to parse duration hours from reason string
    const parseDurationHours = (reason, startDate, endDate) => {
      if (!reason) {
        // Fallback: calculate from dates
        if (startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          return Math.ceil((end - start) / (1000 * 60 * 60));
        }
        return 1;
      }

      // Match patterns like "3 hours", "4-hour", "5hours"
      const hourMatch = reason.match(/(\d+)[\s-]?hours?/i);
      if (hourMatch) return parseInt(hourMatch[1]);

      // Match day patterns
      const dayMatch = reason.match(/(\d+)[\s-]?days?/i);
      if (dayMatch) return parseInt(dayMatch[1]) * 24;

      // Match week patterns
      const weekMatch = reason.match(/(\d+)[\s-]?weeks?/i);
      if (weekMatch) return parseInt(weekMatch[1]) * 24 * 7;

      // Fallback: calculate from dates
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        return Math.ceil((end - start) / (1000 * 60 * 60));
      }

      return 1; // Default to 1 hour
    };

    // Load recent actions from audit log
    const auditLog = await fs.readFile(AUDIT_PATH, 'utf8').then(d => JSON.parse(d)).catch(() => []);
    const auditActions = auditLog.slice(-10).reverse().map(entry => {
      const tempOffer = (actionConfig.temporaryOffers || []).find(t =>
        entry.applied?.[0]?.data?.tempOfferId === t.tempOfferId ||
        (entry.intent === 'applyTemporaryPricing' && t.appliedAt && Math.abs(new Date(t.appliedAt) - new Date(entry.time)) < 60000)
      );

      // Calculate duration hours from reason or dates
      const reason = tempOffer?.reason || '';
      const durationHours = parseDurationHours(reason, tempOffer?.startDate, tempOffer?.endDate);

      return {
        time: entry.time,
        operator: entry.operatorName || entry.operator,
        operatorName: entry.operatorName,
        action: entry.intent,
        summary: entry.applied?.[0]?.message || entry.prompt || 'Action applied',
        isTemporary: entry.isTemporary || tempOffer !== undefined,
        roomType: tempOffer?.roomPricing?.[0]?.roomType || entry.approvals?.[0]?.parameters?.roomType,
        startDate: tempOffer?.startDate,
        endDate: tempOffer?.endDate,
        tempOfferId: tempOffer?.tempOfferId,
        reason: reason,
        durationHours: durationHours
      };
    });

    // Also include recent adjustments (flash sales, promotions from applyMultiplePromotions)
    const adjustmentActions = recentAdjustments.map(adj => ({
      time: adj.timestamp,
      operator: 'AI Copilot',
      operatorName: 'AI Copilot',
      action: adj.promotionType || 'priceAdjustment',
      summary: `${adj.promotionType?.replace(/_/g, ' ') || 'Promotion'}: ${adj.roomTypes?.join(', ')} $${adj.oldPrice} → $${adj.newPrice} (${adj.percentage >= 0 ? '+' : ''}${adj.percentage}%)`,
      isTemporary: true,
      roomType: adj.roomTypes?.[0],
      percentage: adj.percentage
    }));

    // Combine and sort by time, take last 10
    const recentActions = [...auditActions, ...adjustmentActions]
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, 10);

    // Build room details with effective prices
    const roomDetails = enrichedRooms.map(r => {
      const effectivePriceData = getEffectivePrice(r.name, r.currentPrice);
      // Calculate duration hours if we have dates
      let promoDurationHours = null;
      if (effectivePriceData.startDate && effectivePriceData.endDate) {
        const start = new Date(effectivePriceData.startDate);
        const end = new Date(effectivePriceData.endDate);
        promoDurationHours = Math.ceil((end - start) / (1000 * 60 * 60));
      } else if (effectivePriceData.reason) {
        promoDurationHours = parseDurationHours(effectivePriceData.reason, null, null);
      }
      return {
        id: r.id,
        name: r.name,
        currentPrice: r.currentPrice,
        effectivePrice: effectivePriceData.price,
        isTemporary: effectivePriceData.isTemporary,
        tempOfferId: effectivePriceData.tempOfferId,
        promoReason: effectivePriceData.reason,
        promoStartDate: effectivePriceData.startDate,
        promoEndDate: effectivePriceData.endDate,
        promoDurationHours: promoDurationHours,
        occupancy: Math.round(r.occupancy * 100),
        occupancyStatus: r.occupancyStatus,
        competitorAvg: r.competitorAvg,
        totalRooms: r.totalRooms,
        bookedRooms: r.bookedRooms,
        floorPrice: Math.round(r.currentPrice * 0.75),
        ceilingPrice: Math.round(r.currentPrice * 1.35)
      };
    });

    res.json({
      ok: true,
      metrics: {
        avgDailyRate: Math.round(avgPrice),
        occupancy: Math.round(occupancyRate * 100),
        revPAR: Math.round(avgPrice * occupancyRate),
        totalRooms,
        totalBooked,
        totalRevenue: revenueData.totalRevenue,
        bookingCount: revenueData.bookingCount
      },
      suggestions,
      rooms: enrichedRooms.map(r => ({
        id: r.id,
        name: r.name,
        currentPrice: r.currentPrice,
        occupancy: r.occupancy,
        occupancyStatus: r.occupancyStatus,
        competitorAvg: r.competitorAvg,
        totalRooms: r.totalRooms,
        bookedRooms: r.bookedRooms
      })),
      roomDetails,
      recentActions
    });

  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to load dashboard', details: err.message });
  }
});

module.exports = router;
