const actions = require('./actions');
const { mapToHotelRoomType, roomTypesMatch, HOTEL_TO_AI_MAP } = require('./roomMapping');

// Helper to find a room in context data using room mapping
function findRoomInContext(rooms, aiRoomType) {
  if (!rooms || !aiRoomType) return null;

  // Map AI room type (e.g., "Standard Room") to hotel type (e.g., "Bernard")
  const hotelRoomType = mapToHotelRoomType(aiRoomType);

  return rooms.find(r => {
    const roomType = r.room_type || r['Room Type'] || '';
    return roomTypesMatch(roomType, hotelRoomType) || roomTypesMatch(roomType, aiRoomType);
  });
}

// Helper to get display name for a hotel room type
function getDisplayName(hotelRoomType) {
  return HOTEL_TO_AI_MAP[hotelRoomType] || hotelRoomType;
}

/**
 * Parse user prompt to determine intent (increase, decrease, review)
 * @deprecated Use planActionFromPrompt for new action-based flow
 */
function analyzePrompt(prompt) {
  const p = (prompt || '').toLowerCase();
  if (p.includes('low') || p.includes('increase') || p.includes('raise') || p.includes('higher')) {
    return 'increase';
  }
  if (p.includes('high') || p.includes('decrease') || p.includes('drop') || p.includes('lower')) {
    return 'decrease';
  }
  return 'review';
}

/**
 * Main function: Analyze prompt and return a structured action proposal
 * This replaces the old "respond with text" approach
 * @param {string} prompt - User's natural language request
 * @param {object} contextData - Current pricing data (rooms, competitors, reservations)
 * @returns {object} Action proposal with actionName, parameters, description, confidence
 */
function planActionFromPrompt(prompt, contextData = {}) {
  const p = (prompt || '').toLowerCase();
  const { rooms = [], competitors = [], reservations = [] } = contextData;

  // Pattern matching for different action types

  // NEW: General price increase for specific room types (Executive, Premium, etc.)
  // Examples: "increase price for Executive", "raise Premium Suite rates", "price adjustment for Executive and Premium"
  const generalIncreaseMatch = p.match(/(increase|raise|adjust|change|boost).*price.*(?:for)?\s*(executive|premium|suite|deluxe|standard)/i) ||
                                p.match(/(executive|premium|suite).*(increase|raise|price|rate|adjustment)/i);

  if (generalIncreaseMatch) {
    const roomTypes = [];

    // Extract room types mentioned
    if (p.includes('executive')) roomTypes.push('Executive Suite');
    if (p.includes('premium')) roomTypes.push('Premium Suite');

    // If both are mentioned or just "suite", apply to both premium suites
    if (roomTypes.length === 0 || (p.includes('suite') && !p.includes('executive') && !p.includes('premium'))) {
      roomTypes.push('Executive Suite', 'Premium Suite');
    }

    // Extract percentage if specified, otherwise use default
    let percentage = 6; // default increase
    const percentMatch = p.match(/(\d+)\s*%/);
    if (percentMatch) {
      percentage = parseInt(percentMatch[1]);
    }

    // Get current prices from context using room mapping
    const currentPrices = {};
    roomTypes.forEach(roomType => {
      const room = findRoomInContext(rooms, roomType);
      if (room) {
        currentPrices[roomType] = parseFloat(room.base_price || room['Base Price'] || 0);
      }
    });

    const executiveOld = currentPrices['Executive Suite'] || 329;
    const premiumOld = currentPrices['Premium Suite'] || 459;
    const executiveNew = Math.round(executiveOld * (1 + percentage / 100));
    const premiumNew = Math.round(premiumOld * (1 + percentage / 100));

    return {
      actionName: 'applyPriceIncrease',
      parameters: {
        roomTypes,
        percentage,
        scope: 'all days'
      },
      description: `Apply ${percentage}% price increase to ${roomTypes.join(' and ')}`,
      confidence: 0.92,
      reasoning: `Detected request to increase pricing for premium suites. Proposing ${percentage}% increase across all days.`,
      actionProposal: {
        actionType: 'priceincrease',
        scope: `${roomTypes.join(' and ')}, all days`,
        before_value: `Executive Suite $${executiveOld}, Premium Suite $${premiumOld}`,
        after_value: `Executive Suite $${executiveNew}, Premium Suite $${premiumNew}`,
        expected_impact: 'Maintain current occupancy levels while increasing revenue',
        requires_approval: true
      }
    };
  }

  // SPECIAL CASE: Month-wide 10% increase request -> propose targeted weekend uplift for premium suites
  const monthIncreaseMatch = (
    (p.includes('increase') || p.includes('raise')) &&
    p.includes('10%') &&
    (p.includes('this month') || p.includes('next month') || p.includes('month')) &&
    (p.includes('deluxe') || p.includes('standard') || p.includes('room'))
  );

  if (monthIncreaseMatch) {
    const premiumRooms = ['Executive Suite', 'Premium Suite'];
    return {
      actionName: 'applyWeekendRateIncrease',
      parameters: {
        roomTypes: premiumRooms,
        percentage: 8,
        scope: 'weekend'
      },
      description: 'Raise weekend rates by 8% for Executive and Premium Suites',
      confidence: 0.88,
      reasoning: 'Detected broad 10% month-long increase request; proposing a targeted 8% weekend uplift for premium suites instead for revenue gain with controlled risk.'
    };
  }
  
  // 0. TEMPORARY PRICING (hour-based, day-based, or date-range promotions with auto-revert)
  // Examples: "increase 25% for 1 hour", "discount Standard Room for 5 hours", "weekend promotion"
  // Also matches Lily Hall room names: Bernard, LaRua, Santiago, Pilar, Mariana
  const tempPricingMatch =
    p.match(/(?:increase|decrease|discount|raise|lower|change|set).*?(\d+)%?\s*(?:for|next)?\s*(\d+)?\s*(hour|day|week)/i) ||
    p.match(/(?:temporary|temp|flash|promotion|promo|offer).*?(standard|deluxe|executive|premium|presidential|suite|bernard|larua|santiago|pilar|mariana)/i) ||
    p.match(/(standard|deluxe|executive|premium|presidential|suite|bernard|larua|santiago|pilar|mariana).*?(?:promotion|promo|offer|for|next)\s*(\d+)?\s*(hour|day|week)?/i);

  if (tempPricingMatch) {
    // Extract room type - check for Lily Hall names first, then AI names
    let roomType = 'Bernard'; // Default to Bernard (Standard)

    // Check for Lily Hall room names first
    const lilyHallMatch = p.match(/\b(bernard|larua|santiago|pilar|mariana)\b/i);
    if (lilyHallMatch) {
      const name = lilyHallMatch[1].toLowerCase();
      const nameMap = { 'bernard': 'Bernard', 'larua': 'LaRua', 'santiago': 'Santiago', 'pilar': 'Pilar', 'mariana': 'Mariana' };
      roomType = nameMap[name] || 'Bernard';
    } else {
      // Fall back to AI room names
      const roomMatch = p.match(/\b(standard|deluxe|executive|premium|presidential)\s*(room|suite)?/i);
      if (roomMatch) {
        const roomName = roomMatch[1].toLowerCase();
        // Map AI names to Lily Hall names
        const aiToLilyMap = { 'standard': 'Bernard', 'deluxe': 'LaRua', 'executive': 'Santiago', 'premium': 'Pilar', 'presidential': 'Mariana' };
        roomType = aiToLilyMap[roomName] || 'Bernard';
      }
    }

    // Get current price from context using room mapping
    const room = findRoomInContext(rooms, roomType);
    const currentPrice = room ? parseFloat(room.base_price || room['Base Price'] || 150) : 150;

    // Determine if this is a promotion/offer (discount) or increase
    const isPromotion = p.includes('promotion') || p.includes('promo') || p.includes('offer') ||
                        p.includes('discount') || p.includes('flash') || p.includes('sale');
    const isIncrease = p.includes('increase') || p.includes('raise') || p.includes('surge');

    // Extract percentage or amount
    let newPrice = currentPrice;
    let discountPercent = 10; // Default 10% discount for promotions
    const percentMatch = p.match(/(\d+)\s*%/);
    const amountMatch = p.match(/\$?(\d+)\s*(?:discount|off)/i);

    if (percentMatch) {
      const percent = parseInt(percentMatch[1]);
      if (isIncrease) {
        newPrice = Math.round(currentPrice * (1 + percent / 100));
      } else {
        newPrice = Math.round(currentPrice * (1 - percent / 100));
        discountPercent = percent;
      }
    } else if (amountMatch) {
      const amount = parseInt(amountMatch[1]);
      newPrice = currentPrice - amount;
      discountPercent = Math.round((amount / currentPrice) * 100);
    } else if (isPromotion && !isIncrease) {
      // Default: Apply 10% discount for promotions/offers
      newPrice = Math.round(currentPrice * 0.9);
    } else if (isIncrease) {
      // Default: Apply 10% increase for surge pricing
      newPrice = Math.round(currentPrice * 1.1);
    }

    // Extract duration (hours, days, weeks) - default to 1 day for promotions
    let durationValue = 1;
    let durationUnit = isPromotion ? 'day' : 'hour';
    const durationMatch = p.match(/(\d+)?\s*(hour|day|week)s?/i);
    if (durationMatch) {
      durationValue = durationMatch[1] ? parseInt(durationMatch[1]) : 1;
      durationUnit = durationMatch[2].toLowerCase();
    }

    // Calculate start and end dates/times
    const now = new Date();
    const startDate = now.toISOString();
    let endDate;

    if (durationUnit === 'hour') {
      endDate = new Date(now.getTime() + durationValue * 60 * 60 * 1000).toISOString();
    } else if (durationUnit === 'day') {
      endDate = new Date(now.getTime() + durationValue * 24 * 60 * 60 * 1000).toISOString();
    } else if (durationUnit === 'week') {
      endDate = new Date(now.getTime() + durationValue * 7 * 24 * 60 * 60 * 1000).toISOString();
    }

    // Build reason string
    let reason;
    if (p.includes('flash')) {
      reason = 'flash sale';
    } else if (isPromotion) {
      reason = `${discountPercent}% promotion`;
    } else if (isIncrease) {
      reason = 'surge pricing';
    } else if (percentMatch) {
      reason = `${percentMatch[1]}% ${isIncrease ? 'increase' : 'discount'}`;
    } else {
      reason = `${durationValue}-${durationUnit} promotion`;
    }

    return {
      actionName: 'applyTemporaryPricing',
      parameters: {
        roomPricing: [{
          roomType: roomType,
          currentPrice: currentPrice,
          newPrice: newPrice
        }],
        startDate: startDate,
        endDate: endDate,
        reason: reason
      },
      description: `Apply ${reason} to ${roomType}: $${currentPrice} → $${newPrice} (${durationValue} ${durationUnit})`,
      confidence: 0.88,
      reasoning: `Detected ${isPromotion ? 'promotional discount' : 'pricing change'} with automatic revert after ${durationValue} ${durationUnit}(s)`
    };
  }

  // 1. PRICE OVERRIDE (specific room, specific date or general increase)
  // Examples: "Set Standard Room to $200 on Dec 25", "Increase Standard Room from $159 to $179"
  // Also matches Lily Hall room names: Bernard, LaRua, Santiago, Pilar, Mariana
  const overrideMatch = p.match(/(?:set|override|change|increase|raise).*?(standard|deluxe|executive|premium|presidential|suite|bernard|larua|santiago|pilar|mariana)/i);
  const priceMatches = p.match(/\$?(\d+)/g);

  if (overrideMatch && priceMatches && priceMatches.length > 0) {
    let roomType = overrideMatch[1].toLowerCase();
    // Map to Lily Hall room names
    const aiToLilyMap = { 'standard': 'bernard', 'deluxe': 'larua', 'executive': 'santiago', 'premium': 'pilar', 'presidential': 'mariana', 'suite': 'santiago' };
    roomType = aiToLilyMap[roomType] || roomType;
    // Take the last price mentioned (target price)
    const lastPrice = priceMatches[priceMatches.length - 1].replace('$', '');
    const price = parseInt(lastPrice);
    
    // Extract date
    let targetDate = new Date();
    if (p.includes('tomorrow')) {
      targetDate.setDate(targetDate.getDate() + 1);
    } else if (p.includes('next weekend')) {
      // Find next Saturday
      const daysUntilSaturday = (6 - targetDate.getDay() + 7) % 7 || 7;
      targetDate.setDate(targetDate.getDate() + daysUntilSaturday);
    }
    // Check for specific date pattern (Dec 25, 12/25, etc.)
    const dateMatch = p.match(/(?:dec|december)\s+(\d+)|(\d+)\/(\d+)/i);
    if (dateMatch) {
      const day = dateMatch[1] || dateMatch[2];
      const month = dateMatch[3] ? parseInt(dateMatch[3]) - 1 : 11; // Dec = 11
      targetDate = new Date(2025, month, parseInt(day));
    }

    return {
      actionName: 'applyPriceOverride',
      parameters: {
        roomId: roomType,
        date: targetDate.toISOString().split('T')[0],
        newPrice: price
      },
      description: `Set a one-time price of $${price} for ${roomType} room on ${targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      confidence: 0.85,
      reasoning: 'Detected explicit price override request for specific room and date'
    };
  }

  // 2. RATE CLAMP (floor/ceiling over date range)
  // Examples: "Set $150 floor for Standard next weekend", "Cap Deluxe at $400 this week"
  const clampMatch = p.match(/(?:set|add|create).*?\$?(\d+)\s+(floor|ceiling|minimum|maximum|min|max|cap)/i) ||
                     p.match(/(floor|ceiling|minimum|maximum|min|max|cap).*?\$?(\d+)/i);
  
  if (clampMatch) {
    const price = parseInt(clampMatch[1].match(/\d+/) ? clampMatch[1] : clampMatch[2]);
    const clampWord = (clampMatch[2] || clampMatch[1]).toLowerCase();
    const clampType = ['floor', 'minimum', 'min'].includes(clampWord) ? 'floor' : 'ceiling';
    
    // Extract room type
    let roomType = 'Standard Room';
    const roomMatch = p.match(/\b(standard|deluxe|suite|penthouse|presidential)\s*(room)?/i);
    if (roomMatch) {
      roomType = roomMatch[1].charAt(0).toUpperCase() + roomMatch[1].slice(1) + ' Room';
    }
    
    // Extract date range
    let startDate = new Date();
    let endDate = new Date();
    
    if (p.includes('next weekend')) {
      const daysUntilSaturday = (6 - startDate.getDay() + 7) % 7 || 7;
      startDate.setDate(startDate.getDate() + daysUntilSaturday);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1); // Sat-Sun
    } else if (p.includes('this week')) {
      endDate.setDate(endDate.getDate() + 7);
    } else if (p.includes('this month')) {
      endDate = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0);
    } else {
      endDate.setDate(endDate.getDate() + 7); // Default 7 days
    }

    return {
      actionName: 'adjustRateClamp',
      parameters: {
        roomType,
        clampType,
        newValue: price,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      },
      description: `Set a ${clampType === 'floor' ? 'minimum' : 'maximum'} price of $${price} for ${roomType} from ${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} to ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} to ${clampType === 'floor' ? 'protect revenue' : 'stay competitive'}`,
      confidence: 0.82,
      reasoning: `Detected rate ${clampType} request for date range`
    };
  }

  // 3. COMPETITOR WEIGHT
  // Examples: "Give Ritz more weight", "Increase importance of Marriott to 80%"
  const weightMatch = p.match(/(?:give|set|increase|decrease).*?(ritz|marriott|plaza|waldorf|four seasons).*?(?:weight|importance)/i) ||
                      p.match(/(ritz|marriott|plaza|waldorf|four seasons).*?(?:to|at)?\s*(\d+)%/i);
  
  if (weightMatch) {
    const competitorName = weightMatch[1];
    let weight = 0.7; // Default increase
    
    if (p.includes('decrease') || p.includes('lower') || p.includes('less')) {
      weight = 0.3;
    }
    
    const percentMatch = p.match(/(\d+)%/);
    if (percentMatch) {
      weight = parseInt(percentMatch[1]) / 100;
    }

    return {
      actionName: 'updateCompetitorWeight',
      parameters: {
        competitorName,
        newWeight: weight
      },
      description: `Adjust ${competitorName}'s influence in pricing calculations to ${(weight * 100).toFixed(0)}%`,
      confidence: 0.78,
      reasoning: 'Detected request to modify competitor importance in pricing model'
    };
  }

  // 4. COMPETITOR DIFFERENTIAL
  // Examples: "Price $10 below Ritz", "Stay $15 above Marriott", "Undercut Plaza by $20"
  const diffMatch = p.match(/(?:price|stay|set|undercut).*?\$?(\d+)\s*(?:below|above|under|over).*?(ritz|marriott|plaza|waldorf|four seasons)/i) ||
                    p.match(/(ritz|marriott|plaza|waldorf|four seasons).*?(?:by|at)?\s*\$?(\d+)/i);
  
  if (diffMatch) {
    const amount = parseInt(diffMatch[1].match(/\d+/) ? diffMatch[1] : diffMatch[2]);
    const competitorName = diffMatch[2] || diffMatch[1];
    const isBelow = p.includes('below') || p.includes('under') || p.includes('undercut');
    const differential = isBelow ? -amount : amount;

    return {
      actionName: 'updateCompetitorDifferential',
      parameters: {
        competitorName,
        newDifferential: differential
      },
      description: `Position pricing $${amount} ${isBelow ? 'below' : 'above'} ${competitorName} to ${isBelow ? 'capture price-sensitive guests' : 'maintain premium positioning'}`,
      confidence: 0.81,
      reasoning: 'Detected competitive positioning request with specific differential'
    };
  }

  // 5. NO CLEAR ACTION - Return informational response
  return {
    actionName: null,
    parameters: {},
    description: 'No specific pricing action detected. This appears to be an informational query.',
    confidence: 0.5,
    reasoning: 'Prompt does not match known action patterns. Consider rephrasing or asking for analysis instead.',
    suggestions: [
      'Try: "Set Standard Room to $200 on Dec 25"',
      'Try: "Set $150 floor for Deluxe next weekend"',
      'Try: "Price $10 below Ritz Carlton"',
      'Try: "Give Marriott 70% weight in pricing"'
    ]
  };
}

/**
 * Create an audit entry with full decision trace
 */
function createAuditEntry(options) {
  const { operator, prompt, intent, approvals, applied } = options;
  return {
    time: new Date().toISOString(),
    operator: operator || 'unknown',
    prompt: prompt || null,
    intent: intent || 'review',
    approvals: approvals || [],
    applied: applied || []
  };
}

/**
 * Log an audit entry to a persistent store (in-memory or file-based)
 */
let auditLog = [];

function logAudit(entry) {
  auditLog.push(entry);
  return entry;
}

function getAuditLog() {
  return auditLog;
}

function clearAuditLog() {
  auditLog = [];
}

/**
 * Handle conversational flow with approval detection
 */
function handleConversationalFlow(prompt, conversationHistory = []) {
  const promptLower = prompt.toLowerCase().trim();
  
  // Check for approval phrases
  const approvalPhrases = ['yes', 'ok', 'okay', 'approve', 'apply', 'proceed', 'go ahead', 'do it', 'execute', 'confirm'];
  
  const isShortApproval = promptLower.split(' ').length <= 3 && 
                          approvalPhrases.some(phrase => promptLower === phrase);
  
  // If this looks like an approval, find the last proposed action
  if (isShortApproval && conversationHistory.length > 0) {
    // Look for last assistant message with action proposal
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      const msg = conversationHistory[i];
      if (msg.role === 'assistant' && msg.actionProposal) {
        return {
          type: 'APPROVAL',
          actionProposal: msg.actionProposal,
          text: `Approval received for: ${msg.actionProposal.description}`
        };
      }
    }
  }
  
  // Otherwise, plan a new action
  return {
    type: 'NEW_REQUEST',
    text: 'Analyzing your request...'
  };
}

module.exports = {
  analyzePrompt, // Legacy function (keep for backward compatibility)
  planActionFromPrompt, // New action-based planning
  createAuditEntry,
  logAudit,
  getAuditLog,
  clearAuditLog,
  handleConversationalFlow
};