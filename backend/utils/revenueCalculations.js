/**
 * Revenue Management Calculations
 * Clean, reusable business logic for hotel pricing
 */

/**
 * Calculate occupancy rate for a room type
 * @param {Array} reservations - All reservations
 * @param {string} roomType - Room type to calculate for
 * @param {number} totalRooms - Total rooms of this type
 * @param {string} date - Target date (YYYY-MM-DD)
 * @returns {object} Occupancy data
 */
function calculateOccupancy(reservations, roomType, totalRooms, date = null) {
  const targetDate = date || new Date().toISOString().split('T')[0];

  // First try to get current occupancy for the target date
  const bookedRooms = reservations.filter(r => {
    const resType = (r.room_type || r['Room Type'] || '').split('(')[0].trim();
    if (resType !== roomType && !resType.toLowerCase().includes(roomType.toLowerCase())) {
      return false;
    }

    const status = (r.Status || r.status || '').toLowerCase();
    if (status !== 'confirmed' && status !== 'in-house' && status !== 'checked out') return false;

    const checkInRaw = r.check_in_date || r['Check In Date'] || r.checkInDate || '';
    const checkOutRaw = r.check_out_date || r['Check Out Date'] || r.checkOutDate || '';
    const checkIn = typeof checkInRaw === 'string' ? checkInRaw.split('T')[0] : (checkInRaw instanceof Date ? checkInRaw.toISOString().split('T')[0] : '');
    const checkOut = typeof checkOutRaw === 'string' ? checkOutRaw.split('T')[0] : (checkOutRaw instanceof Date ? checkOutRaw.toISOString().split('T')[0] : '');
    if (!checkIn || !checkOut) return false;

    return checkIn <= targetDate && checkOut > targetDate;
  }).length;

  let rate = totalRooms > 0 ? bookedRooms / totalRooms : 0;
  let isHistorical = false;

  // If no current bookings, calculate historical average occupancy from all data
  if (bookedRooms === 0 && reservations.length > 0) {
    // Count total room-nights for this room type from historical data
    const roomTypeReservations = reservations.filter(r => {
      const resType = (r.room_type || r['Room Type'] || '').split('(')[0].trim();
      const status = (r.Status || r.status || '').toLowerCase();
      return (resType === roomType || resType.toLowerCase().includes(roomType.toLowerCase())) &&
             (status === 'confirmed' || status === 'in-house' || status === 'checked out');
    });

    if (roomTypeReservations.length > 0) {
      // Calculate average daily bookings from historical data
      // Get date range of reservations
      const dates = roomTypeReservations.map(r => {
        const ciRaw = r.check_in_date || r['Check In Date'] || '';
        const ci = typeof ciRaw === 'string' ? ciRaw.split('T')[0] : (ciRaw instanceof Date ? ciRaw.toISOString().split('T')[0] : '');
        return ci;
      }).filter(d => d).sort();

      if (dates.length > 0) {
        const firstDate = new Date(dates[0]);
        const lastDate = new Date(dates[dates.length - 1]);
        const daySpan = Math.max(1, Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)));

        // Calculate total room-nights booked
        const totalNights = roomTypeReservations.reduce((sum, r) => {
          return sum + (parseInt(r.nights || r['Nights'] || 1));
        }, 0);

        // Average daily occupancy = total nights / day span / total rooms
        rate = Math.min(1, totalNights / daySpan / totalRooms);
        isHistorical = true;
      }
    }
  }

  return {
    bookedRooms: isHistorical ? Math.round(rate * totalRooms) : bookedRooms,
    totalRooms,
    rate: Math.min(rate, 1),
    percentage: Math.round(Math.min(rate, 1) * 100),
    status: rate > 0.8 ? 'high' : rate > 0.5 ? 'moderate' : 'low',
    isHistorical
  };
}

/**
 * Calculate competitor average for a room type
 * @param {Array} competitors - Competitor data
 * @param {string} roomType - Room type to match
 * @returns {object} Competitor analysis
 */
function calculateCompetitorAverage(competitors, roomType) {
  const matchingCompetitors = competitors.filter(c => {
    const compType = c.room_type || c['Room Type'] || '';
    return compType === roomType || compType.toLowerCase().includes(roomType.toLowerCase());
  });

  const prices = matchingCompetitors.map(c => parseFloat(c.avg_price || c['Avg Price'] || 0)).filter(p => p > 0);

  if (prices.length === 0) {
    return { average: 0, count: 0, prices: [], competitors: [] };
  }

  const average = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const min = Math.min(...prices);
  const max = Math.max(...prices);

  return {
    average: Math.round(average),
    min: Math.round(min),
    max: Math.round(max),
    count: prices.length,
    prices,
    competitors: matchingCompetitors.map(c => ({
      name: c.competitor_name || c['Competitor Name'] || 'Unknown',
      price: parseFloat(c.avg_price || c['Avg Price'] || 0)
    }))
  };
}

/**
 * Calculate revenue metrics
 * @param {Array} reservations - All reservations
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {object} Revenue metrics
 */
function calculateRevenue(reservations, startDate = null, endDate = null) {
  const start = startDate || new Date().toISOString().split('T')[0];
  const end = endDate || start;

  const filteredReservations = reservations.filter(r => {
    const status = (r.Status || r.status || '').toLowerCase();
    if (status !== 'confirmed' && status !== 'in-house') return false;

    const checkIn = r.check_in_date || r['Check In Date'] || r.checkInDate;
    const checkOut = r.check_out_date || r['Check Out Date'] || r.checkOutDate;
    if (!checkIn || !checkOut) return false;

    // Check if reservation overlaps with date range
    return checkIn <= end && checkOut > start;
  });

  let totalRevenue = 0;
  let totalNights = 0;

  filteredReservations.forEach(r => {
    const price = parseFloat(r['Total Price'] || r.totalPrice || r.price_per_night || r['Price per Night'] || 0);
    const nights = parseInt(r.nights || r['Nights'] || 1);
    totalRevenue += price;
    totalNights += nights;
  });

  const adr = filteredReservations.length > 0 ? totalRevenue / filteredReservations.length : 0;

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    bookingCount: filteredReservations.length,
    totalNights,
    averageDailyRate: Math.round(adr),
    revenuePerNight: totalNights > 0 ? Math.round(totalRevenue / totalNights) : 0
  };
}

/**
 * Calculate RevPAR (Revenue Per Available Room)
 * @param {number} adr - Average Daily Rate
 * @param {number} occupancyRate - Occupancy rate (0-1)
 * @returns {number} RevPAR
 */
function calculateRevPAR(adr, occupancyRate) {
  return Math.round(adr * occupancyRate);
}

/**
 * Suggest optimal price based on occupancy and competition
 * @param {object} room - Room data
 * @param {number} occupancyRate - Current occupancy (0-1)
 * @param {number} competitorAvg - Competitor average price
 * @returns {object} Pricing suggestion
 */
function suggestOptimalPrice(room, occupancyRate, competitorAvg) {
  const currentPrice = room.base_price || room['Base Price'] || room.currentPrice || 150;
  const floorPrice = room.floor_price || room['Floor Price'] || currentPrice * 0.8;
  const ceilingPrice = room.ceiling_price || room['Ceiling Price'] || currentPrice * 1.3;

  let suggestedPrice = currentPrice;
  let reasoning = [];
  let action = 'maintain';

  // High occupancy (>80%) - consider price increase
  if (occupancyRate > 0.8) {
    if (currentPrice < competitorAvg * 1.1) {
      suggestedPrice = Math.min(currentPrice * 1.1, competitorAvg * 1.05, ceilingPrice);
      reasoning.push(`High occupancy (${Math.round(occupancyRate * 100)}%) supports price increase`);
      action = 'increase';
    }
  }
  // Low occupancy (<50%) - consider price decrease
  else if (occupancyRate < 0.5) {
    if (currentPrice > competitorAvg * 0.95) {
      suggestedPrice = Math.max(currentPrice * 0.95, competitorAvg * 0.9, floorPrice);
      reasoning.push(`Low occupancy (${Math.round(occupancyRate * 100)}%) suggests price reduction to stimulate demand`);
      action = 'decrease';
    }
  }

  // Competitor positioning
  const marketPosition = (currentPrice - competitorAvg) / competitorAvg * 100;
  if (marketPosition > 15) {
    reasoning.push(`Currently ${Math.round(marketPosition)}% above market - monitor conversion rates`);
  } else if (marketPosition < -15) {
    reasoning.push(`Currently ${Math.abs(Math.round(marketPosition))}% below market - opportunity to increase`);
  }

  suggestedPrice = Math.round(suggestedPrice);
  const change = suggestedPrice - currentPrice;
  const changePct = currentPrice > 0 ? (change / currentPrice) * 100 : 0;

  return {
    currentPrice,
    suggestedPrice,
    change,
    changePct: Math.round(changePct * 10) / 10,
    action,
    reasoning: reasoning.length > 0 ? reasoning.join('. ') : 'Price is appropriately positioned',
    competitorAvg,
    occupancyRate: Math.round(occupancyRate * 100),
    floorPrice: Math.round(floorPrice),
    ceilingPrice: Math.round(ceilingPrice)
  };
}

/**
 * Estimate revenue impact of a price change
 * @param {number} currentPrice - Current price
 * @param {number} newPrice - Proposed new price
 * @param {number} currentOccupancy - Current occupancy rate (0-1)
 * @param {number} totalRooms - Total rooms available
 * @param {number} days - Number of days to project
 * @returns {object} Revenue impact estimate
 */
function estimateRevenueImpact(currentPrice, newPrice, currentOccupancy, totalRooms, days = 30) {
  const priceChange = (newPrice - currentPrice) / currentPrice;

  // Simple demand elasticity: -1.5% occupancy per 1% price increase
  const elasticity = -1.5;
  const occupancyChange = priceChange * elasticity / 100;
  const newOccupancy = Math.max(0.1, Math.min(0.98, currentOccupancy + (currentOccupancy * occupancyChange)));

  const currentRevenue = currentPrice * totalRooms * currentOccupancy * days;
  const projectedRevenue = newPrice * totalRooms * newOccupancy * days;
  const revenueDelta = projectedRevenue - currentRevenue;

  return {
    currentRevenue: Math.round(currentRevenue),
    projectedRevenue: Math.round(projectedRevenue),
    revenueDelta: Math.round(revenueDelta),
    revenueDeltaPct: Math.round((revenueDelta / currentRevenue) * 100 * 10) / 10,
    currentOccupancy: Math.round(currentOccupancy * 100),
    projectedOccupancy: Math.round(newOccupancy * 100),
    occupancyDelta: Math.round((newOccupancy - currentOccupancy) * 100),
    priceChange: Math.round(priceChange * 100 * 10) / 10,
    days,
    riskLevel: Math.abs(priceChange) > 0.15 ? 'high' : Math.abs(priceChange) > 0.08 ? 'medium' : 'low'
  };
}

/**
 * Analyze underperforming rooms
 * @param {Array} rooms - Room data with occupancy
 * @param {number} threshold - Occupancy threshold (0-1)
 * @returns {Array} Underperforming rooms with recommendations
 */
function findUnderperformingRooms(rooms, threshold = 0.5) {
  return rooms
    .filter(r => (r.occupancy || 0) < threshold)
    .map(r => ({
      roomType: r.room_type || r['Room Type'] || r.name,
      currentOccupancy: Math.round((r.occupancy || 0) * 100),
      currentPrice: r.base_price || r['Base Price'] || r.currentPrice,
      issue: r.occupancy < 0.3 ? 'critically-low' : 'below-target',
      recommendation: r.occupancy < 0.3
        ? 'Consider 10-15% price reduction or promotional package'
        : 'Consider 5-8% price adjustment or marketing push'
    }))
    .sort((a, b) => a.currentOccupancy - b.currentOccupancy);
}

module.exports = {
  calculateOccupancy,
  calculateCompetitorAverage,
  calculateRevenue,
  calculateRevPAR,
  suggestOptimalPrice,
  estimateRevenueImpact,
  findUnderperformingRooms
};
