/**
 * Intent Detection and Extraction Utilities
 * Lightweight module for parsing user intents from natural language
 */

/**
 * Detect user intent from prompt
 */
function detectIntent(lower) {
  // Temporary/flash pricing
  if (lower.match(/\b(temporary|temp|flash|promotion|promo)\b/) ||
      lower.match(/\d+[- ]?(hour|day|week|month)s?\b/) ||
      lower.match(/\bfor\s+\d+\s+(hour|day|week|month)s?\b/) ||
      lower.match(/\b(today only|weekend|month-long|week-long)\b/) ||
      (lower.includes('discount') && (lower.match(/\d+[- ]?(week|day|month)s?\b/) || lower.includes('today')))) {
    return { type: 'temporary_pricing' };
  }

  // Price override
  if (lower.match(/\b(set|change|override).*\$?\d+/) ||
      lower.match(/\$\d+.*\b(for|on|to)\b/)) {
    return { type: 'price_override' };
  }

  // Rate clamp
  if (lower.match(/\b(floor|ceiling|minimum|maximum|min|max|cap)\b/)) {
    return { type: 'rate_clamp' };
  }

  // Price increase/decrease
  if (lower.match(/\b(increase|raise|boost|decrease|lower|reduce).*price/i) ||
      lower.match(/\d+%\s*(increase|raise|off|discount)/)) {
    return { type: 'price_increase' };
  }

  // Competitor-based pricing
  if (lower.match(/\b(competitor|competition|market|versus|vs|below|above)\b/)) {
    return { type: 'competitor_adjustment' };
  }

  // Analysis queries
  if (lower.match(/\b(how|what|why|which|show|tell|analyze|performance|occupancy|revenue|underperform)/)) {
    return { type: 'analysis' };
  }

  // Undo/revert
  if (lower.match(/\b(undo|revert|rollback|cancel last|undo last|revert last)\b/)) {
    return { type: 'undo' };
  }

  return { type: 'unknown' };
}

/**
 * Extract room type from prompt (returns first match)
 */
function extractRoomType(lower, rooms) {
  const roomKeywords = ['standard', 'deluxe', 'executive', 'premium', 'presidential', 'suite', 'bernard', 'larua', 'santiago', 'pilar', 'mariana'];

  for (const keyword of roomKeywords) {
    if (lower.includes(keyword)) {
      const match = rooms.find(r => {
        const type = (r.room_type || r['Room Type'] || '').toLowerCase();
        return type.includes(keyword);
      });
      if (match) {
        return match.room_type || match['Room Type'];
      }
      return keyword.charAt(0).toUpperCase() + keyword.slice(1) + (keyword.includes('suite') ? '' : ' Room');
    }
  }

  return rooms[0]?.room_type || rooms[0]?.['Room Type'] || 'Standard Room';
}

/**
 * Extract ALL room types from prompt (returns array of matches)
 * Used when user mentions multiple rooms like "apply to Pilar and Mariana"
 */
function extractRoomTypes(lower, rooms) {
  const roomKeywords = ['standard', 'deluxe', 'executive', 'premium', 'presidential', 'suite', 'bernard', 'larua', 'santiago', 'pilar', 'mariana'];
  const foundRooms = [];

  for (const keyword of roomKeywords) {
    if (lower.includes(keyword)) {
      const match = rooms.find(r => {
        const type = (r.room_type || r['Room Type'] || '').toLowerCase();
        return type.includes(keyword);
      });
      if (match) {
        const roomName = match.room_type || match['Room Type'];
        // Avoid duplicates
        if (!foundRooms.includes(roomName)) {
          foundRooms.push(roomName);
        }
      } else {
        // Create room name from keyword if not found in data
        const roomName = keyword.charAt(0).toUpperCase() + keyword.slice(1) + (keyword.includes('suite') ? '' : ' Room');
        if (!foundRooms.includes(roomName)) {
          foundRooms.push(roomName);
        }
      }
    }
  }

  // If no rooms found, return first room as default
  if (foundRooms.length === 0) {
    const defaultRoom = rooms[0]?.room_type || rooms[0]?.['Room Type'] || 'Standard Room';
    return [defaultRoom];
  }

  return foundRooms;
}

/**
 * Extract price from prompt
 */
function extractPrice(lower) {
  const priceMatch = lower.match(/\$(\d+)/);
  if (priceMatch) return parseInt(priceMatch[1]);

  const numMatch = lower.match(/(\d+)\s*(dollar|usd)?/);
  if (numMatch && parseInt(numMatch[1]) > 50) return parseInt(numMatch[1]);

  return null;
}

/**
 * Extract percentage from prompt
 */
function extractPercentage(lower) {
  const match = lower.match(/(\d+)\s*%/);
  return match ? parseInt(match[1]) : null;
}

/**
 * Parse duration from user text
 */
function parseDuration(text) {
  const lower = text.toLowerCase();

  // Months
  const monthMatch = lower.match(/(\d+)[- ]?months?/) || lower.match(/month[- ]?long/);
  if (monthMatch) {
    const months = monthMatch[1] ? parseInt(monthMatch[1]) : 1;
    return { hours: months * 30 * 24, label: `${months} month${months > 1 ? 's' : ''}`, days: months * 30 };
  }

  // Weeks
  const weekMatch = lower.match(/(\d+)[- ]?weeks?/);
  if (weekMatch) {
    const weeks = parseInt(weekMatch[1]);
    return { hours: weeks * 7 * 24, label: `${weeks} week${weeks > 1 ? 's' : ''}`, days: weeks * 7 };
  }

  // Days
  const dayMatch = lower.match(/(\d+)[- ]?days?/);
  if (dayMatch) {
    const days = parseInt(dayMatch[1]);
    return { hours: days * 24, label: `${days} day${days > 1 ? 's' : ''}`, days: days };
  }

  // Hours
  const hourMatch = lower.match(/(\d+)[- ]?hours?/);
  if (hourMatch) {
    const hours = parseInt(hourMatch[1]);
    return { hours: hours, label: `${hours} hour${hours > 1 ? 's' : ''}`, days: 0 };
  }

  // Common patterns
  if (lower.includes('weekend')) return { hours: 48, label: 'weekend (2 days)', days: 2 };
  if (lower.includes('today only') || lower.includes('today')) return { hours: 24, label: 'today', days: 1 };
  if (lower.includes('flash')) return { hours: 4, label: '4 hours (flash sale)', days: 0 };

  // Default: 14 days
  return { hours: 14 * 24, label: '2 weeks', days: 14 };
}

/**
 * Check if prompt is asking for multiple promotions
 */
function isMultiplePromotionRequest(prompt) {
  const lower = prompt.toLowerCase();
  return (
    (lower.includes('offer') || lower.includes('promotion') || lower.includes('deal')) &&
    (lower.includes('what') || lower.includes('suggest') || lower.includes('recommend') || lower.includes('can i') || lower.includes('should i'))
  ) || lower.match(/\boffers?\b.*\bapply\b/) || lower.match(/\bpromotions?\b.*\bnow\b/);
}

/**
 * Check if user is asking to see impact analysis
 */
function isImpactAnalysisRequest(prompt) {
  const lower = prompt.toLowerCase();
  return (
    (lower.includes('impact') || lower.includes('analysis') || lower.includes('estimate') ||
     lower.includes('revenue') || lower.includes('occupancy') || lower.includes('revpar') ||
     lower.includes('risk') || lower.includes('assessment')) &&
    (lower.includes('yes') || lower.includes('show') || lower.includes('see') ||
     lower.includes('would like') || lower.includes('want') || lower.includes('please'))
  ) || lower.match(/\byes\b/) || lower.match(/\bshow me\b/) || lower.match(/\blet.*see\b/);
}

module.exports = {
  detectIntent,
  extractRoomType,
  extractRoomTypes,
  extractPrice,
  extractPercentage,
  parseDuration,
  isMultiplePromotionRequest,
  isImpactAnalysisRequest
};
