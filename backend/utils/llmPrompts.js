/**
 * LLM System Prompts
 * Builds context-aware prompts for the AI assistant
 */

/**
 * Build system prompt with hotel context
 */
function buildSystemPrompt(contextData) {
  const now = new Date();
  const todayISO = now.toISOString().split('T')[0];
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const roomSummary = (contextData.rooms || []).map(r => {
    const type = r.room_type || r['Room Type'];
    const total = r.total_rooms || r['Total Rooms'] || 0;
    const price = r.base_price || r['Base Price'] || 0;
    return `${type}: ${total} rooms at $${price}`;
  }).join(', ');

  const totalRooms = (contextData.rooms || []).reduce((sum, r) =>
    sum + (parseInt(r.total_rooms || r['Total Rooms']) || 0), 0) || 33;

  const todayCheckIns = (contextData.reservations || []).filter(r => {
    const checkIn = r.check_in_date || r['Check In Date'];
    return checkIn === todayISO;
  }).length;

  const occupiedToday = (contextData.reservations || []).filter(r => {
    const checkIn = r.check_in_date || r['Check In Date'];
    const checkOut = r.check_out_date || r['Check Out Date'];
    const status = (r.Status || r.status || '').toLowerCase();
    return checkIn <= todayISO && checkOut > todayISO &&
           (status === 'confirmed' || status === 'in-house');
  }).length;

  const competitorSummary = (contextData.competitors || []).slice(0, 5).map(c => {
    const name = c.competitor_name || c['Competitor Name'];
    const price = c.avg_price || c['Avg Price'];
    return `${name}: $${price}`;
  }).join(', ');

  const reservationsByDate = {};
  (contextData.reservations || []).forEach(r => {
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

  const allReservations = (contextData.reservations || []).slice(0, 50).map(r => {
    const checkIn = r.check_in_date || r['Check In Date'];
    const checkOut = r.check_out_date || r['Check Out Date'];
    const roomType = r.room_type || r['Room Type'];
    const guest = r.guest_name || r['Guest Name'] || 'Guest';
    const status = r.Status || r.status || 'confirmed';
    return `${guest} | ${roomType} | ${checkIn} to ${checkOut} | ${status}`;
  }).join('\n');

  return `You are an AI hotel revenue assistant for Lily Hall Hotel. Connected to LIVE database.

=== TODAY: ${dateStr} (${todayISO}) ===

RULES: You HAVE live data access. NEVER say "I don't have access". Respond with specific data.

ROOMS (${totalRooms} total): ${roomSummary || 'Bernard: 8, LaRua: 6, Santiago: 10, Pilar: 5, Mariana: 4'}

TODAY: ${todayCheckIns} check-ins, ${occupiedToday}/${totalRooms} occupied (${Math.round(occupiedToday/totalRooms*100)}%)

NEXT 14 DAYS:
${upcomingDates.length > 0 ? upcomingDates.join('\n') : 'No upcoming reservations'}

RESERVATIONS:
${allReservations || 'None'}

COMPETITORS: ${competitorSummary || 'Hilton: $225, Margaritaville: $190, Hampton Inn: $165'}

ACTIONS: applyPriceOverride, applyTemporaryPricing, adjustRateClamp, applyPriceIncrease, updateCompetitorDifferential

DURATION: "2 weeks" = 14 days, "1 month" = 30 days, "weekend" = 2 days, "flash" = 4 hours

Be concise and data-driven.`;
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
