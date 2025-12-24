import { Calendar } from 'lucide-react';

export default function PricingCalendar({ roomDetails = [] }) {
  // Get current date info
  const today = new Date();
  const currentMonth = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Generate next 7 days
  const upcomingDays = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    upcomingDays.push({
      date,
      dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'short' }),
      dayOfMonth: date.getDate(),
      isToday: i === 0
    });
  }

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 flex flex-col h-[500px]">
      <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
        <Calendar size={20} className="text-purple-600" />
        Price Calendar
      </h2>

      <div className="text-sm text-gray-600 mb-4">{currentMonth}</div>

      <div className="flex-1 overflow-y-auto pr-2">
        <div className="space-y-4">
          {upcomingDays.map((day, idx) => (
            <div
              key={idx}
              className={`border rounded-lg p-3 ${
                day.isToday
                  ? 'border-purple-400 bg-purple-50'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <div className="font-semibold text-gray-800">
                  {day.dayOfWeek} {day.dayOfMonth}
                  {day.isToday && <span className="text-xs ml-2 text-purple-600 font-medium">Today</span>}
                </div>
              </div>

              <div className="space-y-1">
                {roomDetails.slice(0, 3).map((room, ridx) => {
                  // Determine if pricing is in effect for this room
                  const hasChange = room.effectivePriceDate &&
                    new Date(room.effectivePriceDate) <= day.date;

                  return (
                    <div
                      key={ridx}
                      className="text-xs flex justify-between items-center py-1"
                    >
                      <span className="text-gray-600 truncate max-w-[120px]" title={room.name}>
                        {room.name}
                      </span>
                      <span className={`font-semibold ${
                        hasChange ? 'text-purple-600' : 'text-gray-800'
                      }`}>
                        {room.effectivePrice ? `$${room.effectivePrice}` : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-xs font-semibold text-gray-700 mb-2">Legend</div>
          <div className="space-y-1 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-50 border border-purple-400 rounded"></div>
              <span>Today</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 border border-gray-200 rounded"></div>
              <span>Upcoming</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-purple-600 font-semibold">$XXX</span>
              <span>Active pricing change</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
