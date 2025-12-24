/**
 * Individual Action Proposal Builders
 * Creates specific action proposals for different pricing actions
 */

const { calculateOccupancy, calculateCompetitorAverage, suggestOptimalPrice, estimateRevenueImpact, findUnderperformingRooms } = require('./revenueCalculations');
const { parseDateReference, formatDate, getToday } = require('./dateUtils');
const { extractRoomType, extractRoomTypes, extractPrice, extractPercentage, parseDuration } = require('./intentDetection');

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
 * Supports multiple rooms when user mentions multiple room types
 */
function buildTemporaryPricingProposal(lower, rooms, competitors, reservations) {
  // Extract ALL room types mentioned (supports "apply to Pilar and Mariana")
  const roomTypes = extractRoomTypes(lower, rooms);
  const percentage = extractPercentage(lower);
  const explicitPrice = extractPrice(lower);

  const duration = parseDuration(lower);
  void competitors;

  const isDiscount = lower.includes('discount') || lower.includes('off') || lower.includes('decrease') || lower.includes('lower');

  // Build roomPricing array for all mentioned rooms
  const roomPricing = roomTypes.map(roomType => {
    const room = rooms.find(r => (r.room_type || r['Room Type']) === roomType);
    const currentPrice = room ? parseFloat(room.base_price || room['Base Price'] || 150) : 150;

    let newPrice = currentPrice;
    if (explicitPrice) {
      newPrice = explicitPrice;
    } else if (percentage) {
      newPrice = isDiscount
        ? Math.round(currentPrice * (1 - percentage / 100))
        : Math.round(currentPrice * (1 + percentage / 100));
    } else {
      newPrice = isDiscount ? Math.round(currentPrice * 0.9) : Math.round(currentPrice * 1.1);
    }

    return { roomType, currentPrice, newPrice };
  });

  const now = new Date();
  const startDate = now.toISOString();
  const endDate = new Date(now.getTime() + duration.hours * 60 * 60 * 1000).toISOString();

  // Unused: reservations parameter kept for API compatibility
  void reservations;

  // Build reason string with duration and percentage if provided
  let reason;
  if (percentage) {
    reason = `${duration.label} ${percentage}% ${isDiscount ? 'discount' : 'increase'}`;
  } else {
    reason = isDiscount ? `${duration.label} flash sale` : `${duration.label} surge pricing`;
  }

  // Build description showing all rooms
  const roomDescriptions = roomPricing.map(rp => `${rp.roomType} $${rp.currentPrice} → $${rp.newPrice}`).join(', ');
  const roomNamesList = roomTypes.join(', ');

  return {
    actionName: 'applyTemporaryPricing',
    parameters: {
      roomPricing,
      startDate,
      endDate,
      reason
    },
    description: `Apply ${reason}: ${roomDescriptions}`,
    reasoning: `Temporary ${isDiscount ? 'discount' : 'increase'} for ${duration.label} on ${roomTypes.length} room(s): ${roomNamesList}. Will auto-revert after ${duration.label}.`,
    confidence: 0.85,
    impact: {
      rooms: roomTypes,
      roomCount: roomTypes.length,
      duration: duration.label,
      autoRevert: true,
      details: roomPricing
    },
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
 * Build price increase/decrease proposal with full revenue impact analysis
 * Always shows simulation first, then recommendation, then requires approval for action
 */
function buildPriceIncreaseProposal(lower, rooms, competitors, reservations) {
  const percentage = extractPercentage(lower) || 10;
  const isDecrease = lower.includes('decrease') || lower.includes('lower') || lower.includes('reduce') || lower.includes('discount');

  // Extract room types using the enhanced function
  let targetRooms = extractRoomTypes(lower, rooms);

  // Check for 'all' keyword
  if (lower.includes('all room') || lower.includes('all prices')) {
    targetRooms = rooms.map(r => r.room_type || r['Room Type']);
  }

  let scope = 'all';
  if (lower.includes('weekend')) scope = 'weekend';
  if (lower.includes('weekday')) scope = 'weekday';
  if (lower.includes('holiday')) scope = 'holiday';

  // Calculate detailed impact for each room
  const roomAnalysis = targetRooms.map(roomType => {
    const room = rooms.find(r => (r.room_type || r['Room Type']) === roomType);
    const currentPrice = room ? parseFloat(room.base_price || room['Base Price'] || 150) : 150;
    const totalRooms = room ? parseInt(room.total_rooms || room['Total Rooms'] || 10) : 10;

    const newPrice = isDecrease
      ? Math.round(currentPrice * (1 - percentage / 100))
      : Math.round(currentPrice * (1 + percentage / 100));

    // Get occupancy (uses historical average if no current reservations)
    const occupancy = calculateOccupancy(reservations, roomType, totalRooms);

    // Get competitor data for context
    const competitorData = calculateCompetitorAverage(competitors, roomType);

    // Calculate 30-day revenue impact
    const impact = estimateRevenueImpact(currentPrice, newPrice, occupancy.rate, totalRooms, 30);

    return {
      roomType,
      currentPrice,
      newPrice,
      totalRooms,
      occupancy: occupancy.percentage,
      isHistoricalOccupancy: occupancy.isHistorical,
      competitorAvg: competitorData.average || null,
      currentRevenue: impact.currentRevenue,
      projectedRevenue: impact.projectedRevenue,
      revenueDelta: impact.revenueDelta,
      revenueDeltaPct: impact.revenueDeltaPct,
      occupancyChange: impact.occupancyDelta,
      projectedOccupancy: impact.projectedOccupancy,
      riskLevel: impact.riskLevel
    };
  });

  // Calculate totals
  const totalCurrentRevenue = roomAnalysis.reduce((sum, r) => sum + r.currentRevenue, 0);
  const totalProjectedRevenue = roomAnalysis.reduce((sum, r) => sum + r.projectedRevenue, 0);
  const totalRevenueDelta = totalProjectedRevenue - totalCurrentRevenue;
  const totalRevenueDeltaPct = totalCurrentRevenue > 0 ? Math.round((totalRevenueDelta / totalCurrentRevenue) * 100 * 10) / 10 : 0;

  // Build analysis text
  let analysisText = `IMPACT ANALYSIS (30-day projection)\n\n`;
  roomAnalysis.forEach(r => {
    analysisText += `${r.roomType}:\n`;
    analysisText += `  Price: $${r.currentPrice} → $${r.newPrice} (${isDecrease ? '-' : '+'}${percentage}%)\n`;
    analysisText += `  Occupancy: ${r.occupancy}%${r.isHistoricalOccupancy ? ' (historical avg)' : ''} → ${r.projectedOccupancy}%\n`;
    analysisText += `  Revenue: $${r.currentRevenue.toLocaleString()} → $${r.projectedRevenue.toLocaleString()} (${r.revenueDelta >= 0 ? '+' : ''}$${r.revenueDelta.toLocaleString()})\n`;
    if (r.competitorAvg) {
      analysisText += `  vs Competitors: $${r.competitorAvg} avg\n`;
    }
    analysisText += `  Risk: ${r.riskLevel.toUpperCase()}\n\n`;
  });

  // Build recommendation
  let recommendation = `RECOMMENDATION\n`;
  if (totalRevenueDelta > 0) {
    recommendation += `This ${isDecrease ? 'price reduction' : 'price increase'} is projected to ${isDecrease ? 'boost occupancy and ' : ''}generate +$${totalRevenueDelta.toLocaleString()} additional revenue over 30 days.`;
  } else {
    recommendation += `This ${isDecrease ? 'price reduction' : 'price increase'} may result in $${Math.abs(totalRevenueDelta).toLocaleString()} lower revenue over 30 days. Consider adjusting the percentage.`;
  }

  const overallRisk = roomAnalysis.some(r => r.riskLevel === 'high') ? 'high' :
                      roomAnalysis.some(r => r.riskLevel === 'medium') ? 'medium' : 'low';

  return {
    actionName: 'applyPriceIncrease',
    parameters: {
      roomTypes: targetRooms,
      percentage: isDecrease ? -percentage : percentage,
      scope,
      roomAnalysis // Include detailed analysis for execution
    },
    description: `${isDecrease ? 'Decrease' : 'Increase'} ${targetRooms.join(', ')} by ${percentage}%${scope !== 'all' ? ` (${scope} only)` : ''}`,
    reasoning: analysisText + recommendation,
    confidence: 0.85,
    impact: {
      roomTypes: targetRooms,
      roomCount: targetRooms.length,
      percentageChange: `${isDecrease ? '-' : '+'}${percentage}%`,
      scope,
      totalCurrentRevenue,
      totalProjectedRevenue,
      totalRevenueDelta: `${totalRevenueDelta >= 0 ? '+' : ''}$${totalRevenueDelta.toLocaleString()}`,
      totalRevenueDeltaPct: `${totalRevenueDeltaPct >= 0 ? '+' : ''}${totalRevenueDeltaPct}%`,
      overallRisk,
      details: roomAnalysis.map(r => ({
        room: r.roomType,
        price: `$${r.currentPrice} → $${r.newPrice}`,
        revenue: `${r.revenueDelta >= 0 ? '+' : ''}$${r.revenueDelta.toLocaleString()}`,
        risk: r.riskLevel
      }))
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
