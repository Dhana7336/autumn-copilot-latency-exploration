import React, { useState, useEffect, useCallback } from "react";
import { TrendingUp, DollarSign, Hotel, ArrowLeft, Clock, CalendarClock, AlertTriangle, TrendingDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Bar,
  ComposedChart,
  Area
} from "recharts";

// Helper: Get promotion status (RED, ORANGE, or none)
function getPromotionStatus(action, currentTime) {
  if (!action) return { status: null, label: '', countdown: '' };

  const isTemp = action.isTemporary ||
                 action.summary?.toLowerCase().includes('hour') ||
                 action.summary?.toLowerCase().includes('temporary') ||
                 action.durationHours > 0;

  if (!isTemp) return { status: null, label: '', countdown: '' };

  const actionTime = new Date(action.time);
  const now = currentTime;

  // Calculate end time based on duration
  const durationMs = (action.durationHours || 1) * 60 * 60 * 1000;
  const endTime = new Date(actionTime.getTime() + durationMs);

  // Scheduled for future (ORANGE)
  if (actionTime > now) {
    const startsIn = actionTime - now;
    const daysUntil = Math.floor(startsIn / (1000 * 60 * 60 * 24));
    const hoursUntil = Math.floor((startsIn % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    let startLabel = '';
    if (daysUntil > 0) {
      startLabel = `Starts in ${daysUntil}d ${hoursUntil}h`;
    } else if (hoursUntil > 0) {
      startLabel = `Starts in ${hoursUntil}h`;
    } else {
      const minsUntil = Math.floor(startsIn / (1000 * 60));
      startLabel = `Starts in ${minsUntil}m`;
    }

    return {
      status: 'upcoming',
      label: 'Temporary promotion scheduled',
      countdown: startLabel,
      color: 'orange'
    };
  }

  // Currently active (RED)
  if (now >= actionTime && now < endTime) {
    const remaining = endTime - now;
    const hoursLeft = Math.floor(remaining / (1000 * 60 * 60));
    const minsLeft = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    let countdownLabel = '';
    if (hoursLeft > 0) {
      countdownLabel = `Ends in ${hoursLeft}h ${minsLeft}m`;
    } else {
      countdownLabel = `Ends in ${minsLeft}m`;
    }

    return {
      status: 'active',
      label: 'Temporary promotion active',
      countdown: countdownLabel,
      color: 'red'
    };
  }

  // Recently completed within 24 hours (RED)
  const hoursSinceEnd = (now - endTime) / (1000 * 60 * 60);
  if (hoursSinceEnd <= 24 && hoursSinceEnd >= 0) {
    return {
      status: 'completed',
      label: 'Temporary promotion completed',
      countdown: `Ended ${Math.floor(hoursSinceEnd)}h ago`,
      color: 'red'
    };
  }

  // Historical (no color)
  return { status: 'historical', label: '', countdown: '', color: null };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch data on mount and auto-refresh every 10 seconds
  useEffect(() => {
    fetchData();
    const refreshInterval = setInterval(() => {
      fetchData();
    }, 10000); // 10 seconds
    return () => clearInterval(refreshInterval);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:4001/api/copilot/dashboard");
      const json = await res.json();
      if (json.ok) {
        setData(json);
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      if (!data) {
        setData({
          metrics: { avgDailyRate: 0, occupancy: 0, revPAR: 0, totalRooms: 0, totalBooked: 0 },
          roomDetails: [],
          alerts: [],
          recentActions: []
        });
      }
    } finally {
      setLoading(false);
    }
  }, [data]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  }

  const { metrics, roomDetails = [], recentActions = [] } = data;
  const { avgDailyRate, occupancy, revPAR, totalBooked, totalRooms } = metrics;

  // Generate SMART alerts - analyze data intelligently using ACTUAL API data
  const generateAlerts = () => {
    const generatedAlerts = [];

    // Use actual competitorAvg from API data (not hardcoded)
    const priceAnalysis = roomDetails.map(room => {
      const competitorAvg = room.competitorAvg || 180;
      const effectivePrice = room.effectivePrice || room.currentPrice;
      const diff = competitorAvg - effectivePrice;
      const percentDiff = competitorAvg > 0 ? ((diff / competitorAvg) * 100) : 0;
      return { ...room, competitorAvg, effectivePrice, diff, percentDiff };
    });

    // Categorize rooms by occupancy
    const lowOccupancyRooms = roomDetails.filter(r => r.occupancy < 40);
    const midOccupancyRooms = roomDetails.filter(r => r.occupancy >= 40 && r.occupancy <= 70);
    const highOccupancyRooms = roomDetails.filter(r => r.occupancy > 70);

    // Categorize rooms by price vs market (lower threshold: $5 gap is significant)
    const belowMarketRooms = priceAnalysis.filter(r => r.diff > 5);
    const aboveMarketRooms = priceAnalysis.filter(r => r.diff < -5);

    // 1. 🔴 LOW OCCUPANCY - Show if any room is below 40%
    if (lowOccupancyRooms.length > 0) {
      const worst = lowOccupancyRooms.reduce((min, r) => r.occupancy < min.occupancy ? r : min);
      generatedAlerts.push({
        type: 'low_occupancy',
        priority: 1,
        icon: '🔴',
        color: 'red',
        roomName: worst.name,
        message: `Low Occupancy Alert`,
        detail: `${worst.name} is only ${worst.occupancy}% booked${lowOccupancyRooms.length > 1 ? ` (${lowOccupancyRooms.length} rooms affected)` : ''}`,
        suggestion: `Consider a flash sale or discount for ${worst.name}`
      });
    }

    // 2. 🟠 PRICE BELOW MARKET - Show room with biggest revenue opportunity
    if (belowMarketRooms.length > 0) {
      const biggest = belowMarketRooms.reduce((max, r) => r.diff > max.diff ? r : max);
      generatedAlerts.push({
        type: 'price_below_competitor',
        priority: 2,
        icon: '🟠',
        color: 'orange',
        roomName: biggest.name,
        message: `Missed Revenue Opportunity`,
        detail: `${biggest.name} is $${biggest.diff.toFixed(0)} below market ($${biggest.effectivePrice} vs $${biggest.competitorAvg} avg)`,
        suggestion: `Potential to increase ${biggest.name} by $${Math.min(biggest.diff, 20).toFixed(0)}`
      });
    }

    // 3. 🟡 PRICE ABOVE MARKET - Show if pricing above competitors
    if (aboveMarketRooms.length > 0) {
      const highest = aboveMarketRooms.reduce((max, r) => Math.abs(r.diff) > Math.abs(max.diff) ? r : max);
      generatedAlerts.push({
        type: 'price_above_market',
        priority: 3,
        icon: '🟡',
        color: 'yellow',
        roomName: highest.name,
        message: `Price Above Market`,
        detail: `${highest.name} at $${highest.effectivePrice} is $${Math.abs(highest.diff).toFixed(0)} above competitor avg $${highest.competitorAvg}`,
        suggestion: `Monitor ${highest.name} bookings - may affect demand`
      });
    }

    // 4. 🟢 HIGH DEMAND - Show best performing rooms (or moderate demand)
    if (highOccupancyRooms.length > 0) {
      const best = highOccupancyRooms.reduce((max, r) => r.occupancy > max.occupancy ? r : max);
      generatedAlerts.push({
        type: 'high_demand',
        priority: 4,
        icon: '🟢',
        color: 'green',
        roomName: best.name,
        message: `High Demand`,
        detail: `${best.name} is ${best.occupancy}% booked - strong performance`,
        suggestion: `Consider increasing ${best.name} price by 10-15%`
      });
    } else if (midOccupancyRooms.length > 0) {
      // Show moderate demand if no high demand
      const best = midOccupancyRooms.reduce((max, r) => r.occupancy > max.occupancy ? r : max);
      generatedAlerts.push({
        type: 'moderate_demand',
        priority: 4,
        icon: '🟢',
        color: 'green',
        roomName: best.name,
        message: `Moderate Demand`,
        detail: `${best.name} at ${best.occupancy}% - best performer today`,
        suggestion: `Maintain current pricing strategy`
      });
    }

    // 5. 🟠 ACTIVE PROMOTIONS - Show currently running promotions
    const activePromos = recentActions.filter(action => {
      const status = getPromotionStatus(action, currentTime);
      return status.status === 'active';
    });

    if (activePromos.length > 0) {
      const action = activePromos[0];
      const status = getPromotionStatus(action, currentTime);
      generatedAlerts.push({
        type: 'active_promotion',
        priority: 5,
        icon: '🟠',
        color: 'orange',
        roomName: action.roomType || 'Multiple Rooms',
        message: `Active Promotion Running`,
        detail: `${action.roomType || 'Rooms'} - ${status.countdown}${activePromos.length > 1 ? ` (+${activePromos.length - 1} more)` : ''}`,
        suggestion: `Monitor bookings during promotion period`
      });
    }

    // 6. 🔵 RATE FLOOR/CEILING - Check pricing boundaries
    const nearFloor = roomDetails.filter(room => {
      const floor = room.floorPrice || (room.effectivePrice || room.currentPrice) * 0.75;
      const effectivePrice = room.effectivePrice || room.currentPrice;
      return effectivePrice <= floor * 1.15; // Within 15% of floor
    });

    const nearCeiling = roomDetails.filter(room => {
      const ceiling = room.ceilingPrice || (room.effectivePrice || room.currentPrice) * 1.35;
      const effectivePrice = room.effectivePrice || room.currentPrice;
      return effectivePrice >= ceiling * 0.90; // Within 10% of ceiling
    });

    if (nearCeiling.length > 0) {
      generatedAlerts.push({
        type: 'ceiling_warning',
        priority: 6,
        icon: '🔵',
        color: 'blue',
        roomName: nearCeiling[0].name,
        message: `Near Rate Ceiling`,
        detail: `${nearCeiling.length} room(s) approaching maximum price`,
        suggestion: `${nearCeiling.map(r => r.name).join(', ')} near ceiling`
      });
    } else if (nearFloor.length > 0) {
      generatedAlerts.push({
        type: 'floor_warning',
        priority: 6,
        icon: '🔵',
        color: 'blue',
        roomName: nearFloor[0].name,
        message: `Near Rate Floor`,
        detail: `${nearFloor.length} room(s) approaching minimum price`,
        suggestion: `${nearFloor.map(r => r.name).join(', ')} near floor`
      });
    }

    // Sort by priority (1 = highest)
    return generatedAlerts.sort((a, b) => a.priority - b.priority);
  };

  const alerts = generateAlerts();

  // Separate actions into upcoming (ORANGE) and recent/active (RED or none)
  const upcomingActions = recentActions.filter(a => {
    const status = getPromotionStatus(a, currentTime);
    return status.status === 'upcoming';
  });

  const recentAndActiveActions = recentActions.filter(a => {
    const status = getPromotionStatus(a, currentTime);
    return status.status !== 'upcoming';
  });

  // Check if any room has active temporary pricing
  const getRoomPromotionStatus = (room) => {
    // First check if the room data itself has isTemporary flag
    if (room.isTemporary) {
      return 'active';
    }

    // Also check recent actions for this room
    const roomName = room.name;
    const roomActions = recentActions.filter(a =>
      a.roomType === roomName || a.summary?.includes(roomName)
    );
    for (const action of roomActions) {
      const status = getPromotionStatus(action, currentTime);
      if (status.color === 'red') return 'active';
      if (status.color === 'orange') return 'upcoming';
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* HEADER */}
      <div className="bg-purple-700 text-white">
        <div className="w-full max-w-[1200px] mx-auto px-6 py-6 flex justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/chat")}>
              <ArrowLeft />
            </button>
            <h1 className="text-3xl font-bold">🏨 Lily Hall Pricing Dashboard</h1>
          </div>
          <div className="text-right">
            <div className="text-sm">Current Time</div>
            <div className="text-2xl font-semibold">
              {currentTime.toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <div className="w-full max-w-[1200px] mx-auto px-6 py-8 space-y-6">

        {/* SECTION 1 — KPI */}
        <div className="bg-white border rounded-xl p-6 shadow">
          <h2 className="text-xl font-bold mb-4">Key Metrics</h2>
          <div className="grid grid-cols-5 gap-4">
            {[
              ["Avg Daily Rate", `$${avgDailyRate}`, DollarSign],
              ["Occupancy", `${occupancy}%`, TrendingUp],
              ["RevPAR", `$${revPAR}`, TrendingUp],
              ["Rooms Booked", `${totalBooked}/${totalRooms}`, Hotel],
              ["Cancellation Rate", `${metrics.cancellationRate ?? 5}%`, TrendingUp]
            ].map(([label, value, Icon], i) => (
              <div key={i} className="bg-gray-50 border rounded-lg p-4 text-center flex-1">
                <div className="flex justify-center mb-1">
                  <Icon size={18} className="text-purple-600" />
                </div>
                <div className="text-sm text-gray-600 mb-1">{label}</div>
                <div className="text-2xl font-bold">{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 2 — ROOM OVERVIEW */}
        <div className="bg-white border rounded-xl p-6 shadow">
          <h2 className="text-xl font-bold mb-4">Room & Pricing Overview</h2>
          <div className="flex gap-4">
            {/* Alerts */}
            <div className="flex-1 bg-gray-50 border rounded-lg p-4 h-[340px] flex flex-col">
              <h3 className="font-semibold mb-3 text-center flex items-center justify-center gap-2">
                <AlertTriangle size={16} /> Alerts ({alerts.length})
              </h3>
              <div className="flex-1 overflow-y-auto space-y-2">
                {alerts.length ? alerts.map((a, i) => {
                  const bgColor = a.color === 'red' ? 'bg-red-50 border-red-300' :
                                  a.color === 'orange' ? 'bg-orange-50 border-orange-300' :
                                  a.color === 'yellow' ? 'bg-yellow-50 border-yellow-300' :
                                  a.color === 'blue' ? 'bg-blue-50 border-blue-300' :
                                  a.color === 'green' ? 'bg-green-50 border-green-300' :
                                  'bg-gray-50 border-gray-300';
                  const textColor = a.color === 'red' ? 'text-red-700' :
                                    a.color === 'orange' ? 'text-orange-700' :
                                    a.color === 'yellow' ? 'text-yellow-700' :
                                    a.color === 'blue' ? 'text-blue-700' :
                                    a.color === 'green' ? 'text-green-700' :
                                    'text-gray-700';
                  const iconEmoji = a.color === 'red' ? '🔴' :
                                    a.color === 'orange' ? '🟠' :
                                    a.color === 'yellow' ? '🟡' :
                                    a.color === 'blue' ? '🔵' :
                                    a.color === 'green' ? '🟢' : '⚪';

                  return (
                    <div key={i} className={`border rounded p-3 text-sm ${bgColor}`}>
                      <div className={`font-semibold flex items-center gap-2 ${textColor}`}>
                        <span>{iconEmoji}</span>
                        <span>{a.message}</span>
                      </div>
                      <div className={`text-xs mt-1 ${textColor}`}>{a.detail}</div>
                      {a.suggestion && (
                        <div className="text-xs text-gray-500 mt-1 italic">💡 {a.suggestion}</div>
                      )}
                    </div>
                  );
                }) : <div className="text-center text-gray-400">✅ No alerts - all systems normal</div>}
              </div>
            </div>

            {/* Rooms with promotion indicators */}
            <div className="flex-1 bg-gray-50 border rounded-lg p-4 h-[340px] flex flex-col">
              <h3 className="font-semibold mb-3 text-center">Rooms</h3>
              <div className="flex-1 overflow-y-auto space-y-2">
                {roomDetails.length ? roomDetails.map((r) => {
                  const promoStatus = getRoomPromotionStatus(r);
                  const bgClass = promoStatus === 'active' ? 'bg-red-50 border-red-300' :
                                  promoStatus === 'upcoming' ? 'bg-orange-50 border-orange-300' :
                                  'bg-white border-gray-200';
                  const hasPromoChange = r.effectivePrice !== r.currentPrice;
                  return (
                    <div key={r.name} className={`border rounded p-3 ${bgClass}`}>
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{r.name}</span>
                          {promoStatus === 'active' && (
                            <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded animate-pulse">PROMO</span>
                          )}
                          {promoStatus === 'upcoming' && (
                            <span className="text-xs bg-orange-500 text-white px-1.5 py-0.5 rounded">SCHEDULED</span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className={`font-semibold ${promoStatus === 'active' ? 'text-red-600' : promoStatus === 'upcoming' ? 'text-orange-600' : 'text-purple-600'}`}>
                            ${r.effectivePrice}
                          </span>
                          {hasPromoChange && (
                            <div className="text-xs text-gray-400 line-through">${r.currentPrice}</div>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-gray-600 flex justify-between">
                        <span>{r.occupancy}% occ • {r.bookedRooms}/{r.totalRooms} rooms</span>
                        <span className="text-gray-400">vs ${r.competitorAvg} avg</span>
                      </div>
                      {r.promoReason && (
                        <div className="text-xs text-red-500 mt-1">📢 {r.promoReason}</div>
                      )}
                      {r.promoEndDate && (
                        <div className="text-xs text-orange-500">⏰ Until {new Date(r.promoEndDate).toLocaleDateString()}</div>
                      )}
                    </div>
                  );
                }) : <div className="text-center text-gray-400">No rooms</div>}
              </div>
            </div>

            {/* Recent Changes with RED/ORANGE indicators */}
            <div className="flex-1 bg-gray-50 border rounded-lg p-4 h-[340px] flex flex-col">
              <h3 className="font-semibold mb-3 flex justify-center gap-2">
                <Clock size={16} /> Recent Changes
              </h3>
              <div className="flex-1 overflow-y-auto space-y-2">
                {recentAndActiveActions.length ? recentAndActiveActions.map((a, i) => {
                  const promoStatus = getPromotionStatus(a, currentTime);
                  const isRed = promoStatus.color === 'red';
                  const bgClass = isRed ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200';

                  return (
                    <div key={i} className={`border rounded p-3 text-sm ${bgClass}`}>
                      <div className="flex justify-between items-start mb-1">
                        <div className="text-xs text-gray-500">
                          {new Date(a.time).toLocaleString()}
                        </div>
                        {isRed && (
                          <span className={`text-xs text-white px-2 py-0.5 rounded ${promoStatus.status === 'active' ? 'bg-red-500 animate-pulse' : 'bg-red-400'}`}>
                            {promoStatus.status === 'active' ? 'ACTIVE' : 'COMPLETED'}
                          </span>
                        )}
                      </div>
                      <div className={`font-semibold mb-1 ${isRed ? 'text-red-700' : 'text-purple-700'}`}>
                        {a.action === 'applyTemporaryPricing' ? 'Temporary Pricing' : a.action}
                      </div>
                      {promoStatus.label && (
                        <div className={`text-xs font-medium mb-1 ${isRed ? 'text-red-600' : 'text-gray-600'}`}>
                          {promoStatus.label}
                        </div>
                      )}
                      {promoStatus.countdown && (
                        <div className={`text-xs font-semibold ${isRed ? 'text-red-500' : 'text-gray-500'}`}>
                          {promoStatus.countdown}
                        </div>
                      )}
                      {a.operatorName && (
                        <div className="text-xs text-gray-600 mt-1">By: {a.operatorName}</div>
                      )}
                      {a.summary && (
                        <div className="text-xs text-gray-700 line-clamp-2 mt-1">{a.summary}</div>
                      )}
                    </div>
                  );
                }) : <div className="text-center text-gray-400">No changes</div>}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2.5 — UPCOMING PROMOTIONS (ORANGE) */}
        {upcomingActions.length > 0 && (
          <div className="bg-white border border-orange-200 rounded-xl p-6 shadow">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-orange-700">
              <CalendarClock size={20} /> Upcoming Promotions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingActions.map((a, i) => {
                const promoStatus = getPromotionStatus(a, currentTime);
                return (
                  <div key={i} className="bg-orange-50 border border-orange-300 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded">
                        SCHEDULED
                      </span>
                      <span className="text-xs text-orange-600 font-semibold">
                        {promoStatus.countdown}
                      </span>
                    </div>
                    <div className="font-semibold text-orange-800 mb-1">
                      {a.action === 'applyTemporaryPricing' ? 'Temporary Pricing' : a.action}
                    </div>
                    <div className="text-xs text-orange-600 mb-2">
                      {promoStatus.label}
                    </div>
                    {a.roomType && (
                      <div className="text-sm font-medium text-gray-700">
                        Room: {a.roomType}
                      </div>
                    )}
                    {a.summary && (
                      <div className="text-xs text-gray-600 mt-2 line-clamp-2">{a.summary}</div>
                    )}
                    <div className="text-xs text-gray-500 mt-2">
                      Scheduled: {new Date(a.time).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SECTION 3 — REAL-TIME PRICE CHART */}
        <div className="bg-white border rounded-xl p-6 shadow">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-bold">Price vs Competitor & Occupancy</h2>
              <p className="text-sm text-gray-500">Real-time pricing • Updates automatically</p>
            </div>
            <div className="text-xs text-gray-400">
              Last updated: {currentTime.toLocaleTimeString()}
            </div>
          </div>
          <div className="h-80">
            {roomDetails.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={roomDetails.map(r => ({
                    name: r.name,
                    yourPrice: r.effectivePrice || r.currentPrice,
                    basePrice: r.currentPrice,
                    competitorAvg: r.competitorAvg,
                    occupancy: r.occupancy,
                    isPromo: r.isTemporary || r.promoReason,
                    priceChange: (r.effectivePrice || r.currentPrice) - r.currentPrice
                  }))}
                  margin={{ top: 20, right: 40, left: 20, bottom: 20 }}
                >
                  <defs>
                    <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.9}/>
                      <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.7}/>
                    </linearGradient>
                    <linearGradient id="competitorGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.9}/>
                      <stop offset="95%" stopColor="#fbbf24" stopOpacity={0.7}/>
                    </linearGradient>
                    <linearGradient id="occupancyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#34d399" stopOpacity={0.3}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    axisLine={{ stroke: '#e5e7eb' }}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${v}`}
                    domain={[0, 'auto']}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                    domain={[0, 100]}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0]?.payload;
                      const priceChange = data?.priceChange || 0;
                      const isUp = priceChange > 0;
                      return (
                        <div className="bg-white border rounded-lg shadow-lg p-3 min-w-[180px]">
                          <div className="font-bold text-gray-800 mb-2 border-b pb-1">{label}</div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-purple-600">💰 Current Price:</span>
                              <span className="font-bold">${data?.yourPrice}</span>
                            </div>
                            {priceChange !== 0 && (
                              <div className={`flex justify-between ${isUp ? 'text-green-600' : 'text-red-600'}`}>
                                <span>{isUp ? '📈' : '📉'} Change:</span>
                                <span className="font-bold">{isUp ? '+' : ''}${priceChange}</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-amber-500">🏨 Competitor:</span>
                              <span className="font-bold">${data?.competitorAvg}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-emerald-500">📊 Occupancy:</span>
                              <span className="font-bold">{data?.occupancy}%</span>
                            </div>
                            {data?.isPromo && (
                              <div className="mt-2 pt-1 border-t text-red-500 text-xs font-medium">
                                🔴 Active Promotion
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend
                    wrapperStyle={{ paddingTop: '10px' }}
                    formatter={(value) => {
                      if (value === 'yourPrice') return <span className="text-purple-600">Your Price (Real-time)</span>;
                      if (value === 'competitorAvg') return <span className="text-amber-500">Competitor Avg</span>;
                      if (value === 'occupancy') return <span className="text-emerald-500">Occupancy</span>;
                      return value;
                    }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="yourPrice"
                    fill="url(#priceGradient)"
                    radius={[6, 6, 0, 0]}
                    barSize={32}
                    animationDuration={500}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="competitorAvg"
                    fill="url(#competitorGradient)"
                    radius={[6, 6, 0, 0]}
                    barSize={32}
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="occupancy"
                    fill="url(#occupancyGradient)"
                    stroke="#10b981"
                    strokeWidth={2}
                    animationDuration={500}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                No room data available
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
