/**
 * Date Utilities for Hotel Revenue Management
 */

/**
 * Get today's date in YYYY-MM-DD format
 */
function getToday() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get date N days from today
 * @param {number} days - Number of days (positive = future, negative = past)
 */
function getDateFromToday(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

/**
 * Get the next occurrence of a day of week
 * @param {number} dayOfWeek - 0 = Sunday, 6 = Saturday
 */
function getNextDayOfWeek(dayOfWeek) {
  const today = new Date();
  const todayDay = today.getDay();
  const daysUntil = (dayOfWeek - todayDay + 7) % 7 || 7;
  const target = new Date(today);
  target.setDate(today.getDate() + daysUntil);
  return target.toISOString().split('T')[0];
}

/**
 * Get next weekend dates (Saturday and Sunday)
 */
function getNextWeekend() {
  const saturday = getNextDayOfWeek(6);
  const sundayDate = new Date(saturday);
  sundayDate.setDate(sundayDate.getDate() + 1);
  return {
    saturday,
    sunday: sundayDate.toISOString().split('T')[0]
  };
}

/**
 * Check if a date is a weekend
 */
function isWeekend(dateStr) {
  const date = new Date(dateStr);
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Get date range for "this week"
 */
function getThisWeek() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
}

/**
 * Get date range for "next week"
 */
function getNextWeek() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() + (7 - today.getDay()));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
}

/**
 * Get date range for "this month"
 */
function getThisMonth() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
}

/**
 * Parse natural language date references
 */
function parseDateReference(text) {
  const lower = text.toLowerCase();

  if (lower.includes('today')) {
    return { type: 'single', date: getToday(), label: 'Today' };
  }

  if (lower.includes('tomorrow')) {
    return { type: 'single', date: getDateFromToday(1), label: 'Tomorrow' };
  }

  if (lower.includes('next weekend') || lower.includes('this weekend')) {
    const weekend = getNextWeekend();
    return {
      type: 'range',
      startDate: weekend.saturday,
      endDate: weekend.sunday,
      label: lower.includes('this weekend') ? 'This Weekend' : 'Next Weekend'
    };
  }

  if (lower.includes('next week')) {
    const week = getNextWeek();
    return { type: 'range', startDate: week.start, endDate: week.end, label: 'Next Week' };
  }

  if (lower.includes('this week')) {
    const week = getThisWeek();
    return { type: 'range', startDate: week.start, endDate: week.end, label: 'This Week' };
  }

  if (lower.includes('this month')) {
    const month = getThisMonth();
    return { type: 'range', startDate: month.start, endDate: month.end, label: 'This Month' };
  }

  return { type: 'single', date: getToday(), label: 'Today' };
}

/**
 * Format date for display
 */
function formatDate(dateStr, format = 'short') {
  const date = new Date(dateStr);
  if (format === 'short') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  if (format === 'long') {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }
  return dateStr;
}

/**
 * Get days between two dates
 */
function daysBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
}

module.exports = {
  getToday,
  getDateFromToday,
  getNextDayOfWeek,
  getNextWeekend,
  isWeekend,
  getThisWeek,
  getNextWeek,
  getThisMonth,
  parseDateReference,
  formatDate,
  daysBetween
};
