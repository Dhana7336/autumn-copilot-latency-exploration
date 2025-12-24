const PRICING_CONFIG = {
  basePrice: 150,
  rateFloor: 140,
  rateCeiling: 220,
  competitors: {
    'Hilton Pensacola Beach': { weight: 0.40, differential: -0.05 },
    'Margaritaville Beach Hotel': { weight: 0.30, differential: 0.00 },
    'Hampton Inn Pensacola': { weight: 0.30, differential: 0.05 }
  },

  // Occupancy adjustment rules
  occupancyRules: [
    { maxOccupancy: 0.40, adjustment: -0.125 },  // < 40% → -10% to -15% (avg -12.5%)
    { maxOccupancy: 0.70, adjustment: 0.00 },     // 40-70% → no adjustment
    { maxOccupancy: 1.00, adjustment: 0.15 }      // > 70% → +10% to +20% (avg +15%)
  ],

  // Competitor adjustment rules
  competitorRules: {
    higherThreshold: 0.10,  // If competitors 10%+ higher
    higherAdjustment: 0.05, // Raise our price +5%
    lowerThreshold: -0.10,  // If competitors 10%+ lower
    lowerAdjustment: -0.05  // Lower our price -5%
  },

  // Day of week adjustments
  dayOfWeekRules: {
    weekend: { days: [5, 6], adjustment: 0.15 },        // Friday, Saturday +15%
    weekday: { days: [0, 1, 2, 3, 4], adjustment: 0 },  // Sun-Thu no adjustment
    underperformingDays: ['Tuesday', 'Wednesday']
  },

  // Holiday premiums
  holidayPremiums: {
    major: 0.25,      
    longWeekend: 0.15, 
    localEvent: 0.20  
  }
};


function calculateCompetitorAdjustment(competitorAvg, basePrice) {
  if (!competitorAvg || competitorAvg === 0) return 1.0;

  const marketDiff = (competitorAvg - basePrice) / basePrice;
  const rules = PRICING_CONFIG.competitorRules;

  if (marketDiff >= rules.higherThreshold) {
    
    return 1 + rules.higherAdjustment;
  } else if (marketDiff <= rules.lowerThreshold) {
    return 1 + rules.lowerAdjustment;
  }
  return 1.0;
}

function calculateOccupancyAdjustment(occupancyRate) {
  const rules = PRICING_CONFIG.occupancyRules;

  if (occupancyRate < 0.40) {
    // Low occupancy - stimulate demand with discount
    return 1 + rules[0].adjustment; // -12.5%
  } else if (occupancyRate <= 0.70) {
    // Moderate occupancy - keep near base price
    return 1.0;
  } else {
    // High occupancy - scarcity pricing
    return 1 + rules[2].adjustment; // +15%
  }
}

function calculateDayOfWeekAdjustment(date) {
  const d = date instanceof Date ? date : new Date(date);
  const dayOfWeek = d.getDay();

  // Weekend premium (Friday=5, Saturday=6)
  if (dayOfWeek === 5 || dayOfWeek === 6) {
    return 1 + PRICING_CONFIG.dayOfWeekRules.weekend.adjustment;
  }

  return 1.0;
}

/**
 * Check if date is a holiday and return premium
 */
function getHolidayAdjustment(date) {
  const d = date instanceof Date ? date : new Date(date);
  const dateStr = d.toISOString().split('T')[0];

  // Pensacola holidays and events
  const holidays = {
    // Major holidays (+25%)
    '2025-01-01': { name: "New Year's Day", premium: PRICING_CONFIG.holidayPremiums.major },
    '2025-11-27': { name: 'Thanksgiving', premium: PRICING_CONFIG.holidayPremiums.major },
    '2025-12-24': { name: 'Christmas Eve', premium: PRICING_CONFIG.holidayPremiums.major },
    '2025-12-25': { name: 'Christmas Day', premium: PRICING_CONFIG.holidayPremiums.major },
    '2025-12-31': { name: "New Year's Eve", premium: PRICING_CONFIG.holidayPremiums.major },

    // Long weekends (+15%)
    '2025-01-20': { name: 'MLK Day', premium: PRICING_CONFIG.holidayPremiums.longWeekend },
    '2025-02-17': { name: "Presidents' Day", premium: PRICING_CONFIG.holidayPremiums.longWeekend },
    '2025-05-26': { name: 'Memorial Day', premium: PRICING_CONFIG.holidayPremiums.longWeekend },
    '2025-07-04': { name: 'Independence Day', premium: PRICING_CONFIG.holidayPremiums.major },
    '2025-09-01': { name: 'Labor Day', premium: PRICING_CONFIG.holidayPremiums.longWeekend },
    '2025-11-28': { name: 'Black Friday', premium: PRICING_CONFIG.holidayPremiums.longWeekend },

    // Pensacola local events (+20%)
    '2025-02-21': { name: 'Pensacon', premium: PRICING_CONFIG.holidayPremiums.localEvent },
    '2025-02-22': { name: 'Pensacon', premium: PRICING_CONFIG.holidayPremiums.localEvent },
    '2025-02-23': { name: 'Pensacon', premium: PRICING_CONFIG.holidayPremiums.localEvent },
    '2025-05-23': { name: 'Pensacola Crawfish Festival', premium: PRICING_CONFIG.holidayPremiums.localEvent },
    '2025-10-17': { name: 'Pensacola Seafood Festival', premium: PRICING_CONFIG.holidayPremiums.localEvent },
    '2025-11-07': { name: 'Blue Angels Homecoming Airshow', premium: PRICING_CONFIG.holidayPremiums.localEvent },
    '2025-02-14': { name: "Valentine's Day", premium: PRICING_CONFIG.holidayPremiums.longWeekend }
  };

  const holiday = holidays[dateStr];
  if (holiday) {
    return { adjustment: 1 + holiday.premium, name: holiday.name };
  }

  return { adjustment: 1.0, name: null };
}
function calculateDynamicPrice(options = {}) {
  const {
    basePrice = PRICING_CONFIG.basePrice,
    competitorAvg = 175,
    occupancyRate = 0.64,
    targetDate = new Date(),
    roomType = 'Standard'
  } = options;

  // Step 1: Start with base price
  let price = basePrice;
  const adjustments = [];

  // Step 2: Apply competitor adjustment
  const competitorAdj = calculateCompetitorAdjustment(competitorAvg, basePrice);
  price *= competitorAdj;
  if (competitorAdj !== 1.0) {
    adjustments.push({
      type: 'competitor',
      factor: competitorAdj,
      reason: competitorAdj > 1
        ? `Competitors ${((competitorAvg/basePrice - 1) * 100).toFixed(0)}% higher → +${((competitorAdj - 1) * 100).toFixed(0)}%`
        : `Competitors ${((1 - competitorAvg/basePrice) * 100).toFixed(0)}% lower → ${((competitorAdj - 1) * 100).toFixed(0)}%`
    });
  }

  // Step 3: Apply occupancy adjustment
  const occupancyAdj = calculateOccupancyAdjustment(occupancyRate);
  price *= occupancyAdj;
  if (occupancyAdj !== 1.0) {
    adjustments.push({
      type: 'occupancy',
      factor: occupancyAdj,
      reason: occupancyAdj > 1
        ? `High occupancy (${(occupancyRate * 100).toFixed(0)}%) → +${((occupancyAdj - 1) * 100).toFixed(0)}%`
        : `Low occupancy (${(occupancyRate * 100).toFixed(0)}%) → ${((occupancyAdj - 1) * 100).toFixed(0)}%`
    });
  }
  const dayAdj = calculateDayOfWeekAdjustment(targetDate);
  price *= dayAdj;
  if (dayAdj !== 1.0) {
    adjustments.push({
      type: 'weekend',
      factor: dayAdj,
      reason: `Weekend premium → +${((dayAdj - 1) * 100).toFixed(0)}%`
    });
  }

  // Step 5: Apply holiday adjustment
  const holidayInfo = getHolidayAdjustment(targetDate);
  price *= holidayInfo.adjustment;
  if (holidayInfo.adjustment !== 1.0) {
    adjustments.push({
      type: 'holiday',
      factor: holidayInfo.adjustment,
      reason: `${holidayInfo.name} → +${((holidayInfo.adjustment - 1) * 100).toFixed(0)}%`
    });
  }

  const originalPrice = price;
  price = Math.max(PRICING_CONFIG.rateFloor, Math.min(PRICING_CONFIG.rateCeiling, price));

  if (price !== originalPrice) {
    adjustments.push({
      type: 'constraint',
      factor: price / originalPrice,
      reason: price === PRICING_CONFIG.rateFloor
        ? `Applied rate floor ($${PRICING_CONFIG.rateFloor})`
        : `Applied rate ceiling ($${PRICING_CONFIG.rateCeiling})`
    });
  }

  // Round to nearest dollar
  price = Math.round(price);

  return {
    basePrice,
    finalPrice: price,
    adjustments,
    competitorAvg,
    occupancyRate: (occupancyRate * 100).toFixed(0) + '%',
    formula: 'final_price = base_price × competitor_adj × occupancy_adj × day_adj × holiday_adj',
    breakdown: {
      base: basePrice,
      afterCompetitor: Math.round(basePrice * competitorAdj),
      afterOccupancy: Math.round(basePrice * competitorAdj * occupancyAdj),
      afterDay: Math.round(basePrice * competitorAdj * occupancyAdj * dayAdj),
      final: price
    }
  };
}

/**
 * Apply hotel pricing business rules (legacy compatibility)
 */
function applyBusinessRules(room, suggestedPrice, context = {}) {
  const currentPrice = room.base_price || room['Base Price'] || room.currentPrice || PRICING_CONFIG.basePrice;
  const roomType = room.room_type || room['Room Type'] || room.name;

  const violations = [];
  let adjustedPrice = suggestedPrice;

  // Rule 1: Apply rate floor
  if (adjustedPrice < PRICING_CONFIG.rateFloor) {
    violations.push(`Price below rate floor of $${PRICING_CONFIG.rateFloor}`);
    adjustedPrice = PRICING_CONFIG.rateFloor;
  }
  if (adjustedPrice > PRICING_CONFIG.rateCeiling) {
    violations.push(`Price above rate ceiling of $${PRICING_CONFIG.rateCeiling}`);
    adjustedPrice = PRICING_CONFIG.rateCeiling;
  }

  // Rule 3: Maximum single price change (prevent shock) - 20% limit
  const maxChangePercent = 20;
  const changePercent = Math.abs((adjustedPrice - currentPrice) / currentPrice * 100);
  if (changePercent > maxChangePercent) {
    violations.push(`Price change ${changePercent.toFixed(0)}% exceeds ${maxChangePercent}% limit`);
    if (adjustedPrice > currentPrice) {
      adjustedPrice = currentPrice * (1 + maxChangePercent / 100);
    } else {
      adjustedPrice = currentPrice * (1 - maxChangePercent / 100);
    }
  }

  // Rule 4: Weekend premium check
  const date = context.targetDate ? new Date(context.targetDate) : new Date();
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;

  if (isWeekend && context.weekdayPrice && adjustedPrice < context.weekdayPrice * 1.1) {
    violations.push(`Weekend price should be at least 10% above weekday rate`);
    adjustedPrice = Math.max(adjustedPrice, context.weekdayPrice * 1.1);
  }

  // Rule 5: Competitor parity check
  if (context.competitorAvg) {
    const marketDeviation = (adjustedPrice - context.competitorAvg) / context.competitorAvg * 100;
    if (marketDeviation < -30) {
      violations.push(`Price ${Math.abs(marketDeviation).toFixed(0)}% below market may undervalue property`);
    }
  }

  // Rule 6: Occupancy-based constraints
  if (context.currentOccupancy !== undefined) {
    if (context.currentOccupancy < 0.4 && adjustedPrice > currentPrice * 1.05) {
      violations.push(`Limited price increase with low occupancy (${(context.currentOccupancy * 100).toFixed(0)}%)`);
      adjustedPrice = Math.min(adjustedPrice, currentPrice * 1.05);
    }

    if (context.currentOccupancy > 0.85 && adjustedPrice < currentPrice * 0.95) {
      violations.push(`Cannot significantly decrease price with high occupancy (${(context.currentOccupancy * 100).toFixed(0)}%)`);
      adjustedPrice = Math.max(adjustedPrice, currentPrice * 0.95);
    }
  }

  // Rule 7: Holiday season protection
  const holidayInfo = getHolidayAdjustment(date);
  if (holidayInfo.name && adjustedPrice < currentPrice) {
    violations.push(`Cannot decrease prices during ${holidayInfo.name}`);
    adjustedPrice = currentPrice;
  }

  return {
    originalPrice: currentPrice,
    suggestedPrice: Math.round(adjustedPrice),
    violations,
    rulesApplied: violations.length,
    isValid: violations.length === 0
  };
}

/**
 * Validate price change request
 */
function validatePriceChange(room, newPrice, context = {}) {
  const rules = applyBusinessRules(room, newPrice, context);

  return {
    approved: rules.isValid,
    finalPrice: rules.suggestedPrice,
    violations: rules.violations,
    warnings: [],
    recommendation: rules.isValid
      ? 'Price change approved'
      : 'Price adjusted to comply with business rules'
  };
}

/**
 * Get pricing constraints for a room
 */
function getPricingConstraints(room, context = {}) {
  return {
    basePrice: PRICING_CONFIG.basePrice,
    minPrice: PRICING_CONFIG.rateFloor,
    maxPrice: PRICING_CONFIG.rateCeiling,
    maxChangePercent: 20,
    weekendPremium: 1.15,
    holidayPremiums: PRICING_CONFIG.holidayPremiums,
    competitorWeights: PRICING_CONFIG.competitors
  };
}

module.exports = {
  PRICING_CONFIG,
  calculateDynamicPrice,
  calculateCompetitorAdjustment,
  calculateOccupancyAdjustment,
  calculateDayOfWeekAdjustment,
  getHolidayAdjustment,
  applyBusinessRules,
  validatePriceChange,
  getPricingConstraints
};
