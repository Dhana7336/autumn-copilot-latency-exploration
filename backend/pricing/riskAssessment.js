
function assessPriceChangeRisk(room, newPrice, occupancyForecast, competitors) {
  const currentPrice = room.base_price || room['Base Price'];
  const priceChange = newPrice - currentPrice;
  const priceChangePct = (priceChange / currentPrice) * 100;
  
  // Calculate competitor positioning risk
  const competitorPrices = competitors
    .filter(c => (c.room_type || c['Room Type']) === (room.room_type || room['Room Type']))
    .map(c => c.avg_price || c['Avg Price']);
  
  const marketAvg = competitorPrices.length > 0 
    ? competitorPrices.reduce((sum, p) => sum + p, 0) / competitorPrices.length
    : currentPrice;
  
  const marketDeviation = ((newPrice - marketAvg) / marketAvg) * 100;
  
  // Risk factors
  const risks = [];
  let overallRisk = 'low';
  let riskScore = 0;
  
  // Price increase risks
  if (priceChangePct > 10) {
    risks.push(`Large price increase (${priceChangePct.toFixed(0)}%) may reduce demand`);
    riskScore += 30;
  } else if (priceChangePct > 5) {
    risks.push(`Moderate price increase may impact booking conversion`);
    riskScore += 15;
  }
  
  // Price decrease risks
  if (priceChangePct < -10) {
    risks.push(`Significant price reduction may signal desperation`);
    riskScore += 20;
  } else if (priceChangePct < -5) {
    risks.push(`Price decrease will reduce revenue per booking`);
    riskScore += 10;
  }
  
  // Market positioning risks
  if (marketDeviation > 20) {
    risks.push(`Price ${marketDeviation.toFixed(0)}% above market average - high elasticity risk`);
    riskScore += 25;
  } else if (marketDeviation < -20) {
    risks.push(`Price ${Math.abs(marketDeviation).toFixed(0)}% below market - leaving money on table`);
    riskScore += 15;
  }
  
  // Occupancy-based risks
  const avgOccupancy = occupancyForecast.forecasts
    .slice(0, 3)
    .reduce((sum, f) => sum + f.forecastOccupancy, 0) / 3;
  
  if (avgOccupancy > 0.85 && priceChangePct < 0) {
    risks.push(`High demand (${(avgOccupancy * 100).toFixed(0)}%) suggests price increase, not decrease`);
    riskScore += 20;
  }
  
  if (avgOccupancy < 0.5 && priceChangePct > 5) {
    risks.push(`Low occupancy (${(avgOccupancy * 100).toFixed(0)}%) makes price increase risky`);
    riskScore += 25;
  }
  
  // Calculate overall risk level
  if (riskScore > 50) overallRisk = 'high';
  else if (riskScore > 25) overallRisk = 'medium';
  
  // Calculate potential impact
  const totalRooms = room.total_rooms || room['Total Rooms'];
  const currentRevenue = currentPrice * totalRooms * avgOccupancy * 30;
  
  // Estimate demand elasticity impact
  let elasticityImpact = 1.0;
  if (priceChangePct > 0) {
    elasticityImpact = 1 - (priceChangePct * 0.015); // -1.5% occupancy per 1% price increase
  } else if (priceChangePct < 0) {
    elasticityImpact = 1 + (Math.abs(priceChangePct) * 0.01); // +1% occupancy per 1% price decrease
  }
  
  const projectedOccupancy = Math.max(0, Math.min(1, avgOccupancy * elasticityImpact));
  const projectedRevenue = newPrice * totalRooms * projectedOccupancy * 30;
  const revenueImpact = projectedRevenue - currentRevenue;
  const revenueImpactPct = (revenueImpact / currentRevenue) * 100;
  
  return {
    riskLevel: overallRisk,
    riskScore,
    risks,
    priceChange: priceChangePct.toFixed(1) + '%',
    marketDeviation: marketDeviation.toFixed(1) + '%',
    impact: {
      currentMonthlyRevenue: currentRevenue.toFixed(0),
      projectedMonthlyRevenue: projectedRevenue.toFixed(0),
      revenueDelta: revenueImpact.toFixed(0),
      revenueDeltaPct: revenueImpactPct.toFixed(1) + '%',
      occupancyChange: ((projectedOccupancy - avgOccupancy) * 100).toFixed(1) + '%'
    },
    recommendation: overallRisk === 'high' 
      ? 'Not recommended - high risk of negative impact'
      : overallRisk === 'medium'
      ? 'Proceed with caution - monitor closely'
      : 'Low risk - proceed with change'
  };
}

/**
 * Compare multiple pricing scenarios
 */
function compareScenarios(room, scenarios, occupancyForecast, competitors) {
  return scenarios.map(scenario => {
    const assessment = assessPriceChangeRisk(room, scenario.price, occupancyForecast, competitors);
    return {
      scenario: scenario.name,
      price: scenario.price,
      risk: assessment.riskLevel,
      projectedRevenue: assessment.impact.projectedMonthlyRevenue,
      revenueDelta: assessment.impact.revenueDelta,
      recommendation: assessment.recommendation
    };
  }).sort((a, b) => parseFloat(b.projectedRevenue) - parseFloat(a.projectedRevenue));
}

module.exports = {
  assessPriceChangeRisk,
  compareScenarios
};
