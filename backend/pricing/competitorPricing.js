/**
 * Competitor-Based Pricing Engine
 *
 * Calculates optimal prices based on:
 * 1. Competitor weights (importance of each competitor)
 * 2. Competitor differentials (how much above/below each competitor)
 * 3. Current occupancy and demand signals
 */

/**
 * Default competitor configuration
 * Hotels can customize weights and differentials
 */
const DEFAULT_CONFIG = {
  weights: {
    // Sum should equal 1.0
    'Hilton': 0.40,
    'Marriott': 0.30,
    'Hampton Inn': 0.20,
    'Independent': 0.10
  },
  differentials: {
    // Positive = price above, Negative = price below
    'Hilton': -15,       // $15 below Hilton (budget positioning)
    'Marriott': -5,      // $5 below Marriott
    'Hampton Inn': 10,   // $10 above Hampton Inn (premium vs budget)
    'Independent': 20    // $20 above independent hotels
  }
};

/**
 * Calculate weighted competitor price for a room type
 * @param {Array} competitors - Competitor pricing data
 * @param {string} roomType - Room type to calculate for
 * @param {object} config - Custom weights and differentials
 * @returns {object} Pricing calculation details
 */
function calculateWeightedCompetitorPrice(competitors, roomType, config = {}) {
  const weights = { ...DEFAULT_CONFIG.weights, ...config.weights };
  const differentials = { ...DEFAULT_CONFIG.differentials, ...config.differentials };

  // Ensure competitors is an array
  const competitorList = Array.isArray(competitors) ? competitors : [];

  // Filter competitors for this room type
  const matchingCompetitors = competitorList.filter(c => {
    const compRoomType = c.room_type || c['Room Type'] || '';
    return compRoomType.toLowerCase().includes(roomType.toLowerCase()) ||
           roomType.toLowerCase().includes(compRoomType.toLowerCase());
  });

  if (matchingCompetitors.length === 0) {
    return {
      success: false,
      message: `No competitor data found for room type: ${roomType}`,
      suggestedPrice: null
    };
  }

  // Calculate weighted average with differentials
  let totalWeight = 0;
  let weightedSum = 0;
  const breakdown = [];

  matchingCompetitors.forEach(comp => {
    const compName = comp.competitor_name || comp['Competitor Name'] || 'Unknown';
    const compPrice = parseFloat(comp.avg_price || comp['Avg Price'] || 0);

    // Find best matching weight key
    let weight = 0.1; // Default weight for unknown competitors
    let differential = 0;

    for (const [key, w] of Object.entries(weights)) {
      if (compName.toLowerCase().includes(key.toLowerCase()) ||
          key.toLowerCase().includes(compName.split(' ')[0].toLowerCase())) {
        weight = w;
        differential = differentials[key] || 0;
        break;
      }
    }

    const adjustedPrice = compPrice + differential;
    const contribution = adjustedPrice * weight;

    weightedSum += contribution;
    totalWeight += weight;

    breakdown.push({
      competitor: compName,
      basePrice: compPrice,
      weight: Math.round(weight * 100),
      differential,
      adjustedPrice: Math.round(adjustedPrice),
      contribution: Math.round(contribution)
    });
  });

  // Normalize if weights don't sum to 1
  const suggestedPrice = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null;

  // Calculate market position
  const avgCompetitorPrice = matchingCompetitors.reduce((sum, c) =>
    sum + parseFloat(c.avg_price || c['Avg Price'] || 0), 0) / matchingCompetitors.length;

  const marketPosition = suggestedPrice
    ? ((suggestedPrice - avgCompetitorPrice) / avgCompetitorPrice * 100).toFixed(1)
    : 0;

  return {
    success: true,
    suggestedPrice,
    marketAverage: Math.round(avgCompetitorPrice),
    marketPosition: `${marketPosition > 0 ? '+' : ''}${marketPosition}%`,
    breakdown,
    competitorCount: matchingCompetitors.length,
    totalWeight: Math.round(totalWeight * 100)
  };
}

/**
 * Calculate optimal price considering occupancy
 * @param {number} competitorPrice - Weighted competitor price
 * @param {number} occupancyRate - Current occupancy (0-1)
 * @param {number} floor - Minimum price
 * @param {number} ceiling - Maximum price
 * @returns {object} Final price recommendation
 */
function applyOccupancyAdjustment(competitorPrice, occupancyRate, floor = 0, ceiling = Infinity) {
  let adjustment = 0;
  let reason = '';

  // High occupancy (>80%) - can command premium
  if (occupancyRate > 0.80) {
    adjustment = 0.08; // +8%
    reason = 'High demand allows premium pricing';
  }
  // Very high occupancy (>90%) - strong premium
  else if (occupancyRate > 0.90) {
    adjustment = 0.15; // +15%
    reason = 'Very high demand - maximize revenue';
  }
  // Low occupancy (<40%) - need to stimulate demand
  else if (occupancyRate < 0.40) {
    adjustment = -0.10; // -10%
    reason = 'Low occupancy - stimulate demand';
  }
  // Very low occupancy (<25%) - aggressive pricing
  else if (occupancyRate < 0.25) {
    adjustment = -0.15; // -15%
    reason = 'Critical low occupancy - aggressive pricing needed';
  }
  // Normal occupancy - slight adjustment
  else if (occupancyRate < 0.60) {
    adjustment = -0.03; // -3%
    reason = 'Below target occupancy - slight reduction';
  }

  const adjustedPrice = Math.round(competitorPrice * (1 + adjustment));
  const finalPrice = Math.max(floor, Math.min(ceiling, adjustedPrice));

  return {
    basePrice: competitorPrice,
    occupancyAdjustment: `${adjustment >= 0 ? '+' : ''}${(adjustment * 100).toFixed(0)}%`,
    adjustedPrice,
    finalPrice,
    reason,
    clampApplied: finalPrice !== adjustedPrice
  };
}

/**
 * Generate complete pricing recommendation
 * @param {object} room - Room data
 * @param {Array} competitors - Competitor data
 * @param {Array} reservations - Reservation data for occupancy
 * @param {object} config - Custom configuration
 * @returns {object} Complete pricing recommendation
 */
function generatePricingRecommendation(room, competitors, reservations, config = {}) {
  const roomType = room.room_type || room['Room Type'];
  const currentPrice = parseFloat(room.base_price || room['Base Price'] || 150);
  const totalRooms = parseInt(room.total_rooms || room['Total Rooms'] || 10);
  const floor = parseFloat(room.floor_price || room['Floor Price'] || currentPrice * 0.75);
  const ceiling = parseFloat(room.ceiling_price || room['Ceiling Price'] || currentPrice * 1.35);

  // Calculate occupancy
  const todayStr = new Date().toISOString().split('T')[0];
  const bookedRooms = reservations.filter(r => {
    const resType = (r.room_type || r['Room Type'] || '').split('(')[0].trim();
    if (!resType || !roomType) return false;
    if (!resType.toLowerCase().includes(roomType.toLowerCase()) &&
        !roomType.toLowerCase().includes(resType.toLowerCase())) return false;
    const status = (r.Status || r.status || '').toLowerCase();
    if (status !== 'confirmed' && status !== 'in-house') return false;
    const checkIn = r.check_in_date || r['Check In Date'];
    const checkOut = r.check_out_date || r['Check Out Date'];
    return checkIn <= todayStr && checkOut > todayStr;
  }).length;

  const occupancyRate = totalRooms > 0 ? bookedRooms / totalRooms : 0;

  // Step 1: Calculate weighted competitor price
  const competitorCalc = calculateWeightedCompetitorPrice(competitors, roomType, config);

  if (!competitorCalc.success) {
    return {
      success: false,
      roomType,
      message: competitorCalc.message,
      currentPrice,
      suggestedPrice: currentPrice,
      action: 'maintain'
    };
  }

  // Step 2: Apply occupancy adjustment
  const finalCalc = applyOccupancyAdjustment(
    competitorCalc.suggestedPrice,
    occupancyRate,
    floor,
    ceiling
  );

  // Step 3: Determine action
  const priceDiff = finalCalc.finalPrice - currentPrice;
  const priceDiffPct = (priceDiff / currentPrice) * 100;

  let action = 'maintain';
  if (priceDiffPct > 3) action = 'increase';
  else if (priceDiffPct < -3) action = 'decrease';

  return {
    success: true,
    roomType,
    currentPrice: Math.round(currentPrice),
    suggestedPrice: finalCalc.finalPrice,
    priceDifference: Math.round(priceDiff),
    priceDifferencePct: `${priceDiffPct > 0 ? '+' : ''}${priceDiffPct.toFixed(1)}%`,
    action,
    occupancy: {
      rate: Math.round(occupancyRate * 100),
      bookedRooms,
      totalRooms,
      status: occupancyRate > 0.7 ? 'high' : occupancyRate > 0.4 ? 'normal' : 'low'
    },
    competitor: {
      weightedPrice: competitorCalc.suggestedPrice,
      marketAverage: competitorCalc.marketAverage,
      marketPosition: competitorCalc.marketPosition,
      breakdown: competitorCalc.breakdown
    },
    occupancyAdjustment: {
      adjustment: finalCalc.occupancyAdjustment,
      reason: finalCalc.reason
    },
    constraints: {
      floor: Math.round(floor),
      ceiling: Math.round(ceiling),
      clampApplied: finalCalc.clampApplied
    }
  };
}

/**
 * Update competitor weight in configuration
 */
function updateCompetitorWeight(config, competitorName, newWeight) {
  const weights = { ...(config.weights || DEFAULT_CONFIG.weights) };
  weights[competitorName] = Math.max(0, Math.min(1, newWeight));

  // Normalize weights to sum to 1
  const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
  if (total > 0) {
    Object.keys(weights).forEach(key => {
      weights[key] = weights[key] / total;
    });
  }

  return { ...config, weights };
}

/**
 * Update competitor differential in configuration
 */
function updateCompetitorDifferential(config, competitorName, newDifferential) {
  const differentials = { ...(config.differentials || DEFAULT_CONFIG.differentials) };
  differentials[competitorName] = newDifferential;
  return { ...config, differentials };
}

module.exports = {
  DEFAULT_CONFIG,
  calculateWeightedCompetitorPrice,
  applyOccupancyAdjustment,
  generatePricingRecommendation,
  updateCompetitorWeight,
  updateCompetitorDifferential
};
