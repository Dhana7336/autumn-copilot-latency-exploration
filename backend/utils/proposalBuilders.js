/**
 * Individual Action Proposal Builders
 * Creates specific action proposals for different pricing actions
 */

const { calculateOccupancy, calculateCompetitorAverage, suggestOptimalPrice, estimateRevenueImpact, findUnderperformingRooms } = require('./revenueCalculations');
const { parseDateReference, formatDate, getToday } = require('./dateUtils');
const { extractRoomType, extractPrice, extractPercentage, parseDuration } = require('./intentDetection');

/**
 * Build price override proposal
 */
function buildPriceOverrideProposal(lower, rooms, competitors, reservations) {
  const roomType = extractRoomType(lower, rooms);
  const newPrice = extractPrice(lower);
  const dateRef = parseDateReference(lower);

  const room = rooms.find(r => (r.room_type || r['Room Type']) === roomType);
  const currentPrice = room ? parseFloat(room.base_price || room['Base Price'] || 150) : 150;
  const totalRooms = room ? parseInt(room.total_rooms || room['Total Rooms'] || 10) : 10;

  const occupancy = calculateOccupancy(reservations, roomType, totalRooms, dateRef.date);
  const competitorData = calculateCompetitorAverage(competitors, roomType);

  const targetPrice = newPrice || suggestOptimalPrice(
    { base_price: currentPrice },
    occupancy.rate,
    competitorData.average || currentPrice
  ).suggestedPrice;

  const impact = estimateRevenueImpact(currentPrice, targetPrice, occupancy.rate, totalRooms, 30);

  return {
    actionName: 'applyPriceOverride',
    parameters: {
      roomId: roomType.toLowerCase().replace(/\s+/g, '-'),
      date: dateRef.date,
      newPrice: targetPrice
    },
    description: `Set ${roomType} to $${targetPrice} on ${dateRef.label}`,
    reasoning: `Current price: $${currentPrice}. Occupancy: ${occupancy.percentage}%. Competitor avg: $${competitorData.average || 'N/A'}. Projected revenue impact: ${impact.revenueDeltaPct > 0 ? '+' : ''}${impact.revenueDeltaPct}%`,
    confidence: newPrice ? 0.9 : 0.75,
    impact: {
      currentPrice,
      newPrice: targetPrice,
      priceChange: `${impact.priceChange > 0 ? '+' : ''}${impact.priceChange}%`,
      projectedRevenueDelta: `${impact.revenueDeltaPct > 0 ? '+' : ''}$${impact.revenueDelta}`,
      riskLevel: impact.riskLevel
    },
    requiresApproval: true
  };
}

/**
 * Build temporary pricing proposal
 */
function buildTemporaryPricingProposal(lower, rooms, competitors, reservations) {
  const roomType = extractRoomType(lower, rooms);
  const percentage = extractPercentage(lower);
  const explicitPrice = extractPrice(lower);

  const room = rooms.find(r => (r.room_type || r['Room Type']) === roomType);
  const currentPrice = room ? parseFloat(room.base_price || room['Base Price'] || 150) : 150;
  const totalRooms = room ? parseInt(room.total_rooms || room['Total Rooms'] || 10) : 10;

  const duration = parseDuration(lower);
  void competitors;

  let newPrice = currentPrice;
  const isDiscount = lower.includes('discount') || lower.includes('off') || lower.includes('decrease') || lower.includes('lower');

  if (explicitPrice) {
    newPrice = explicitPrice;
  } else if (percentage) {
    newPrice = isDiscount
      ? Math.round(currentPrice * (1 - percentage / 100))
      : Math.round(currentPrice * (1 + percentage / 100));
  } else {
    newPrice = isDiscount ? Math.round(currentPrice * 0.9) : Math.round(currentPrice * 1.1);
  }

  const now = new Date();
  const startDate = now.toISOString();
  const endDate = new Date(now.getTime() + duration.hours * 60 * 60 * 1000).toISOString();

  const occupancy = calculateOccupancy(reservations, roomType, totalRooms);
  const reason = isDiscount ? `${duration.label} flash sale` : `${duration.label} surge pricing`;

  return {
    actionName: 'applyTemporaryPricing',
    parameters: {
      roomPricing: [{ roomType, currentPrice, newPrice }],
      startDate,
      endDate,
      reason
    },
    description: `Apply ${reason}: ${roomType} $${currentPrice} → $${newPrice}`,
    reasoning: `Temporary ${isDiscount ? 'discount' : 'increase'} for ${duration.label}. Current occupancy: ${occupancy.percentage}%. Will auto-revert after ${duration.label}.`,
    confidence: 0.85,
    impact: { currentPrice, newPrice, duration: duration.label, autoRevert: true },
    requiresApproval: true
  };
}

/**
 * Build rate clamp proposal
 */
function buildRateClampProposal(lower, rooms) {
  const roomType = extractRoomType(lower, rooms);
  const price = extractPrice(lower);
  const dateRef = parseDateReference(lower);

  const isFloor = lower.includes('floor') || lower.includes('minimum') || lower.includes('min');
  const clampType = isFloor ? 'floor' : 'ceiling';

  const room = rooms.find(r => (r.room_type || r['Room Type']) === roomType);
  const currentPrice = room ? parseFloat(room.base_price || room['Base Price'] || 150) : 150;

  const clampValue = price || (isFloor ? Math.round(currentPrice * 0.85) : Math.round(currentPrice * 1.25));

  let startDate = getToday();
  let endDate = getToday();
  if (dateRef.type === 'range') {
    startDate = dateRef.startDate;
    endDate = dateRef.endDate;
  } else {
    const end = new Date();
    end.setDate(end.getDate() + 7);
    endDate = end.toISOString().split('T')[0];
  }

  return {
    actionName: 'adjustRateClamp',
    parameters: { roomType, clampType, newValue: clampValue, startDate, endDate },
    description: `Set ${clampType === 'floor' ? 'minimum' : 'maximum'} price of $${clampValue} for ${roomType}`,
    reasoning: `${clampType === 'floor' ? 'Protect revenue with a minimum price' : 'Stay competitive with a price cap'}. Effective ${formatDate(startDate)} to ${formatDate(endDate)}.`,
    confidence: price ? 0.88 : 0.72,
    impact: { clampType, clampValue, currentPrice, dateRange: `${formatDate(startDate)} - ${formatDate(endDate)}` },
    requiresApproval: true
  };
}

/**
 * Build price increase/decrease proposal
 */
function buildPriceIncreaseProposal(lower, rooms) {
  const percentage = extractPercentage(lower) || 10;
  const isDecrease = lower.includes('decrease') || lower.includes('lower') || lower.includes('reduce') || lower.includes('discount');

  let targetRooms = [];
  const roomKeywords = ['standard', 'deluxe', 'executive', 'premium', 'presidential', 'suite', 'all'];

  for (const keyword of roomKeywords) {
    if (lower.includes(keyword)) {
      if (keyword === 'all') {
        targetRooms = rooms.map(r => r.room_type || r['Room Type']);
        break;
      }
      const match = rooms.find(r => (r.room_type || r['Room Type'] || '').toLowerCase().includes(keyword));
      if (match) targetRooms.push(match.room_type || match['Room Type']);
    }
  }

  if (targetRooms.length === 0) {
    targetRooms = isDecrease
      ? rooms.filter(r => (r.room_type || r['Room Type'] || '').toLowerCase().includes('standard')).map(r => r.room_type || r['Room Type'])
      : rooms.filter(r => (r.room_type || r['Room Type'] || '').toLowerCase().includes('suite')).map(r => r.room_type || r['Room Type']);

    if (targetRooms.length === 0) {
      targetRooms = [rooms[0]?.room_type || rooms[0]?.['Room Type'] || 'Standard Room'];
    }
  }

  let scope = 'all';
  if (lower.includes('weekend')) scope = 'weekend';
  if (lower.includes('weekday')) scope = 'weekday';

  const firstRoom = rooms.find(r => (r.room_type || r['Room Type']) === targetRooms[0]);
  const currentPrice = firstRoom ? parseFloat(firstRoom.base_price || firstRoom['Base Price'] || 150) : 150;
  const newPrice = isDecrease
    ? Math.round(currentPrice * (1 - percentage / 100))
    : Math.round(currentPrice * (1 + percentage / 100));

  return {
    actionName: 'applyPriceIncrease',
    parameters: { roomTypes: targetRooms, percentage: isDecrease ? -percentage : percentage, scope },
    description: `${isDecrease ? 'Decrease' : 'Increase'} ${targetRooms.join(', ')} by ${percentage}%`,
    reasoning: `Apply ${percentage}% ${isDecrease ? 'reduction' : 'increase'} to ${targetRooms.length} room type(s) for ${scope} pricing.`,
    confidence: 0.82,
    impact: {
      roomTypes: targetRooms,
      percentageChange: `${isDecrease ? '-' : '+'}${percentage}%`,
      scope,
      example: `${targetRooms[0]}: $${currentPrice} → $${newPrice}`
    },
    requiresApproval: true
  };
}

/**
 * Build competitor adjustment proposal
 */
function buildCompetitorAdjustmentProposal(lower, competitors) {
  const amount = extractPrice(lower) || extractPercentage(lower) || 10;
  const isBelow = lower.includes('below') || lower.includes('under') || lower.includes('undercut');

  let competitorName = 'Market Average';
  const competitorNames = competitors.map(c => (c.competitor_name || c['Competitor Name'] || '').toLowerCase());
  for (const name of competitorNames) {
    if (name && lower.includes(name.split(' ')[0])) {
      const comp = competitors.find(c => (c.competitor_name || c['Competitor Name'] || '').toLowerCase() === name);
      competitorName = comp?.competitor_name || comp?.['Competitor Name'] || name;
      break;
    }
  }

  return {
    actionName: 'updateCompetitorDifferential',
    parameters: { competitorName, newDifferential: isBelow ? -amount : amount },
    description: `Position pricing $${amount} ${isBelow ? 'below' : 'above'} ${competitorName}`,
    reasoning: `Adjust competitive positioning to be ${isBelow ? 'more aggressive' : 'more premium'} relative to ${competitorName}.`,
    confidence: 0.78,
    impact: { competitor: competitorName, differential: `${isBelow ? '-' : '+'}$${amount}`, positioning: isBelow ? 'value' : 'premium' },
    requiresApproval: true
  };
}

/**
 * Build analysis response
 */
function buildAnalysisResponse(rooms, reservations) {
  const enrichedRooms = rooms.map(room => {
    const roomType = room.room_type || room['Room Type'];
    const totalRooms = parseInt(room.total_rooms || room['Total Rooms'] || 10);
    const occupancy = calculateOccupancy(reservations, roomType, totalRooms);
    return { ...room, occupancy: occupancy.rate };
  });

  const underperforming = findUnderperformingRooms(enrichedRooms, 0.5);

  let analysisText = '';
  if (underperforming.length > 0) {
    analysisText = `Found ${underperforming.length} underperforming room(s):\n`;
    underperforming.forEach(r => {
      analysisText += `• ${r.roomType}: ${r.currentOccupancy}% occupancy at $${r.currentPrice} - ${r.recommendation}\n`;
    });
  } else {
    analysisText = 'All room types are performing within acceptable ranges.';
  }

  return {
    actionName: null,
    parameters: {},
    description: analysisText,
    reasoning: 'This is an analysis query - no action required.',
    confidence: 0.9,
    suggestions: underperforming.length > 0
      ? [`Try: "Lower ${underperforming[0].roomType} by 10%"`, `Try: "Apply flash sale for ${underperforming[0].roomType}"`]
      : ['Try: "Show revenue for this week"', 'Try: "Compare to competitors"']
  };
}

/**
 * Build undo proposal
 */
function buildUndoProposal() {
  return {
    actionName: 'undoLastAction',
    parameters: {},
    description: 'Undo the last pricing action and revert to previous price.',
    reasoning: 'This will remove the most recent pricing change and restore the original price.',
    impact: { action: 'Revert last change', effect: 'Original price will be restored' },
    requiresApproval: true,
    confirmationMessage: 'Are you sure you want to undo the last pricing action?'
  };
}

/**
 * Build help response
 */
function buildHelpResponse() {
  return {
    actionName: null,
    parameters: {},
    description: 'I can help you with hotel pricing. Here are some things you can ask:',
    reasoning: 'No specific action detected in your request.',
    confidence: 0.5,
    suggestions: [
      'Set Standard Room to $180 tomorrow',
      'Apply 10% discount for 5 hours',
      'Set minimum price of $150 for Deluxe',
      'Increase Executive Suite by 15%',
      'Price $20 below competitors',
      'Which rooms are underperforming?'
    ]
  };
}

module.exports = {
  buildPriceOverrideProposal,
  buildTemporaryPricingProposal,
  buildRateClampProposal,
  buildPriceIncreaseProposal,
  buildCompetitorAdjustmentProposal,
  buildAnalysisResponse,
  buildUndoProposal,
  buildHelpResponse
};
