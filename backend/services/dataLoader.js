const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser');

class DataLoader {
  constructor() {
    this.rooms = [];
    this.reservations = [];
    this.competitors = [];
    this.loaded = false;
  }

  async loadCSV(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', (error) => reject(error));
    });
  }

  async loadAllData() {
    try {
      const dataDir = path.resolve(__dirname, '../data/csv');

      // Load reservations from Lily Hall Reservations.csv
      const rawReservations = await this.loadCSV(path.join(dataDir, 'Lily Hall Reservations.csv'));

      // Map Lily Hall CSV columns to our format
      this.reservations = rawReservations.map(res => {
        // Parse dates from MM/DD/YYYY format
        const parseDate = (dateStr) => {
          if (!dateStr) return null;
          const parts = dateStr.split('/');
          if (parts.length === 3) {
            return new Date(`${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`);
          }
          return new Date(dateStr);
        };

        // Get base room type (without promotional suffix like "(Book Now, Pay Later)")
        const rawRoomType = res['Room Type'] || '';
        const baseRoomType = rawRoomType.split('(')[0].trim();

        // Calculate price per night from Accommodation Total and Nights
        const nights = parseInt(res['Nights']) || 1;
        const accommodationTotal = parseFloat((res['Accommodation Total'] || '0').replace(/[^0-9.]/g, '')) || 0;
        const pricePerNight = nights > 0 ? accommodationTotal / nights : accommodationTotal;

        return {
          booking_id: res['Reservation Number'] || '',
          guest_name: res['Name'] || '',
          room_type: baseRoomType,
          room_number: res['Room Number'] || '',
          check_in_date: parseDate(res['Check in Date']),
          check_out_date: parseDate(res['Check out Date']),
          price_per_night: pricePerNight,
          accommodation_total: accommodationTotal,
          grand_total: parseFloat((res['Grand Total'] || '0').replace(/[^0-9.]/g, '')) || 0,
          nights: nights,
          status: res['Status'] || '',
          booking_date: parseDate(res['Reservation Date']),
          source: res['Source'] || '',
          adults: parseInt(res['Adults']) || 1,
          children: parseInt(res['Children']) || 0
        };
      }).filter(res => res.room_type && res.check_in_date);

      // Valid base room types for Lily Hall
      const validRoomTypes = ['Bernard', 'LaRua', 'Santiago', 'Pilar', 'Mariana'];

      // Extract room types and calculate base prices from reservation data
      const roomTypeStats = {};
      this.reservations.forEach(res => {
        if (!res.room_type || res.price_per_night <= 0) return;

        // Only count single room type reservations (ignore multi-room bookings)
        const roomType = res.room_type.trim();
        if (!validRoomTypes.includes(roomType)) return;

        if (!roomTypeStats[roomType]) {
          roomTypeStats[roomType] = {
            prices: [],
            roomNumbers: new Set()
          };
        }
        roomTypeStats[roomType].prices.push(res.price_per_night);
        if (res.room_number && res.room_number !== 'N/A' && !res.room_number.includes(',')) {
          roomTypeStats[roomType].roomNumbers.add(res.room_number);
        }
      });

      // Create rooms array with calculated base prices
      // Use fixed room counts and ensure all 5 room types exist
      const roomDefaults = {
        'Bernard': { totalRooms: 8, defaultPrice: 165 },
        'LaRua': { totalRooms: 6, defaultPrice: 195 },
        'Santiago': { totalRooms: 10, defaultPrice: 215 },
        'Pilar': { totalRooms: 5, defaultPrice: 240 },
        'Mariana': { totalRooms: 4, defaultPrice: 399 }
      };

      this.rooms = validRoomTypes.map(roomType => {
        const stats = roomTypeStats[roomType];
        const defaults = roomDefaults[roomType];

        let basePrice = defaults.defaultPrice;
        if (stats && stats.prices.length > 0) {
          // Use median price as base price (more stable than average)
          const sortedPrices = stats.prices.sort((a, b) => a - b);
          basePrice = Math.round(sortedPrices[Math.floor(sortedPrices.length / 2)]);
        }

        return {
          room_type: roomType,
          total_rooms: defaults.totalRooms,
          base_price: basePrice,
          rate_floor: Math.round(basePrice * 0.8),
          rate_ceiling: Math.round(basePrice * 1.5)
        };
      });

      // Sort rooms by price (cheapest first)
      this.rooms.sort((a, b) => a.base_price - b.base_price);

      // Load competitors
      this.competitors = await this.loadCSV(path.join(dataDir, 'competitors.csv'));
      this.competitors = this.competitors.map(comp => ({
        ...comp,
        avg_price: parseFloat(comp.avg_price)
      }));

      this.loaded = true;
      console.log('✓ CSV data loaded successfully');
      console.log(`  - Rooms: ${this.rooms.length} types`);
      console.log(`  - Reservations: ${this.reservations.length} bookings`);
      console.log(`  - Competitors: ${this.competitors.length} entries`);

      return true;
    } catch (error) {
      console.error('Error loading CSV data:', error);
      throw error;
    }
  }

  getTotalRooms() {
    return this.rooms.reduce((sum, room) => sum + room.total_rooms, 0);
  }

  getRoomsBookedToday() {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    return this.reservations.filter(res => {
      const status = (res.status || res.Status || '').toLowerCase();
      // Include 'confirmed' and 'in-house' as active bookings
      if (status !== 'confirmed' && status !== 'in-house') return false;

      const checkIn = res.check_in_date || res['Check In Date'] || res.checkInDate;
      const checkOut = res.check_out_date || res['Check Out Date'] || res.checkOutDate;
      if (!checkIn || !checkOut) return false;

      // Check if reservation spans today (check-in <= today < check-out)
      return checkIn <= today && checkOut > today;
    }).length;
  }

  getOccupancyRate() {
    const total = this.getTotalRooms();
    const booked = this.getRoomsBookedToday();
    return total > 0 ? ((booked / total) * 100).toFixed(1) : 0;
  }

  getRevenueToday() {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    return this.reservations
      .filter(res => {
        const status = (res.status || res.Status || '').toLowerCase();
        if (status !== 'confirmed' && status !== 'in-house') return false;

        const checkIn = res.check_in_date || res['Check In Date'] || res.checkInDate;
        const checkOut = res.check_out_date || res['Check Out Date'] || res.checkOutDate;
        if (!checkIn || !checkOut) return false;

        return checkIn <= today && checkOut > today;
      })
      .reduce((sum, res) => sum + (res.price_per_night || 0), 0);
  }

  getTotalRevenue() {
    return this.reservations
      .filter(res => {
        const status = (res.status || res.Status || '').toLowerCase();
        return status === 'confirmed' || status === 'completed' || status === 'checked out';
      })
      .reduce((sum, res) => {
        const checkIn = new Date(res.check_in_date || res['Check In Date']);
        const checkOut = new Date(res.check_out_date || res['Check Out Date']);
        const nights = Math.max(1, Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24)));
        return sum + ((res.price_per_night || 0) * nights);
      }, 0);
  }

  getBookingsByRoomType() {
    const today = new Date().toISOString().split('T')[0];
    const bookings = {};

    this.reservations
      .filter(res => {
        const status = (res.status || res.Status || '').toLowerCase();
        if (status !== 'confirmed' && status !== 'in-house') return false;

        const checkIn = res.check_in_date || res['Check In Date'] || res.checkInDate;
        const checkOut = res.check_out_date || res['Check Out Date'] || res.checkOutDate;
        if (!checkIn || !checkOut) return false;

        // Only count reservations active today
        return checkIn <= today && checkOut > today;
      })
      .forEach(res => {
        const roomType = res.room_type || res['Room Type'] || 'Unknown';
        // Get base room type (without promotional suffix)
        const baseType = roomType.split('(')[0].trim();
        bookings[baseType] = (bookings[baseType] || 0) + 1;
      });
    return bookings;
  }

  getCompetitorPricing(roomType) {
    return this.competitors
      .filter(comp => comp.room_type === roomType)
      .map(comp => ({
        name: comp.competitor_name,
        price: comp.avg_price
      }));
  }

  getAverageCompetitorPrice(roomType) {
    const competitors = this.competitors.filter(comp => comp.room_type === roomType);
    if (competitors.length === 0) return 0;

    const total = competitors.reduce((sum, comp) => sum + comp.avg_price, 0);
    return total / competitors.length;
  }

  getSummary() {
    return {
      totalRooms: this.getTotalRooms(),
      roomsBookedToday: this.getRoomsBookedToday(),
      occupancyRate: parseFloat(this.getOccupancyRate()),
      revenueToday: this.getRevenueToday(),
      totalRevenue: this.getTotalRevenue(),
      bookingsByRoomType: this.getBookingsByRoomType()
    };
  }

  getBookingsInDateRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return this.reservations.filter(res => {
      const checkIn = new Date(res.check_in_date);
      return checkIn >= start && checkIn <= end && res.status === 'Confirmed';
    });
  }

  // Get bookings overlapping a specific date (confirmed only)
  getBookingsForDate(dateString) {
    const targetDate = new Date(dateString);
    targetDate.setHours(0, 0, 0, 0);
    
    return this.reservations.filter(res => {
      const checkIn = new Date(res.check_in_date);
      const checkOut = new Date(res.check_out_date);
      checkIn.setHours(0, 0, 0, 0);
      checkOut.setHours(0, 0, 0, 0);
      
      const status = (res.status || res.Status || '').toLowerCase();
      return (
        status === 'confirmed' &&
        checkIn <= targetDate &&
        checkOut > targetDate
      );
    });
  }

  // Weekend bookings by check-in day (Fri, Sat, Sun)
  getWeekendBookings() {
    return this.reservations.filter(res => {
      const checkIn = new Date(res.check_in_date);
      const day = checkIn.getDay(); // 0=Sun, 6=Sat
      return day === 5 || day === 6 || day === 0;
    });
  }

  // Weekday bookings by check-in day (Mon-Thu)
  getWeekdayBookings() {
    return this.reservations.filter(res => {
      const checkIn = new Date(res.check_in_date);
      const day = checkIn.getDay();
      return day >= 1 && day <= 4;
    });
  }

  updateRoomPrice(roomType, newPrice) {
    const room = this.rooms.find(r => r.room_type === roomType);
    if (room) {
      room.base_price = newPrice;
      return true;
    }
    return false;
  }
}

// Create singleton instance
const dataLoader = new DataLoader();

module.exports = dataLoader;