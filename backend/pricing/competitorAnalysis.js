
function analyzeCompetitors(room, competitors, allRooms) {
  const roomType = room.room_type || room['Room Type'];
  const currentPrice = room.base_price || room['Base Price'];
  const relevantCompetitors = competitors.filter(c => 
    (c.room_type || c['Room Type']) === roomType
  );
  
  if (relevantCompetitors.length === 0) {
    return {
      position: 'unknown',
      priceGap: 0,
      competitorCount: 0,
      recommendation: 'No competitor data available'
    };
  }
  
  // Calculate market statistics
  const competitorPrices = relevantCompetitors.map(c => c.avg_price || c['Avg Price']);
  const marketAvg = competitorPrices.reduce((sum, p) => sum + p, 0) / competitorPrices.length;
  const marketMin = Math.min(...competitorPrices);
  const marketMax = Math.max(...competitorPrices);
  
  // Determine position
  const priceGap = currentPrice - marketAvg;
  const priceGapPct = (priceGap / marketAvg) * 100;
  
  let position = 'competitive';
  if (currentPrice < marketMin * 0.95) position = 'budget';
  else if (currentPrice < marketAvg * 0.95) position = 'value';
  else if (currentPrice > marketMax * 1.05) position = 'ultra-premium';
  else if (currentPrice > marketAvg * 1.05) position = 'premium';
  
  // Generate recommendation
  let recommendation = '';
  if (position === 'budget') {
    recommendation = `Priced ${Math.abs(priceGapPct).toFixed(0)}% below market. Consider increasing rates to capture more revenue.`;
  } else if (position === 'value') {
    recommendation = `Slightly below market average. Good position for high occupancy strategy.`;
  } else if (position === 'premium') {
    recommendation = `Premium positioning. Ensure service quality justifies higher rates.`;
  } else if (position === 'ultra-premium') {
    recommendation = `Significantly above market. Monitor booking pace closely.`;
  } else {
    recommendation = `Well-positioned at market average. Monitor competitors for changes.`;
  }
  
  // Competitive threats
  const threats = relevantCompetitors
    .filter(c => {
      const compPrice = c.avg_price || c['Avg Price'];
      return compPrice < currentPrice * 0.9;
    })
    .map(c => ({
      name: c.competitor_name || c['Competitor Name'],
      price: c.avg_price || c['Avg Price'],
      discount: ((currentPrice - (c.avg_price || c['Avg Price'])) / currentPrice * 100).toFixed(0) + '%'
    }));
  
  return {
    position,
    priceGap,
    priceGapPct,
    marketAvg,
    marketMin,
    marketMax,
    competitorCount: relevantCompetitors.length,
    competitors: relevantCompetitors.map(c => ({
      name: c.competitor_name || c['Competitor Name'],
      price: c.avg_price || c['Avg Price']
    })),
    threats,
    recommendation
  };
}

/**
 * Get market share estimate based on pricing
 */
function estimateMarketShare(rooms, competitors) {
  const totalRoomInventory = rooms.reduce((sum, r) => sum + (r.total_rooms || r['Total Rooms']), 0);
  
  return rooms.map(room => {
    const analysis = analyzeCompetitors(room, competitors, rooms);
    
    // Estimate market share based on price position
    let shareEstimate = 0.33; // default
    if (analysis.position === 'budget') shareEstimate = 0.45;
    else if (analysis.position === 'value') shareEstimate = 0.40;
    else if (analysis.position === 'premium') shareEstimate = 0.25;
    else if (analysis.position === 'ultra-premium') shareEstimate = 0.15;
    
    return {
      roomType: room.room_type || room['Room Type'],
      position: analysis.position,
      estimatedShare: shareEstimate,
      potentialRevenue: (room.base_price || room['Base Price']) * (room.total_rooms || room['Total Rooms']) * 30 * shareEstimate
    };
  });
}

module.exports = {
  analyzeCompetitors,
  estimateMarketShare
};
