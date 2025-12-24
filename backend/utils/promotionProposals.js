/**
 * Multi-Promotion Proposal Builder
 * Handles bulk promotion suggestions and impact analysis
 */

const { calculateOccupancy, calculateCompetitorAverage, estimateRevenueImpact } = require('./revenueCalculations');

/**
 * Build multiple promotional proposals for all rooms
 * STEP 1: Shows offers WITHOUT Apply button
 */
function buildMultiplePromotionProposals(context = {}) {
  const { rooms = [], competitors = [], reservations = [] } = context;
  const proposals = [];

  rooms.forEach(room => {
    const roomType = room.room_type || room['Room Type'];
    const currentPrice = parseFloat(room.base_price || room['Base Price'] || 150);
    const totalRooms = parseInt(room.total_rooms || room['Total Rooms'] || 10);

    const occupancy = calculateOccupancy(reservations, roomType, totalRooms);
    const competitorData = calculateCompetitorAverage(competitors, roomType);
    const competitorAvg = competitorData.average || currentPrice;

    let promotionType = null;
    let newPrice = currentPrice;
    let reason = '';
    let description = '';

    // Low occupancy -> Flash sale
    if (occupancy.percentage < 40) {
      const discount = occupancy.percentage < 25 ? 15 : 10;
      newPrice = Math.round(currentPrice * (1 - discount / 100));
      promotionType = 'flash_sale';
      reason = `Low occupancy (${occupancy.percentage}%) - ${discount}% flash sale to boost bookings`;
      description = `Flash Sale: ${roomType} $${currentPrice} → $${newPrice} (${discount}% off)`;
    }
    // Below competitor -> Price increase
    else if (currentPrice < competitorAvg * 0.9) {
      const increasePercent = Math.min(10, Math.round((competitorAvg - currentPrice) / currentPrice * 100));
      newPrice = Math.round(currentPrice * (1 + increasePercent / 100));
      promotionType = 'price_optimization';
      reason = `Below market by $${Math.round(competitorAvg - currentPrice)} - opportunity to increase revenue`;
      description = `Price Optimization: ${roomType} $${currentPrice} → $${newPrice} (+${increasePercent}%)`;
    }
    // High occupancy -> Surge pricing
    else if (occupancy.percentage > 70) {
      const surgePercent = occupancy.percentage > 85 ? 15 : 10;
      newPrice = Math.round(currentPrice * (1 + surgePercent / 100));
      promotionType = 'surge_pricing';
      reason = `High demand (${occupancy.percentage}% occupancy) - surge pricing opportunity`;
      description = `Surge Pricing: ${roomType} $${currentPrice} → $${newPrice} (+${surgePercent}%)`;
    }
    // Moderate -> Weekend boost
    else {
      newPrice = Math.round(currentPrice * 1.05);
      promotionType = 'weekend_boost';
      reason = `Stable occupancy (${occupancy.percentage}%) - weekend rate boost`;
      description = `Weekend Boost: ${roomType} $${currentPrice} → $${newPrice} (+5%)`;
    }

    const impact = estimateRevenueImpact(currentPrice, newPrice, occupancy.rate, totalRooms, 30);

    proposals.push({
      roomType, promotionType, currentPrice, newPrice,
      percentage: Math.round((newPrice - currentPrice) / currentPrice * 100),
      description, reason,
      occupancy: occupancy.percentage, competitorAvg,
      revenueImpact: impact.revenueDelta,
      revenueImpactPct: impact.revenueDeltaPct,
      riskLevel: impact.riskLevel, totalRooms
    });
  });

  proposals.sort((a, b) => Math.abs(b.revenueImpact) - Math.abs(a.revenueImpact));
  const totalRevenueImpact = proposals.reduce((sum, p) => sum + p.revenueImpact, 0);

  return {
    actionName: 'applyMultiplePromotions',
    parameters: {
      promotions: proposals.map(p => ({
        roomType: p.roomType, currentPrice: p.currentPrice,
        newPrice: p.newPrice, percentage: p.percentage, promotionType: p.promotionType
      })),
      applyAll: true
    },
    description: `Apply ${proposals.length} promotional strategies across all room types`,
    reasoning: `Based on current occupancy and competitor analysis, I recommend the following promotions for maximum revenue impact.`,
    proposals, totalRevenueImpact, confidence: 0.85,
    requiresApproval: false,
    needsImpactAnalysis: true,
    promptForImpact: 'Would you like to see the estimated revenue impact, Occupancy Impact, RevPAR Impact and Risk Assessment for these promotions before applying?'
  };
}

/**
 * Build detailed impact analysis for all promotions
 * STEP 2: Shows full impact analysis with Apply button
 */
function buildPromotionImpactAnalysis(context = {}) {
  const { rooms = [], competitors = [], reservations = [] } = context;
  const proposals = [];

  rooms.forEach(room => {
    const roomType = room.room_type || room['Room Type'];
    const currentPrice = parseFloat(room.base_price || room['Base Price'] || 150);
    const totalRooms = parseInt(room.total_rooms || room['Total Rooms'] || 10);

    const occupancy = calculateOccupancy(reservations, roomType, totalRooms);
    const competitorData = calculateCompetitorAverage(competitors, roomType);
    const competitorAvg = competitorData.average || currentPrice;

    let promotionType = null;
    let newPrice = currentPrice;
    let reason = '';

    if (occupancy.percentage < 40) {
      const discount = occupancy.percentage < 25 ? 15 : 10;
      newPrice = Math.round(currentPrice * (1 - discount / 100));
      promotionType = 'flash_sale';
      reason = `Low occupancy (${occupancy.percentage}%) - ${discount}% flash sale`;
    } else if (currentPrice < competitorAvg * 0.9) {
      const increasePercent = Math.min(10, Math.round((competitorAvg - currentPrice) / currentPrice * 100));
      newPrice = Math.round(currentPrice * (1 + increasePercent / 100));
      promotionType = 'price_optimization';
      reason = `Below market by $${Math.round(competitorAvg - currentPrice)}`;
    } else if (occupancy.percentage > 70) {
      const surgePercent = occupancy.percentage > 85 ? 15 : 10;
      newPrice = Math.round(currentPrice * (1 + surgePercent / 100));
      promotionType = 'surge_pricing';
      reason = `High demand (${occupancy.percentage}% occupancy)`;
    } else {
      newPrice = Math.round(currentPrice * 1.05);
      promotionType = 'weekend_boost';
      reason = `Stable occupancy (${occupancy.percentage}%)`;
    }

    const impact = estimateRevenueImpact(currentPrice, newPrice, occupancy.rate, totalRooms, 30);

    // Price elasticity
    const priceChange = (newPrice - currentPrice) / currentPrice;
    const elasticity = -1.5;
    const occupancyChangePercent = priceChange * elasticity * 100;
    const projectedOccupancy = Math.min(100, Math.max(0, occupancy.percentage + occupancyChangePercent));

    const projectedDailyRevenue = newPrice * (projectedOccupancy / 100) * totalRooms;
    const projectedRevenue30Days = projectedDailyRevenue * 30;

    const currentRevPARRoom = currentPrice * occupancy.rate;
    const projectedRevPARRoom = newPrice * (projectedOccupancy / 100);
    const revPARChange = projectedRevPARRoom - currentRevPARRoom;
    const revPARChangePct = currentRevPARRoom > 0
      ? ((projectedRevPARRoom - currentRevPARRoom) / currentRevPARRoom * 100).toFixed(1)
      : projectedRevPARRoom > 0 ? '+100' : '0';

    // Risk assessment
    let riskLevel = 'low';
    let riskFactors = [];

    if (Math.abs(priceChange) > 0.15) {
      riskLevel = 'high';
      riskFactors.push('Large price change (>15%) may significantly impact demand');
    } else if (Math.abs(priceChange) > 0.10) {
      riskLevel = 'medium';
      riskFactors.push('Moderate price change (10-15%) may affect bookings');
    }

    if (promotionType === 'flash_sale' && occupancy.percentage > 30) {
      riskFactors.push('Discount on room with moderate occupancy may reduce profit margins');
    }

    if (promotionType === 'surge_pricing' && currentPrice > competitorAvg) {
      riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
      riskFactors.push('Price already above competitors - surge may reduce competitiveness');
    }

    if (riskFactors.length === 0) {
      riskFactors.push('Standard market adjustment with minimal risk');
    }

    proposals.push({
      roomType, promotionType, currentPrice, newPrice,
      percentage: Math.round((newPrice - currentPrice) / currentPrice * 100),
      reason,
      currentOccupancy: occupancy.percentage,
      projectedOccupancy: Math.round(projectedOccupancy),
      occupancyChange: Math.round(occupancyChangePercent),
      currentRevenue30Days: Math.round(currentPrice * occupancy.rate * totalRooms * 30),
      projectedRevenue30Days: Math.round(projectedRevenue30Days),
      revenueImpact: Math.round(impact.revenueDelta),
      revenueImpactPct: impact.revenueDeltaPct,
      currentRevPAR: Math.round(currentRevPARRoom),
      projectedRevPAR: Math.round(projectedRevPARRoom),
      revPARChange: Math.round(revPARChange),
      revPARChangePct,
      riskLevel, riskFactors, competitorAvg, totalRooms
    });
  });

  proposals.sort((a, b) => Math.abs(b.revenueImpact) - Math.abs(a.revenueImpact));

  const totalCurrentRevenue = proposals.reduce((sum, p) => sum + p.currentRevenue30Days, 0);
  const totalProjectedRevenue = proposals.reduce((sum, p) => sum + p.projectedRevenue30Days, 0);
  const totalRevenueImpact = totalProjectedRevenue - totalCurrentRevenue;
  const totalRevenueImpactPct = totalCurrentRevenue > 0
    ? ((totalRevenueImpact / totalCurrentRevenue) * 100).toFixed(1)
    : totalProjectedRevenue > 0 ? '+100' : '0';
  const avgOccupancyChange = proposals.reduce((sum, p) => sum + p.occupancyChange, 0) / proposals.length;
  const avgRevPARChange = proposals.reduce((sum, p) => sum + p.revPARChange, 0) / proposals.length;

  const highRiskCount = proposals.filter(p => p.riskLevel === 'high').length;
  const mediumRiskCount = proposals.filter(p => p.riskLevel === 'medium').length;
  let overallRisk = 'low';
  if (highRiskCount >= 2) overallRisk = 'high';
  else if (highRiskCount >= 1 || mediumRiskCount >= 2) overallRisk = 'medium';

  return {
    actionName: 'applyMultiplePromotions',
    parameters: {
      promotions: proposals.map(p => ({
        roomType: p.roomType, currentPrice: p.currentPrice,
        newPrice: p.newPrice, percentage: p.percentage, promotionType: p.promotionType
      })),
      applyAll: true
    },
    description: `Detailed Impact Analysis for ${proposals.length} promotions`,
    proposals,
    summary: {
      totalCurrentRevenue, totalProjectedRevenue, totalRevenueImpact, totalRevenueImpactPct,
      avgOccupancyChange: Math.round(avgOccupancyChange),
      avgRevPARChange: Math.round(avgRevPARChange),
      overallRisk, roomsAffected: proposals.length
    },
    confidence: 0.85,
    requiresApproval: true,
    isImpactAnalysis: true
  };
}

module.exports = {
  buildMultiplePromotionProposals,
  buildPromotionImpactAnalysis
};
