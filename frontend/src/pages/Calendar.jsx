import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Calendar,
  MessageSquare,
  LayoutDashboard,
  Settings,
  LogOut,
  RefreshCw
} from 'lucide-react';

export default function CalendarPage() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date()); // Today's date
  const [roomFilter, setRoomFilter] = useState('All');
  const [searchGuest, setSearchGuest] = useState('');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [overrides, setOverrides] = useState([]);
  const [viewMode, setViewMode] = useState('month'); // 'month' or 'day'
  const [selectedDayDate, setSelectedDayDate] = useState(null); // For day view

  // Room types - dynamically derived from loaded rooms
  const roomTypes = React.useMemo(() => {
    const types = [...new Set(rooms.map(r => r.type))];
    return ['All', ...types];
  }, [rooms]);
  const statusColors = {
    Available: 'bg-green-100 border-green-400',
    Booked: 'bg-orange-100 border-orange-400',
    Occupied: 'bg-blue-100 border-blue-400',
    Dirty: 'bg-gray-100 border-gray-400'
  };

  // Load user from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('autumnUser');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.error('Error parsing user data:', err);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('autumnUser');
    localStorage.removeItem('autumnAuth');
    navigate('/');
  };

  // Function to load data (extracted so we can call it on demand)
  const loadData = async () => {
    try {
        // Fetch rooms data - try both endpoints
        let roomsData = [];
        try {
          const roomsRes = await fetch('http://localhost:4001/api/copilot/rooms');
          const roomsJson = await roomsRes.json();
          // Handle both array response and object with rooms property
          roomsData = Array.isArray(roomsJson) ? roomsJson : (roomsJson.rooms || roomsJson.data || []);
        } catch (e) {
          // Fallback to /api/rooms
          try {
            const roomsRes = await fetch('http://localhost:4001/api/rooms');
            const roomsJson = await roomsRes.json();
            roomsData = Array.isArray(roomsJson) ? roomsJson : (roomsJson.rooms || roomsJson.data || []);
          } catch (e2) {
            console.log('Rooms API not available:', e2);
          }
        }

        console.log('Rooms data received:', roomsData);

        // Parse room types and create room list
        const roomList = [];
        if (roomsData && Array.isArray(roomsData) && roomsData.length > 0) {
          roomsData.forEach((room, idx) => {
            const totalCount = parseInt(room.total_rooms || room['Total Rooms']) || 5;
            const typeKey = room.room_type || room['Room Type'] || 'Room';
            const basePrice = parseFloat(room.base_price || room['Base Price']) || 150;
            // Create individual room entries
            for (let i = 1; i <= Math.min(totalCount, 10); i++) {
              roomList.push({
                id: `${typeKey.substring(0, 3).toUpperCase()}${String(i).padStart(2, '0')}`,
                type: typeKey,
                floor: Math.ceil(i / 5),
                price: basePrice
              });
            }
          });
        }

        console.log('Room list created:', roomList.length, 'rooms');
        
        // Fetch price overrides
        let overridesData = [];
        try {
          const overridesRes = await fetch('http://localhost:4001/api/copilot/actions/config');
          const overridesJson = await overridesRes.json();
          // Handle different response structures
          overridesData = overridesJson.data?.overrides || overridesJson.overrides || [];
          console.log('Loaded overrides:', overridesData.length);
        } catch (e) {
          console.log('Overrides API not available:', e);
          overridesData = [];
        }
        setOverrides(overridesData);

        // Fetch reservations data
        let reservationsRes, reservationsData = [];
        try {
          reservationsRes = await fetch('http://localhost:4001/api/copilot/reservations');
          const resData = await reservationsRes.json();
          reservationsData = resData.data || (Array.isArray(resData) ? resData : []);
        } catch (e) {
          console.log('Reservations API not available:', e);
          reservationsData = [];
        }
        
        const bookingList = [];
        if (Array.isArray(reservationsData)) {
          reservationsData.forEach((res, idx) => {
            const guestName = res.guest_name || 'Unknown';
            let roomType = res.room_type || 'Unknown';
            // Extract base room type (remove promotional suffixes like "(Book Now, Pay Later)")
            const baseRoomType = roomType.split('(')[0].trim();

            const checkIn = new Date(res.check_in_date);
            const checkOut = new Date(res.check_out_date);

            // Skip invalid dates
            if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) return;

            const statusRaw = (res.status || '').toLowerCase();
            let status;
            if (statusRaw === 'confirmed' || statusRaw === 'in-house') {
              status = 'Occupied';
            } else if (statusRaw === 'pending') {
              status = 'Booked';
            } else if (statusRaw === 'completed' || statusRaw === 'checked out') {
              return; // Skip completed bookings
            } else if (statusRaw === 'cancelled') {
              return; // Skip cancelled bookings
            } else {
              status = 'Available';
            }
            bookingList.push({
              id: idx + 1,
              roomType: baseRoomType,
              guestName: guestName,
              checkIn: checkIn,
              checkOut: checkOut,
              status: status,
              payment: status === 'Occupied' ? 'Paid' : 'Pending'
            });
          });
        }
        
        console.log('Loaded rooms:', roomList.length, roomList);
        console.log('Loaded bookings:', bookingList.length);

        // If no rooms loaded from API, use fallback
        if (roomList.length === 0) {
          console.log('No rooms from API, using fallback data');
          const fallbackRooms = [
            { id: 'BER01', type: 'Bernard', floor: 1, price: 150 },
            { id: 'BER02', type: 'Bernard', floor: 1, price: 150 },
            { id: 'BER03', type: 'Bernard', floor: 1, price: 150 },
            { id: 'BER04', type: 'Bernard', floor: 1, price: 150 },
            { id: 'LAR01', type: 'LaRua', floor: 1, price: 150 },
            { id: 'LAR02', type: 'LaRua', floor: 1, price: 150 },
            { id: 'LAR03', type: 'LaRua', floor: 1, price: 150 },
            { id: 'SAN01', type: 'Santiago', floor: 1, price: 150 },
            { id: 'SAN02', type: 'Santiago', floor: 1, price: 150 },
            { id: 'SAN03', type: 'Santiago', floor: 1, price: 150 },
            { id: 'SAN04', type: 'Santiago', floor: 1, price: 150 },
            { id: 'SAN05', type: 'Santiago', floor: 1, price: 150 },
            { id: 'PIL01', type: 'Pilar', floor: 2, price: 150 },
            { id: 'PIL02', type: 'Pilar', floor: 2, price: 150 },
            { id: 'MAR01', type: 'Mariana', floor: 2, price: 150 },
            { id: 'MAR02', type: 'Mariana', floor: 2, price: 150 },
          ];
          setRooms(fallbackRooms);
        } else {
          setRooms(roomList.sort((a, b) => a.id.localeCompare(b.id)));
        }
        setBookings(bookingList);
        setLoading(false);
      } catch (err) {
        console.error('Error loading data:', err);
        // Fallback to Lily Hall room types
        const mockRooms = [
          { id: 'BER01', type: 'Bernard', floor: 1, price: 150 },
          { id: 'BER02', type: 'Bernard', floor: 1, price: 150 },
          { id: 'LAR01', type: 'LaRua', floor: 1, price: 150 },
          { id: 'LAR02', type: 'LaRua', floor: 1, price: 150 },
          { id: 'SAN01', type: 'Santiago', floor: 1, price: 150 },
          { id: 'SAN02', type: 'Santiago', floor: 1, price: 150 },
          { id: 'PIL01', type: 'Pilar', floor: 2, price: 150 },
          { id: 'MAR01', type: 'Mariana', floor: 2, price: 150 },
        ];
        setRooms(mockRooms);
        setBookings([]);
        setLoading(false);
      }
  };

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  // Reload data when window gains focus (e.g., switching from Chat to Calendar)
  useEffect(() => {
    const handleFocus = () => {
      console.log('Calendar page focused, refreshing data...');
      loadData();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const isDateInRange = (date, checkIn, checkOut) => {
    return date >= checkIn && date < checkOut;
  };

  const getBookingForRoomOnDate = (roomType, date) => {
    return bookings.find(
      b => b.roomType === roomType && isDateInRange(date, b.checkIn, b.checkOut)
    );
  };




  // Room type mapping: AI terminology -> Hotel room types
  const ROOM_TYPE_MAP = {
    'standard': 'Bernard', 'standardroom': 'Bernard', 'standard room': 'Bernard',
    'deluxe': 'LaRua', 'deluxeroom': 'LaRua', 'deluxe room': 'LaRua',
    'executive': 'Santiago', 'executivesuite': 'Santiago', 'executive suite': 'Santiago',
    'premium': 'Pilar', 'premiumsuite': 'Pilar', 'premium suite': 'Pilar',
    'presidential': 'Mariana', 'presidentialsuite': 'Mariana', 'presidential suite': 'Mariana',
    'bernard': 'Bernard', 'larua': 'LaRua', 'santiago': 'Santiago', 'pilar': 'Pilar', 'mariana': 'Mariana',
  };

  const mapToHotelRoomType = (input) => {
    if (!input) return input;
    const normalized = input.toLowerCase().replace(/\s+/g, '');
    return ROOM_TYPE_MAP[normalized] || input;
  };

  const roomTypesMatch = (type1, type2) => {
    if (!type1 || !type2) return false;
    const hotel1 = mapToHotelRoomType(type1).toLowerCase();
    const hotel2 = mapToHotelRoomType(type2).toLowerCase();
    return hotel1 === hotel2;
  };

  // Helper to get override price for a room type and date (YYYY-MM-DD)
  // Returns { price, isTemporary } or null
  const getOverridePrice = (roomType, date) => {
    const dateStr = date.toISOString().split('T')[0];

    // Filter all matching overrides for this room type and date
    const matchingOverrides = overrides.filter(o => {
      if (o.date !== dateStr) return false;
      // Check mappedRoomType first (more reliable), then fall back to roomId matching
      if (o.mappedRoomType) {
        return o.mappedRoomType.toLowerCase() === roomType.toLowerCase();
      }
      if (!o.roomId) return false;
      return roomTypesMatch(o.roomId, roomType);
    });

    // Get the latest override by timestamp
    if (matchingOverrides.length === 0) return null;

    const found = matchingOverrides.sort((a, b) =>
      new Date(b.timestamp || 0) - new Date(a.timestamp || 0)
    )[0];

    return {
      price: found.newPrice,
      isTemporary: found.isTemporary || false,
      tempOfferId: found.tempOfferId || null
    };
  };

  const getRoomStatus = (roomType, date) => {
    // Mark 2 demo cells as Dirty
    if (dirtyCells.includes(roomType + '-' + date.toDateString())) return 'Dirty';
    const booking = getBookingForRoomOnDate(roomType, date);
    if (booking) return booking.status;
    return 'Available';
  };

  const filteredRooms = rooms.filter(room => {
    if (roomFilter !== 'All' && room.type !== roomFilter) return false;
    return true;
  });

  // Get calendar dates for month view
  const getMonthDates = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const dates = [];

    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }
    return dates;
  };

  const calendarDates = getMonthDates();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Demo: randomly mark 2 cells as Dirty for the current month
  const dirtyCells = React.useMemo(() => {
    // Pick 2 random roomType-date pairs
    if (!rooms.length || !calendarDates.length) return [];
    const pairs = [];
    while (pairs.length < 2) {
      const rIdx = Math.floor(Math.random() * rooms.length);
      const dIdx = Math.floor(Math.random() * calendarDates.length);
      const key = rooms[rIdx].type + '-' + calendarDates[dIdx].toDateString();
      if (!pairs.includes(key)) pairs.push(key);
    }
    return pairs;
  }, [rooms, calendarDates]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-gray-500">Loading calendar...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar - Match Chat.jsx structure */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-gray-50 border-r border-gray-200 flex flex-col transition-all duration-200`}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className={`${sidebarOpen ? 'block' : 'hidden'}`}>
            <h1 className="text-xl font-bold text-purple-600">Autumn</h1>
            <p className="text-xs text-gray-500 mt-1">AI Copilot</p>
          </div>
          <button
            onClick={() => setSidebarOpen(prev => !prev)}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <button
            onClick={() => navigate('/chat')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 ${!sidebarOpen ? 'justify-center' : ''}`}
          >
            <MessageSquare size={22} />
            {sidebarOpen && <span>AI Copilot</span>}
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 ${!sidebarOpen ? 'justify-center' : ''}`}
          >
            <LayoutDashboard size={22} />
            {sidebarOpen && <span>Dashboard</span>}
          </button>
          <button className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-purple-100 text-purple-700 font-medium ${!sidebarOpen ? 'justify-center' : ''}`}>
            <Calendar size={22} />
            {sidebarOpen && <span>Calendar</span>}
          </button>
          <button
            onClick={() => navigate('/settings')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 ${!sidebarOpen ? 'justify-center' : ''}`}
          >
            <Settings size={22} />
            {sidebarOpen && <span>Settings</span>}
          </button>
        </nav>

        <div className="p-3 border-t border-gray-200">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm font-medium">
              {user?.firstName?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            {sidebarOpen && (
              <div className="flex-1 text-sm">
                <div className="font-medium text-gray-900">
                  {user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Admin'}
                </div>
                <div className="text-xs text-gray-500">{user?.email || 'admin@hotel.com'}</div>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 mt-2 rounded-lg text-gray-700 hover:bg-gray-100"
          >
            <LogOut size={18} />
            {sidebarOpen && <span className="text-sm">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-white overflow-hidden">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900">Calendar</h1>
            <button
              onClick={() => {
                setLoading(true);
                loadData();
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              title="Refresh calendar data"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('month')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  viewMode === 'month' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => {
                  setViewMode('day');
                  setSelectedDayDate(currentDate);
                }}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  viewMode === 'day' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                Day View
              </button>
            </div>

            {/* Date Picker */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">
                {viewMode === 'day' ? 'View Date:' : 'Month:'}
              </label>
              <input
                type="date"
                value={(viewMode === 'day' ? selectedDayDate || currentDate : currentDate).toISOString().split('T')[0]}
                onChange={(e) => {
                  const newDate = new Date(e.target.value);
                  if (viewMode === 'day') {
                    setSelectedDayDate(newDate);
                  } else {
                    setCurrentDate(newDate);
                  }
                }}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Room Type Filter */}
            <select
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              className="w-44 h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
            >
              {roomTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>

            {/* Search */}
            <div className="relative w-44">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search guest..."
                value={searchGuest}
                onChange={(e) => setSearchGuest(e.target.value)}
                className="w-full h-9 pl-9 pr-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

          </div>
        </header>

        {/* Calendar Grid - Scrollable */}
        <div className="flex-1 overflow-auto">
          {viewMode === 'month' ? (
            /* MONTH VIEW */
            <div className="bg-white">
              {/* Header row with dates */}
              <div className="flex border-b border-gray-200 sticky top-0 bg-white z-20">
                <div className="w-24 bg-gray-50 px-3 py-3 font-semibold text-sm text-gray-700 border-r border-gray-200 flex-shrink-0">
                  Room
                </div>
                <div className="flex flex-1">
                  {calendarDates.map((date, idx) => (
                    <div
                      key={idx}
                      className={`flex-1 min-w-20 px-2 py-3 text-center text-xs font-semibold border-r border-gray-200 ${
                        date.toDateString() === today.toDateString()
                          ? 'bg-purple-100 text-purple-900'
                          : 'bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="font-medium">{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                      <div className="text-xs mt-1">{date.getDate()}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Room rows */}
              <div>
                {filteredRooms.map((room) => (
                  <div key={room.id} className="flex border-b border-gray-200 hover:bg-gray-50 transition-colors">
                    {/* Room info */}
                    <div className="w-24 bg-white px-3 py-3 border-r border-gray-200 flex flex-col justify-center flex-shrink-0">
                      <div className="font-semibold text-sm text-gray-900">{room.id}</div>
                      <div className="text-xs text-gray-500">{room.type}</div>
                    </div>

                    {/* Booking cells */}
                    <div className="flex flex-1">
                      {calendarDates.map((date, idx) => {
                        const booking = getBookingForRoomOnDate(room.type, date);
                        const status = getRoomStatus(room.type, date);

                        return (
                          <div
                            key={idx}
                            className={`flex-1 min-w-20 px-2 py-2 border-r border-gray-200 text-xs ${
                              statusColors[getRoomStatus(room.type, date)] || 'bg-white'
                            }`}
                          >
                            {/* Show price: locked for paid/occupied, temporary for unpaid/available */}
                            {(() => {
                              const booking = getBookingForRoomOnDate(room.type, date);
                              const status = getRoomStatus(room.type, date);
                              let price = room.price;
                              let isLocked = false;
                              let isTemporary = false;

                              // Check for override price
                              const override = getOverridePrice(room.type, date);

                              // Determine if room can have temporary pricing applied
                              const isPaid = booking && booking.payment === 'Paid';
                              const isOccupied = status === 'Occupied';
                              const canApplyTemporary = !isPaid && !isOccupied;

                              if (isPaid || isOccupied) {
                                // Locked: Paid or Occupied rooms keep original price
                                price = room.price;
                                isLocked = true;
                              } else if (canApplyTemporary && override) {
                                // Apply temporary or regular override to unpaid/empty rooms
                                price = override.price;
                                isTemporary = override.isTemporary;
                              }

                              // Choose color based on status
                              let priceColor = 'text-gray-900';
                              if (isLocked) {
                                priceColor = 'text-gray-500';
                              } else if (isTemporary) {
                                priceColor = 'text-orange-600'; // Temporary pricing in orange
                              }

                              return (
                                <div className={`text-[11px] font-semibold mb-0.5 ${priceColor}`}>
                                  ${price}
                                  {isLocked && <span className="ml-1 text-[9px]">🔒</span>}
                                  {isTemporary && <span className="ml-1 text-[9px]" title="Temporary pricing">⏱</span>}
                                </div>
                              );
                            })()}
                            {booking && (
                              <button
                                onClick={() => setSelectedBooking(booking)}
                                className="w-full h-full flex flex-col items-start justify-start p-1 rounded hover:shadow-md transition-shadow cursor-pointer group"
                                title={`${booking.guestName} (${booking.checkIn.toLocaleDateString()} - ${booking.checkOut.toLocaleDateString()})`}
                              >
                                <div className="font-semibold text-gray-900 group-hover:underline truncate text-xs">
                                  {booking.guestName.split(' ')[0]}
                                </div>
                                <div className="text-xs text-gray-600 mt-0.5">
                                  {booking.status === 'Occupied' && '✓ In'}
                                  {booking.status === 'Booked' && '○ Soon'}
                                </div>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* DAY VIEW - Organized by Room Type */
            <div className="bg-white p-6">
              <div className="mb-6 text-center">
                <h2 className="text-2xl font-bold text-gray-900">
                  {(selectedDayDate || currentDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </h2>
                <p className="text-gray-500 mt-1">Room Availability by Type</p>
              </div>

              <div className="space-y-6">
                {roomTypes.filter(t => t !== 'All').map(roomType => {
                  const roomsOfType = filteredRooms.filter(r => r.type === roomType);
                  if (roomsOfType.length === 0) return null;

                  const dayDate = selectedDayDate || currentDate;
                  const override = getOverridePrice(roomType, dayDate);
                  const basePrice = roomsOfType[0]?.price || 0;
                  const effectivePrice = override ? override.price : basePrice;

                  // Count stats for this room type
                  const available = roomsOfType.filter(r => getRoomStatus(r.type, dayDate) === 'Available').length;
                  const booked = roomsOfType.filter(r => getRoomStatus(r.type, dayDate) === 'Booked').length;
                  const occupied = roomsOfType.filter(r => getRoomStatus(r.type, dayDate) === 'Occupied').length;

                  return (
                    <div key={roomType} className="border rounded-xl overflow-hidden">
                      {/* Room Type Header */}
                      <div className="bg-purple-50 px-4 py-3 border-b flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-purple-900">{roomType}</h3>
                          <div className="flex items-center gap-4 mt-1 text-sm">
                            <span className="text-green-600">● {available} Available</span>
                            <span className="text-orange-600">● {booked} Booked</span>
                            <span className="text-blue-600">● {occupied} Occupied</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-2xl font-bold ${override?.isTemporary ? 'text-orange-600' : 'text-purple-700'}`}>
                            ${effectivePrice}
                            {override?.isTemporary && <span className="ml-1 text-sm">⏱</span>}
                          </div>
                          {override && override.price !== basePrice && (
                            <div className="text-xs text-gray-500 line-through">${basePrice}</div>
                          )}
                        </div>
                      </div>

                      {/* Individual Rooms Grid */}
                      <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {roomsOfType.map(room => {
                          const booking = getBookingForRoomOnDate(room.type, dayDate);
                          const status = getRoomStatus(room.type, dayDate);
                          const statusBg = statusColors[status] || 'bg-white';

                          return (
                            <div
                              key={room.id}
                              className={`${statusBg} border-2 rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow`}
                              onClick={() => booking && setSelectedBooking(booking)}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <span className="font-bold text-gray-900">#{room.id}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  status === 'Available' ? 'bg-green-200 text-green-800' :
                                  status === 'Booked' ? 'bg-orange-200 text-orange-800' :
                                  status === 'Occupied' ? 'bg-blue-200 text-blue-800' :
                                  'bg-gray-200 text-gray-800'
                                }`}>
                                  {status}
                                </span>
                              </div>
                              {booking ? (
                                <div className="text-xs">
                                  <div className="font-semibold text-gray-800 truncate">{booking.guestName}</div>
                                  <div className="text-gray-500 mt-1">
                                    {booking.checkIn.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -
                                    {booking.checkOut.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-xs text-gray-400">No booking</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Summary Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1">
              <div className="bg-white rounded-lg border border-gray-200 p-3">
                <div className="text-xs text-gray-600 mb-1">Total Rooms</div>
                <div className="text-xl font-bold text-gray-900">{filteredRooms.length}</div>
              </div>
              <div className="bg-white rounded-lg border border-green-200 p-3 bg-green-50">
                <div className="text-xs text-green-600 mb-1 font-medium">Available Today</div>
                <div className="text-xl font-bold text-green-600">
                  {filteredRooms.filter(room => !bookings.some(b => b.roomType === room.type && isDateInRange(today, b.checkIn, b.checkOut))).length}
                </div>
              </div>
              <div className="bg-white rounded-lg border border-blue-200 p-3 bg-blue-50">
                <div className="text-xs text-blue-600 mb-1 font-medium">Occupied Today</div>
                <div className="text-xl font-bold text-blue-600">
                  {bookings.filter(b => b.status === 'Occupied' && isDateInRange(today, b.checkIn, b.checkOut)).length}
                </div>
              </div>
              <div className="bg-white rounded-lg border border-orange-200 p-3 bg-orange-50">
                <div className="text-xs text-orange-600 mb-1 font-medium">Booked Today</div>
                <div className="text-xl font-bold text-orange-600">
                  {bookings.filter(b => b.status === 'Booked' && isDateInRange(today, b.checkIn, b.checkOut)).length}
                </div>
              </div>
            </div>
            {/* Price Legend */}
            <div className="flex flex-col gap-2 bg-white rounded-lg border border-gray-200 p-3">
              <div className="text-xs text-gray-500 flex items-center gap-2">
                <span>🔒</span>
                <span>Price locked for paid/booked</span>
              </div>
              <div className="text-xs text-orange-600 font-semibold flex items-center gap-2">
                <span>⏱</span>
                <span>Temporary pricing (auto-revert)</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Booking Details Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">{selectedBooking.guestName}</h2>
              <button
                onClick={() => setSelectedBooking(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-600" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-sm text-gray-600 mb-1">Room</div>
                <div className="text-lg font-semibold text-gray-900">
                  {selectedBooking.roomId}
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-600 mb-1">Check-in</div>
                <div className="text-lg font-semibold text-gray-900">
                  {selectedBooking.checkIn.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                  })}
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-600 mb-1">Check-out</div>
                <div className="text-lg font-semibold text-gray-900">
                  {selectedBooking.checkOut.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                  })}
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-600 mb-1">Status</div>
                <div className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                  selectedBooking.status === 'Occupied' ? 'bg-blue-100 text-blue-800' :
                  selectedBooking.status === 'Booked' ? 'bg-orange-100 text-orange-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {selectedBooking.status}
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-600 mb-1">Payment Status</div>
                <div className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                  selectedBooking.payment === 'Paid' ? 'bg-green-100 text-green-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {selectedBooking.payment}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 flex gap-2">
                <button className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium">
                  Edit Booking
                </button>
                <button
                  onClick={() => setSelectedBooking(null)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
