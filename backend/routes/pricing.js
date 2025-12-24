/**
 * Advanced Pricing Analysis Route
 * Demonstrates all new pricing modules working together
 */

const express = require('express');
const router = express.Router();
const dataLoader = require('../services/dataLoader');
const competitorAnalysis = require('../pricing/competitorAnalysis');
const demandForecast = require('../pricing/demandForecast');
const riskAssessment = require('../pricing/riskAssessment');
const businessRules = require('../pricing/businessRules');
const pricingEngine = require('../pricing/pricingEngine');

/**
 * GET /api/pricing/analysis/:roomType - Comprehensive pricing analysis for a room type
 */
router.get('/analysis/:roomType', async (req, res) => {
  try {
    const { roomType } = req.params;
    
    const rooms = dataLoader.rooms;
    const reservations = dataLoader.reservations;
    const competitors = dataLoader.competitors;
    
    // Find the specific room
    const room = rooms.find(r => 
      (r.room_type || r['Room Type']).toLowerCase().includes(roomType.toLowerCase())
    );
    
    if (!room) {
      return res.status(404).json({ error: `Room type "${roomType}" not found` });
    }
    
    // 1. Competitor Analysis
    const compAnalysis = competitorAnalysis.analyzeCompetitors(room, competitors, rooms);
    
    // 2. Demand Forecast
    const forecast = demandForecast.forecastOccupancy(reservations, rooms, 7);
    const demandPricing = demandForecast.getDemandBasedPricing(room, forecast, competitors);
    
    // 3. Risk Assessment
    const suggestedPrice = demandPricing.suggestedPrice;
    const risk = riskAssessment.assessPriceChangeRisk(room, suggestedPrice, forecast, competitors);
    
    // 4. Business Rules Validation
    const basePrice = room.base_price || room['Base Price'];
    const validation = businessRules.validatePriceChange(room, suggestedPrice, {
      competitorAvg: compAnalysis.marketAvg,
      currentOccupancy: forecast.currentOccupancy
    });
    
    // 5. Scenario Comparison
    const scenarios = [
      { name: 'Conservative (-5%)', price: basePrice * 0.95 },
      { name: 'Current', price: basePrice },
      { name: 'Moderate (+5%)', price: basePrice * 1.05 },
      { name: 'Aggressive (+10%)', price: basePrice * 1.10 },
      { name: 'AI Recommended', price: validation.finalPrice }
    ];
    const scenarioComparison = riskAssessment.compareScenarios(room, scenarios, forecast, competitors);
    
    res.json({
      roomType: room.room_type || room['Room Type'],
      currentPrice: basePrice,
      analysis: {
        competitor: compAnalysis,
        demand: {
          forecast: forecast.forecasts.slice(0, 3),
          trend: forecast.trend,
          pricing: demandPricing
        },
        risk: risk,
        validation: validation,
        scenarios: scenarioComparison
      },
      recommendation: {
        suggestedPrice: validation.finalPrice,
        confidence: risk.riskLevel === 'low' ? 'high' : risk.riskLevel === 'medium' ? 'medium' : 'low',
        reasoning: [
          compAnalysis.recommendation,
          demandPricing.reasoning,
          risk.recommendation,
          validation.recommendation
        ]
      }
    });
  } catch (err) {
    console.error('Pricing analysis error:', err);
    res.status(500).json({ error: 'Analysis failed', details: err.message });
  }
});

/**
 * GET /api/pricing/forecast - Get occupancy and demand forecast
 */
router.get('/forecast', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    
    const rooms = dataLoader.rooms;
    const reservations = dataLoader.reservations;
    
    const forecast = demandForecast.forecastOccupancy(reservations, rooms, days);
    
    res.json({
      currentOccupancy: (forecast.currentOccupancy * 100).toFixed(1) + '%',
      trend: forecast.trend,
      forecasts: forecast.forecasts
    });
  } catch (err) {
    console.error('Forecast error:', err);
    res.status(500).json({ error: 'Forecast failed', details: err.message });
  }
});

/**
 * GET /api/pricing/market-position - Get market positioning for all rooms
 */
router.get('/market-position', async (req, res) => {
  try {
    const rooms = dataLoader.rooms;
    const competitors = dataLoader.competitors;
    
    const positions = rooms.map(room => {
      const analysis = competitorAnalysis.analyzeCompetitors(room, competitors, rooms);
      return {
        roomType: room.room_type || room['Room Type'],
        currentPrice: room.base_price || room['Base Price'],
        position: analysis.position,
        marketAvg: analysis.marketAvg,
        priceGap: analysis.priceGapPct.toFixed(1) + '%',
        recommendation: analysis.recommendation
      };
    });
    
    const marketShare = competitorAnalysis.estimateMarketShare(rooms, competitors);
    
    res.json({
      positions,
      marketShare
    });
  } catch (err) {
    console.error('Market position error:', err);
    res.status(500).json({ error: 'Analysis failed', details: err.message });
  }
});

/**
 * POST /api/pricing/validate - Validate a proposed price change
 */
router.post('/validate', async (req, res) => {
  try {
    const { roomType, newPrice } = req.body;
    
    if (!roomType || !newPrice) {
      return res.status(400).json({ error: 'Missing roomType or newPrice' });
    }
    
    const rooms = dataLoader.rooms;
    const competitors = dataLoader.competitors;
    const reservations = dataLoader.reservations;
    
    const room = rooms.find(r => 
      (r.room_type || r['Room Type']).toLowerCase().includes(roomType.toLowerCase())
    );
    
    if (!room) {
      return res.status(404).json({ error: `Room type "${roomType}" not found` });
    }
    
    const compAnalysis = competitorAnalysis.analyzeCompetitors(room, competitors, rooms);
    const forecast = demandForecast.forecastOccupancy(reservations, rooms, 7);
    
    const validation = businessRules.validatePriceChange(room, newPrice, {
      competitorAvg: compAnalysis.marketAvg,
      currentOccupancy: forecast.currentOccupancy
    });
    
    const risk = riskAssessment.assessPriceChangeRisk(room, validation.finalPrice, forecast, competitors);
    
    res.json({
      original: room.base_price || room['Base Price'],
      requested: newPrice,
      approved: validation.approved,
      final: validation.finalPrice,
      validation,
      risk
    });
  } catch (err) {
    console.error('Validation error:', err);
    res.status(500).json({ error: 'Validation failed', details: err.message });
  }
});

module.exports = router;
