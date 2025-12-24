
function movingAverage(data, window = 7) {
  if (data.length < window) return data[data.length - 1] || 0;
  
  const recent = data.slice(-window);
  return recent.reduce((sum, val) => sum + val, 0) / window;
}

function exponentialSmoothing(data, alpha = 0.3) {
  if (data.length === 0) return 0;
  
  let smoothed = data[0];
  for (let i = 1; i < data.length; i++) {
    smoothed = alpha * data[i] + (1 - alpha) * smoothed;
  }
  return smoothed;
}
function forecastOccupancy(reservations, rooms, daysAhead = 7) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const totalRooms = rooms.reduce((sum, r) => sum + (r.total_rooms || r['Total Rooms']), 0);
  
  // Calculate historical occupancy rates for past 30 days
  const historicalRates = [];
  for (let i = 30; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const bookedCount = reservations.filter(r => {
      const checkIn = r.check_in_date || r['Check In Date'];
      const checkOut = r.check_out_date || r['Check Out Date'];
      return checkIn <= dateStr && checkOut > dateStr &&
             (r.status || r.Status || '').toLowerCase() === 'confirmed';
    }).length;
    
    historicalRates.push(bookedCount / totalRooms);
  }
  
  // Generate forecasts for next N days
  const forecasts = [];
  for (let i = 1; i <= daysAhead; i++) {
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + i);
    const dayOfWeek = targetDate.getDay();
    
    // Base forecast using exponential smoothing
    let baseForecast = exponentialSmoothing(historicalRates);
    
    // Adjust for day of week (weekends typically higher)
    const weekendBoost = (dayOfWeek === 5 || dayOfWeek === 6) ? 1.15 : 1.0;
    const sundayDip = (dayOfWeek === 0) ? 0.95 : 1.0;
    
    let forecast = baseForecast * weekendBoost * sundayDip;
    forecast = Math.max(0, Math.min(1, forecast)); // Clamp between 0 and 1
    
    // Calculate confidence based on data variance
    const variance = historicalRates.reduce((sum, rate) => {
      return sum + Math.pow(rate - baseForecast, 2);
    }, 0) / historicalRates.length;
    const confidence = Math.max(0.5, 1 - variance * 2);
    
    forecasts.push({
      date: targetDate.toISOString().split('T')[0],
      dayOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek],
      forecastOccupancy: forecast,
      estimatedRoomsBooked: Math.round(forecast * totalRooms),
      confidence: confidence.toFixed(2),
      recommendation: forecast > 0.8 ? 'High demand - consider rate increase' :
                     forecast < 0.5 ? 'Low demand - consider promotions' :
                     'Moderate demand - maintain rates'
    });
  }
  
  return {
    currentOccupancy: historicalRates[historicalRates.length - 1],
    trend: historicalRates[historicalRates.length - 1] > movingAverage(historicalRates, 7) ? 'increasing' : 'decreasing',
    forecasts
  };
}

/**
 * Recommend optimal pricing based on demand forecast
 */
function getDemandBasedPricing(room, forecast, competitors) {
  const basePrice = room.base_price || room['Base Price'];
  
  // Get average forecast for next 3 days
  const avgForecast = forecast.forecasts.slice(0, 3).reduce((sum, f) => sum + f.forecastOccupancy, 0) / 3;
  
  let pricingMultiplier = 1.0;
  
  if (avgForecast > 0.85) {
    pricingMultiplier = 1.15; // High demand: +15%
  } else if (avgForecast > 0.7) {
    pricingMultiplier = 1.08; // Good demand: +8%
  } else if (avgForecast < 0.4) {
    pricingMultiplier = 0.92; // Low demand: -8%
  } else if (avgForecast < 0.55) {
    pricingMultiplier = 0.96; // Below average: -4%
  }
  
  const suggestedPrice = Math.round(basePrice * pricingMultiplier * 100) / 100;
  
  return {
    basePrice,
    suggestedPrice,
    multiplier: pricingMultiplier,
    demandLevel: avgForecast > 0.7 ? 'High' : avgForecast > 0.5 ? 'Moderate' : 'Low',
    expectedOccupancy: (avgForecast * 100).toFixed(0) + '%',
    reasoning: `Forecast ${(avgForecast * 100).toFixed(0)}% occupancy over next 3 days suggests ${pricingMultiplier > 1 ? 'increasing' : pricingMultiplier < 1 ? 'decreasing' : 'maintaining'} prices.`
  };
}

module.exports = {
  forecastOccupancy,
  getDemandBasedPricing,
  movingAverage,
  exponentialSmoothing
};
