/**
 * LLM System Prompts
 * Builds context-aware prompts for the AI assistant
 */

const { calculateOccupancy } = require('./revenueCalculations');

/**
 * Build system prompt with hotel context
 */
function buildSystemPrompt(contextData) {
  const now = new Date();
  const todayISO = now.toISOString().split('T')[0];
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const rooms = contextData.rooms || [];
  const reservations = contextData.reservations || [];

  // Build room summary with historical occupancy
  const roomSummary = rooms.map(r => {
    const type = r.room_type || r['Room Type'];
    const total = parseInt(r.total_rooms || r['Total Rooms'] || 0);
    const price = parseFloat(r.base_price || r['Base Price'] || 0);
    const occupancy = calculateOccupancy(reservations, type, total);
    return `${type}: ${total} rooms at $${price} (${occupancy.percentage}% occupancy${occupancy.isHistorical ? ' avg' : ''})`;
  }).join(', ');

  const totalRooms = rooms.reduce((sum, r) =>
    sum + (parseInt(r.total_rooms || r['Total Rooms']) || 0), 0) || 33;

  const todayCheckIns = reservations.filter(r => {
    const checkIn = r.check_in_date || r['Check In Date'];
    return checkIn === todayISO;
  }).length;

  const occupiedToday = reservations.filter(r => {
    const checkIn = r.check_in_date || r['Check In Date'];
    const checkOut = r.check_out_date || r['Check Out Date'];
    const status = (r.Status || r.status || '').toLowerCase();
    return checkIn <= todayISO && checkOut > todayISO &&
           (status === 'confirmed' || status === 'in-house');
  }).length;

  // Calculate historical average occupancy if no current bookings
  let avgOccupancy = occupiedToday / totalRooms;
  if (occupiedToday === 0 && reservations.length > 0) {
    // Use historical average from all room types
    const totalHistoricalRate = rooms.reduce((sum, r) => {
      const type = r.room_type || r['Room Type'];
      const total = parseInt(r.total_rooms || r['Total Rooms'] || 0);
      const occ = calculateOccupancy(reservations, type, total);
      return sum + occ.rate;
    }, 0);
    avgOccupancy = rooms.length > 0 ? totalHistoricalRate / rooms.length : 0.65;
  }

  const competitorSummary = (contextData.competitors || []).slice(0, 5).map(c => {
    const name = c.competitor_name || c['Competitor Name'];
    const price = c.avg_price || c['Avg Price'];
    return `${name}: $${price}`;
  }).join(', ');

  const reservationsByDate = {};
  reservations.forEach(r => {
    const checkIn = r.check_in_date || r['Check In Date'];
    const checkOut = r.check_out_date || r['Check Out Date'];
    const roomType = r.room_type || r['Room Type'];
    const guest = r.guest_name || r['Guest Name'] || 'Guest';
    const status = r.Status || r.status || 'confirmed';

    if (checkIn) {
      if (!reservationsByDate[checkIn]) reservationsByDate[checkIn] = [];
      reservationsByDate[checkIn].push({ type: 'check-in', roomType, guest, status });
    }
    if (checkOut) {
      if (!reservationsByDate[checkOut]) reservationsByDate[checkOut] = [];
      reservationsByDate[checkOut].push({ type: 'check-out', roomType, guest, status });
    }
  });

  const upcomingDates = [];
  for (let i = 0; i < 14; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() + i);
    const dateKey = date.toISOString().split('T')[0];
    const dayReservations = reservationsByDate[dateKey] || [];
    if (dayReservations.length > 0) {
      const checkIns = dayReservations.filter(r => r.type === 'check-in').length;
      const checkOuts = dayReservations.filter(r => r.type === 'check-out').length;
      upcomingDates.push(`${dateKey}: ${checkIns} check-ins, ${checkOuts} check-outs`);
    }
  }

  const allReservations = reservations.slice(0, 50).map(r => {
    const checkIn = r.check_in_date || r['Check In Date'];
    const checkOut = r.check_out_date || r['Check Out Date'];
    const roomType = r.room_type || r['Room Type'];
    const guest = r.guest_name || r['Guest Name'] || 'Guest';
    const status = r.Status || r.status || 'confirmed';
    return `${guest} | ${roomType} | ${checkIn} to ${checkOut} | ${status}`;
  }).join('\n');

  // Get US holidays for pricing context
  const usHolidays = getUpcomingUSHolidays();

  return `You are an AI hotel revenue assistant for Lily Hall Hotel. Connected to LIVE database.

=== TODAY: ${dateStr} (${todayISO}) ===

RULES:
- You HAVE live data access. NEVER say "I don't have access".
- ALWAYS provide revenue impact estimates using historical occupancy data.
- When user asks about future dates (weekend, holiday, specific day), use HISTORICAL AVERAGE OCCUPANCY (${Math.round(avgOccupancy * 100)}%) to project revenue impact.
- NEVER say "cannot process because no reservations" - use historical data for projections instead.
- For price changes, always show: current price, new price, projected revenue impact, occupancy impact, and risk level.

ROOMS (${totalRooms} total): ${roomSummary || 'Bernard: 8, LaRua: 6, Santiago: 10, Pilar: 5, Mariana: 4'}

CURRENT STATUS: ${todayCheckIns} check-ins today, ${occupiedToday}/${totalRooms} currently occupied (${Math.round(occupiedToday/totalRooms*100)}%)
HISTORICAL AVG OCCUPANCY: ${Math.round(avgOccupancy * 100)}% (use this for future projections)

NEXT 14 DAYS:
${upcomingDates.length > 0 ? upcomingDates.join('\n') : 'No scheduled reservations - use historical average ('+Math.round(avgOccupancy * 100)+'%) for projections'}

${usHolidays.length > 0 ? 'UPCOMING US HOLIDAYS:\n' + usHolidays.join('\n') + '\n' : ''}
RESERVATIONS:
${allReservations || 'No current reservations - use historical occupancy data for estimates'}

COMPETITORS: ${competitorSummary || 'Hilton: $225, Margaritaville: $190, Hampton Inn: $165'}

REVENUE PROJECTION FORMULA:
- For price increase X%: Occupancy decreases by ~1.5X% (demand elasticity)
- Projected Revenue = New Price × Rooms × Projected Occupancy × Days
- Always show 30-day revenue impact

ACTIONS: applyPriceOverride, applyTemporaryPricing, adjustRateClamp, applyPriceIncrease, updateCompetitorDifferential

DURATION: "2 weeks" = 14 days, "1 month" = 30 days, "weekend" = 2 days, "flash" = 4 hours

Be concise and data-driven. Always provide specific numbers and estimates.`;
}

/**
 * Get upcoming US holidays for the next 90 days
 */
function getUpcomingUSHolidays() {
  const now = new Date();
  const year = now.getFullYear();
  const nextYear = year + 1;

  // Major US holidays with dates
  const holidays = [
    { name: "New Year's Day", date: `${nextYear}-01-01` },
    { name: "Martin Luther King Jr. Day", date: getThirdMonday(nextYear, 0) }, // 3rd Monday of January
    { name: "Presidents' Day", date: getThirdMonday(nextYear, 1) }, // 3rd Monday of February
    { name: "Memorial Day", date: getLastMonday(year, 4) }, // Last Monday of May
    { name: "Independence Day", date: `${year}-07-04` },
    { name: "Labor Day", date: getFirstMonday(year, 8) }, // 1st Monday of September
    { name: "Columbus Day", date: getSecondMonday(year, 9) }, // 2nd Monday of October
    { name: "Veterans Day", date: `${year}-11-11` },
    { name: "Thanksgiving", date: getFourthThursday(year, 10) }, // 4th Thursday of November
    { name: "Christmas Eve", date: `${year}-12-24` },
    { name: "Christmas Day", date: `${year}-12-25` },
    { name: "New Year's Eve", date: `${year}-12-31` },
  ];

  const todayISO = now.toISOString().split('T')[0];
  const futureDate = new Date(now);
  futureDate.setDate(futureDate.getDate() + 90);
  const futureISO = futureDate.toISOString().split('T')[0];

  return holidays
    .filter(h => h.date >= todayISO && h.date <= futureISO)
    .map(h => `${h.date}: ${h.name}`)
    .slice(0, 5);
}

// Helper functions for calculating holiday dates
function getFirstMonday(year, month) {
  const date = new Date(year, month, 1);
  while (date.getDay() !== 1) date.setDate(date.getDate() + 1);
  return date.toISOString().split('T')[0];
}

function getSecondMonday(year, month) {
  const date = new Date(year, month, 1);
  let count = 0;
  while (count < 2) {
    if (date.getDay() === 1) count++;
    if (count < 2) date.setDate(date.getDate() + 1);
  }
  return date.toISOString().split('T')[0];
}

function getThirdMonday(year, month) {
  const date = new Date(year, month, 1);
  let count = 0;
  while (count < 3) {
    if (date.getDay() === 1) count++;
    if (count < 3) date.setDate(date.getDate() + 1);
  }
  return date.toISOString().split('T')[0];
}

function getFourthThursday(year, month) {
  const date = new Date(year, month, 1);
  let count = 0;
  while (count < 4) {
    if (date.getDay() === 4) count++;
    if (count < 4) date.setDate(date.getDate() + 1);
  }
  return date.toISOString().split('T')[0];
}

function getLastMonday(year, month) {
  const date = new Date(year, month + 1, 0); // Last day of month
  while (date.getDay() !== 1) date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0];
}

/**
 * Build response text from action proposal
 */
function buildResponseText(actionProposal) {
  let responseText = '';

  if (actionProposal.actionName) {
    // Multi-promotion (Step 1 - no Apply button)
    if (actionProposal.needsImpactAnalysis && actionProposal.proposals) {
      responseText = `Based on current market conditions, here are my recommended promotions:\n\n`;
      actionProposal.proposals.forEach((p, i) => {
        responseText += `${i + 1}. ${p.description}\n   Reason: ${p.reason}\n\n`;
      });
      responseText += `\n${actionProposal.promptForImpact}`;
    }
    // Impact analysis (Step 2 - show Apply button)
    else if (actionProposal.isImpactAnalysis && actionProposal.proposals) {
      responseText = `Here is the detailed impact analysis for all ${actionProposal.proposals.length} promotions:\n\n`;

      if (actionProposal.summary) {
        const s = actionProposal.summary;
        responseText += `OVERALL SUMMARY\n`;
        responseText += `Total Revenue Impact: $${s.totalCurrentRevenue.toLocaleString()} → $${s.totalProjectedRevenue.toLocaleString()} (${s.totalRevenueImpact >= 0 ? '+' : ''}$${s.totalRevenueImpact.toLocaleString()}, ${s.totalRevenueImpactPct}%)\n`;
        responseText += `Average Occupancy Change: ${s.avgOccupancyChange >= 0 ? '+' : ''}${s.avgOccupancyChange}%\n`;
        responseText += `Average RevPAR Change: ${s.avgRevPARChange >= 0 ? '+' : ''}$${s.avgRevPARChange}\n`;
        responseText += `Overall Risk: ${s.overallRisk.toUpperCase()}\n\n---\n\n`;
      }

      actionProposal.proposals.forEach((p, i) => {
        responseText += `${i + 1}. ${p.roomType} ($${p.currentPrice} → $${p.newPrice})\n\n`;
        responseText += `   Revenue: $${p.currentRevenue30Days.toLocaleString()} → $${p.projectedRevenue30Days.toLocaleString()} (${p.revenueImpact >= 0 ? '+' : ''}$${p.revenueImpact.toLocaleString()})\n`;
        responseText += `   Occupancy: ${p.currentOccupancy}% → ${p.projectedOccupancy}% (${p.occupancyChange >= 0 ? '+' : ''}${p.occupancyChange}%)\n`;
        responseText += `   RevPAR: $${p.currentRevPAR} → $${p.projectedRevPAR} (${p.revPARChange >= 0 ? '+' : ''}$${p.revPARChange})\n`;
        responseText += `   Risk: ${p.riskLevel.toUpperCase()}\n`;
        p.riskFactors.forEach(rf => { responseText += `   • ${rf}\n`; });
        responseText += `\n`;
      });

      responseText += `\nWould you like to apply all these promotions?`;
    }
    // Standard single action
    else {
      responseText = `${actionProposal.description}\n\n${actionProposal.reasoning}\n\n`;
      if (actionProposal.impact) {
        responseText += `Impact: `;
        if (actionProposal.impact.currentPrice && actionProposal.impact.newPrice) {
          responseText += `$${actionProposal.impact.currentPrice} → $${actionProposal.impact.newPrice}`;
        }
        if (actionProposal.impact.priceChange) {
          responseText += ` (${actionProposal.impact.priceChange})`;
        }
        responseText += '\n\n';
      }
      if (actionProposal.confidence) {
        responseText += `Confidence: ${Math.round(actionProposal.confidence * 100)}%\n\n`;
      }
      responseText += 'Would you like me to apply this change?';
    }
  } else {
    responseText = actionProposal.description || 'How can I help you with hotel pricing today?';
    if (actionProposal.suggestions) {
      responseText += '\n\nTry asking:\n' + actionProposal.suggestions.map(s => `• ${s}`).join('\n');
    }
  }

  return responseText;
}

module.exports = {
  buildSystemPrompt,
  buildResponseText
};
