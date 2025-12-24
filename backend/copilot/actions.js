const dataLoader = require('../services/dataLoader');
const fs = require('fs').promises;
const path = require('path');
const { mapToHotelRoomType, normalizeForComparison } = require('./roomMapping');

// Storage path for action configuration
const ACTIONS_CONFIG_PATH = path.resolve(__dirname, '../data/actions-config.json');

/**
 * Save action to persistent storage
 * @param {string} actionType - Type of action (overrides, clamps, weights, differentials, temporaryOffers, scheduledReverts)
 * @param {object} parameters - Action parameters
 */
async function saveActionToConfig(actionType, parameters) {
  try {
    let config = {};
    try {
      const data = await fs.readFile(ACTIONS_CONFIG_PATH, 'utf8');
      config = JSON.parse(data);
    } catch (err) {
      // Initialize empty config if file doesn't exist
      config = {
        overrides: [],
        clamps: [],
        weights: [],
        differentials: [],
        adjustments: [],
        temporaryOffers: [],
        scheduledReverts: []
      };
    }
    
    // Add timestamp to parameters
    const entry = {
      ...parameters,
      timestamp: new Date().toISOString()
    };
    
    // Store based on action type
    if (actionType === 'overrides') {
      config.overrides.push(entry);
    } else if (actionType === 'clamps') {
      config.clamps.push(entry);
    } else if (actionType === 'weights') {
      // Update or add weight
      const existingIndex = config.weights.findIndex(w => 
        w.competitorName === parameters.competitorName
      );
      if (existingIndex >= 0) {
        config.weights[existingIndex] = entry;
      } else {
        config.weights.push(entry);
      }
    } else if (actionType === 'differentials') {
      // Update or add differential
      const existingIndex = config.differentials.findIndex(d => 
        d.competitorName === parameters.competitorName
      );
      if (existingIndex >= 0) {
        config.differentials[existingIndex] = entry;
      } else {
        config.differentials.push(entry);
      }
    } else if (actionType === 'adjustments') {
      config.adjustments.push(entry);
    } else if (actionType === 'temporaryOffers') {
      config.temporaryOffers.push(entry);
    } else if (actionType === 'scheduledReverts') {
      config.scheduledReverts.push(entry);
    }

    await fs.writeFile(ACTIONS_CONFIG_PATH, JSON.stringify(config, null, 2));
    console.log(`✓ Action saved to storage: ${actionType}`, entry);
    return true;
  } catch (err) {
    console.error('❌ Failed to save action:', err);
    return false;
  }
}

/**
 * Get current action configuration
 */
async function getActionConfig() {
  try {
    const data = await fs.readFile(ACTIONS_CONFIG_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return {
      overrides: [],
      clamps: [],
      weights: [],
      differentials: [],
      adjustments: [],
      temporaryOffers: [],
      scheduledReverts: []
    };
  }
}

/**
 * Apply a general price increase to specific room types
 * @param {string[]} roomTypes - Target room types
 * @param {number} percentage - Percentage increase to apply
 * @param {string} scope - Scope descriptor (e.g., 'all days', 'weekend')
 */
async function applyPriceIncrease(roomTypes = ['Executive Suite', 'Premium Suite'], percentage = 6, scope = 'all days') {
  try {
    if (!Array.isArray(roomTypes) || roomTypes.length === 0) {
      return { success: false, message: 'No room types provided' };
    }

    // Allow negative percentages for decreases, validate range -50 to 50 (excluding 0)
    if (percentage === 0 || percentage < -50 || percentage > 50) {
      return { success: false, message: 'Percentage must be between -50 and 50 (not 0)' };
    }

    const updates = [];
    const fsSync = require('fs');
    const roomsCsvPath = path.resolve(__dirname, '../data/csv/rooms.csv');

    roomTypes.forEach((roomType) => {
      const room = dataLoader.rooms.find(r => (r.room_type || r['Room Type']) === roomType);
      if (!room) return;

      const currentPrice = parseFloat(room.base_price || room['Base Price']);
      const newPrice = Math.round(currentPrice * (1 + percentage / 100));

      // Update in-memory data
      dataLoader.updateRoomPrice(roomType, newPrice);

      updates.push({
        roomType,
        scope,
        oldPrice: currentPrice,
        newPrice,
        percentage
      });
    });

    if (updates.length === 0) {
      return { success: false, message: 'No matching room types found to update' };
    }

    // Update CSV file to persist changes
    let csvLines = fsSync.readFileSync(roomsCsvPath, 'utf8').split('\n');
    csvLines = csvLines.map((line, idx) => {
      if (idx === 0 || !line.trim()) return line; // Keep header and empty lines
      const parts = line.split(',');
      // Format: room_type,total_rooms,base_price
      const roomTypeInCsv = parts[0];
      const update = updates.find(u => u.roomType === roomTypeInCsv);
      if (update) {
        parts[2] = String(update.newPrice);
        return parts.join(',');
      }
      return line;
    });
    fsSync.writeFileSync(roomsCsvPath, csvLines.join('\n'));
    console.log('✓ CSV file updated with new prices');

    // Persist the adjustment for transparency
    await saveActionToConfig('adjustments', { roomTypes, percentage, scope });

    const isDecrease = percentage < 0;
    const absPercentage = Math.abs(percentage);
    const action = isDecrease ? 'decrease' : 'increase';
    const message = `Price ${action} applied successfully.\n\n` +
      `Changed rates by ${isDecrease ? '-' : '+'}${absPercentage}% for ${updates.map(u => u.roomType).join(' and ')}.\n` +
      updates.map(u => `${u.roomType}: $${u.oldPrice} → $${u.newPrice}`).join('\n') +
      `\n\nScope: ${scope}\n` +
      `Expected impact: ${isDecrease ? 'Boost occupancy by lowering prices' : 'Maintain current occupancy levels while increasing revenue'} by approximately ${absPercentage}%.`;

    console.log(`✓ Price ${action} applied:`, updates);

    return {
      success: true,
      message,
      data: updates
    };
  } catch (error) {
    console.error('Error applying price increase:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Raise weekend rates for premium suites by a percentage
 * @param {string[]} roomTypes - Target room types (defaults to premium suites)
 * @param {number} percentage - Percentage increase to apply
 * @param {string} scope - Scope descriptor (e.g., 'weekend')
 */
async function applyWeekendRateIncrease(roomTypes = ['Executive Suite', 'Premium Suite'], percentage = 8, scope = 'weekend') {
  try {
    if (!Array.isArray(roomTypes) || roomTypes.length === 0) {
      return { success: false, message: 'No room types provided' };
    }

    if (percentage <= 0 || percentage > 50) {
      return { success: false, message: 'Percentage must be between 1 and 50' };
    }

    const updates = [];

    roomTypes.forEach((roomType) => {
      const room = dataLoader.rooms.find(r => (r.room_type || r['Room Type']) === roomType);
      if (!room) return;

      const currentPrice = parseFloat(room.base_price || room['Base Price']);
      const newPrice = Math.round(currentPrice * (1 + percentage / 100));

      dataLoader.updateRoomPrice(roomType, newPrice);

      updates.push({
        roomType,
        scope,
        oldPrice: currentPrice,
        newPrice,
        percentage
      });
    });

    if (updates.length === 0) {
      return { success: false, message: 'No matching room types found to update' };
    }

    // Persist the adjustment for transparency
    await saveActionToConfig('adjustments', { roomTypes, percentage, scope });

    const message = `Raised ${scope} rates by ${percentage}% for ${updates.map(u => u.roomType).join(' & ')}`;
    console.log('✓ Weekend rate increase applied:', updates);

    return {
      success: true,
      message,
      data: updates
    };
  } catch (error) {
    console.error('Error applying weekend rate increase:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Apply a one-time price override for a specific room on a specific date
 * @param {string} roomId - Room identifier (e.g., "standard", "deluxe")
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {number} newPrice - New price to apply
 */
async function applyPriceOverride(roomId, date, newPrice) {
  try {
    // Validate inputs
    if (!roomId || !date || !newPrice) {
      return { success: false, message: 'Missing required parameters' };
    }

    if (newPrice < 50) {
      return { success: false, message: 'Price cannot be below $50 minimum floor' };
    }

    // Map AI room type to hotel room type for consistent storage
    const mappedRoomType = mapToHotelRoomType(roomId);
    const normalizedRoomId = normalizeForComparison(roomId);

    // Save to persistent storage (overrides) with both original and mapped types
    const parameters = { roomId: normalizedRoomId, mappedRoomType, date, newPrice };
    await saveActionToConfig('overrides', parameters);

    // Also update the main rooms.csv file for this room type
    const roomsCsvPath = path.resolve(__dirname, '../data/csv/rooms.csv');
    const fsSync = require('fs');
    let csvLines = fsSync.readFileSync(roomsCsvPath, 'utf8').split('\n');
    let updated = false;
    csvLines = csvLines.map((line, idx) => {
      if (idx === 0 || !line.trim()) return line;
      const parts = line.split(',');
      // room_type,total_rooms,base_price - use mapped room type for matching
      const csvRoomType = parts[0].toLowerCase();
      if (csvRoomType === mappedRoomType.toLowerCase() || csvRoomType === normalizedRoomId) {
        parts[2] = String(newPrice);
        updated = true;
        return parts.join(',');
      }
      return line;
    });
    if (updated) {
      fsSync.writeFileSync(roomsCsvPath, csvLines.join('\n'));
      // Also update in-memory dataLoader.rooms
      if (dataLoader.rooms) {
        const room = dataLoader.rooms.find(r =>
          (r.room_type || '').toLowerCase() === mappedRoomType.toLowerCase()
        );
        if (room) room.base_price = parseFloat(newPrice);
      }
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      action: 'applyPriceOverride',
      roomId,
      date,
      newPrice,
      status: 'applied',
      updatedMainDb: updated
    };

    console.log('✓ Price Override Applied:', logEntry);

    return {
      success: true,
      message: `Price override of $${newPrice} applied for ${roomId} on ${date}`,
      data: logEntry
    };
  } catch (error) {
    console.error('Error applying price override:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Adjust rate floor or ceiling for a room type over a date range
 * @param {string} roomType - Room type name
 * @param {string} clampType - 'floor' or 'ceiling'
 * @param {number} newValue - New price limit
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 */
async function adjustRateClamp(roomType, clampType, newValue, startDate, endDate) {
  try {
    // Validate inputs
    if (!roomType || !clampType || !newValue || !startDate || !endDate) {
      return { success: false, message: 'Missing required parameters' };
    }

    if (!['floor', 'ceiling'].includes(clampType)) {
      return { success: false, message: 'clampType must be "floor" or "ceiling"' };
    }

    if (clampType === 'floor' && newValue < 50) {
      return { success: false, message: 'Floor cannot be below $50 minimum' };
    }

    if (clampType === 'ceiling' && newValue < 100) {
      return { success: false, message: 'Ceiling too low, may harm revenue' };
    }

    // Validate date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      return { success: false, message: 'End date must be after start date' };
    }

    // Save to persistent storage
    const parameters = { roomType, clampType, newValue, startDate, endDate };
    await saveActionToConfig('clamps', parameters);
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      action: 'adjustRateClamp',
      roomType,
      clampType,
      newValue,
      startDate,
      endDate,
      status: 'applied'
    };

    console.log('✓ Rate Clamp Updated:', logEntry);

    return {
      success: true,
      message: `${clampType === 'floor' ? 'Minimum' : 'Maximum'} price of $${newValue} set for ${roomType} from ${startDate} to ${endDate}`,
      data: logEntry
    };
  } catch (error) {
    console.error('Error adjusting rate clamp:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Update the weight/importance of a competitor in pricing calculations
 * @param {string} competitorName - Competitor hotel name
 * @param {number} newWeight - New weight (0.0 to 1.0)
 */
async function updateCompetitorWeight(competitorName, newWeight) {
  try {
    // Validate inputs
    if (!competitorName || newWeight === undefined) {
      return { success: false, message: 'Missing required parameters' };
    }

    if (newWeight < 0 || newWeight > 1) {
      return { success: false, message: 'Weight must be between 0.0 and 1.0' };
    }

    // Verify competitor exists
    const competitors = dataLoader.competitors || [];
    const competitorName_field = competitors[0]?.competitor_name ? 'competitor_name' : 'name';
    const competitor = competitors.find(c => {
      const name = c[competitorName_field] || c.name || c.competitor_name || '';
      return name.toLowerCase().includes(competitorName.toLowerCase());
    });

    if (!competitor) {
      const availableNames = [...new Set(competitors.map(c => c[competitorName_field] || c.name || c.competitor_name))];
      return {
        success: false,
        message: `Competitor "${competitorName}" not found. Available: ${availableNames.join(', ')}`
      };
    }

    const competitorFullName = competitor[competitorName_field] || competitor.name || competitor.competitor_name;
    
    // Save to persistent storage
    const parameters = {
      competitorName: competitorFullName,
      oldWeight: competitor.weight || 0.5,
      newWeight
    };
    await saveActionToConfig('weights', parameters);
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      action: 'updateCompetitorWeight',
      competitorName: competitorFullName,
      oldWeight: competitor.weight || 0.5,
      newWeight,
      status: 'applied'
    };

    console.log('✓ Competitor Weight Updated:', logEntry);

    return {
      success: true,
      message: `Competitor weight for ${competitorFullName} updated to ${(newWeight * 100).toFixed(0)}%`,
      data: logEntry
    };
  } catch (error) {
    console.error('Error updating competitor weight:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Update pricing differential vs a specific competitor
 * @param {string} competitorName - Competitor hotel name
 * @param {number} newDifferential - Dollar amount or percentage (e.g., -10 for $10 below, 5 for $5 above)
 */
async function updateCompetitorDifferential(competitorName, newDifferential) {
  try {
    // Validate inputs
    if (!competitorName || newDifferential === undefined) {
      return { success: false, message: 'Missing required parameters' };
    }

    if (Math.abs(newDifferential) > 100) {
      return { success: false, message: 'Differential seems unreasonably large (max ±$100)' };
    }

    // Verify competitor exists
    const competitors = dataLoader.competitors || [];
    const competitorName_field = competitors[0]?.competitor_name ? 'competitor_name' : 'name';
    const competitor = competitors.find(c => {
      const name = c[competitorName_field] || c.name || c.competitor_name || '';
      return name.toLowerCase().includes(competitorName.toLowerCase());
    });

    if (!competitor) {
      const availableNames = [...new Set(competitors.map(c => c[competitorName_field] || c.name || c.competitor_name))];
      return {
        success: false,
        message: `Competitor "${competitorName}" not found. Available: ${availableNames.join(', ')}`
      };
    }

    const competitorFullName = competitor[competitorName_field] || competitor.name || competitor.competitor_name;
    
    // Save to persistent storage
    const parameters = {
      competitorName: competitorFullName,
      newDifferential,
      strategy: newDifferential < 0 ? 'undercut' : 'premium positioning'
    };
    await saveActionToConfig('differentials', parameters);
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      action: 'updateCompetitorDifferential',
      competitorName: competitorFullName,
      newDifferential,
      strategy: newDifferential < 0 ? 'undercut' : 'premium positioning',
      status: 'applied'
    };

    console.log('✓ Competitor Differential Updated:', logEntry);

    const direction = newDifferential < 0 ? 'below' : 'above';
    return {
      success: true,
      message: `Pricing set to $${Math.abs(newDifferential)} ${direction} ${competitorFullName}`,
      data: logEntry
    };
  } catch (error) {
    console.error('Error updating competitor differential:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Apply temporary pricing with automatic revert
 * @param {Array} roomPricing - Array of {roomType, currentPrice, newPrice}
 * @param {string} startDate - Start date (YYYY-MM-DD) or ISO datetime for hour-based
 * @param {string} endDate - End date (YYYY-MM-DD) or ISO datetime for hour-based
 * @param {string} reason - Reason for temporary pricing (e.g., "Competitor match", "Flash sale", "5-hour flash sale")
 */
async function applyTemporaryPricing(roomPricing, startDate, endDate, reason = 'Temporary offer') {
  try {
    // Validate inputs
    if (!Array.isArray(roomPricing) || roomPricing.length === 0) {
      return { success: false, message: 'No room pricing provided' };
    }

    if (!startDate || !endDate) {
      return { success: false, message: 'Missing start or end date' };
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return { success: false, message: 'Invalid date format' };
    }

    if (end < start) {
      return { success: false, message: 'End date must be after or equal to start date' };
    }

    const tempOfferId = `temp_${Date.now()}`;
    const appliedOverrides = [];
    const originalPrices = [];

    // Apply temporary prices for the date range
    for (const pricing of roomPricing) {
      const { roomType, currentPrice, newPrice } = pricing;

      if (!roomType || newPrice === undefined) {
        continue;
      }

      // Map AI room type to hotel room type for consistent matching
      const mappedRoomType = mapToHotelRoomType(roomType);
      const roomId = normalizeForComparison(roomType);

      // Store original price for revert
      originalPrices.push({
        roomId,
        roomType,
        mappedRoomType,
        originalPrice: currentPrice
      });

      // Apply override for each date in range
      const currentDate = new Date(start);
      while (currentDate <= end) {
        const dateStr = currentDate.toISOString().split('T')[0];

        // Apply price override with mapped room type
        const override = {
          roomId,
          mappedRoomType,
          date: dateStr,
          newPrice: parseInt(newPrice),
          isTemporary: true,
          tempOfferId,
          reason
        };

        await saveActionToConfig('overrides', override);
        appliedOverrides.push(override);

        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    // Save temporary offer metadata
    const tempOfferEntry = {
      tempOfferId,
      reason,
      startDate,
      endDate,
      roomPricing,
      originalPrices,
      appliedAt: new Date().toISOString()
    };
    await saveActionToConfig('temporaryOffers', tempOfferEntry);

    // Schedule automatic revert
    // For hour-based promotions (endDate contains time), revert at end time
    // For day-based promotions (endDate is just date), revert next day
    let revertDateStr;

    // Check if endDate includes time (ISO format with 'T')
    const isTimeBased = endDate.includes('T') || reason.toLowerCase().includes('hour');

    if (isTimeBased) {
      // Hour-based: revert at exact end time
      revertDateStr = new Date(end).toISOString();
    } else {
      // Day-based: revert next day at midnight
      const revertDate = new Date(end);
      revertDate.setDate(revertDate.getDate() + 1);
      revertDateStr = revertDate.toISOString().split('T')[0];
    }

    const scheduledRevert = {
      tempOfferId,
      revertDate: revertDateStr,
      originalPrices,
      status: 'scheduled',
      isTimeBased: isTimeBased
    };
    await saveActionToConfig('scheduledReverts', scheduledRevert);

    console.log('✓ Temporary pricing applied:', tempOfferEntry);
    console.log('✓ Scheduled revert:', scheduledRevert);

    // Format duration for human-readable message
    let durationText = '';
    if (isTimeBased && reason.includes('hour')) {
      // Match both "4-hour" and "4 hours" formats
      const hourMatch = reason.match(/(\d+)[\s-]?hours?/);
      const hours = hourMatch ? hourMatch[1] : '1';
      durationText = `for the next ${hours} ${hours === '1' ? 'hour' : 'hours'}`;
    } else {
      const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      durationText = `for ${daysDiff} ${daysDiff === 1 ? 'day' : 'days'}`;
    }

    // Build message for all rooms
    let messageText;
    if (roomPricing.length === 1) {
      const roomName = roomPricing[0].roomType;
      const oldPrice = roomPricing[0].currentPrice;
      const newPriceVal = roomPricing[0].newPrice;
      messageText = `Done. ${roomName} is now $${newPriceVal} ${durationText}. The system will automatically revert it to $${oldPrice} after that.`;
    } else {
      // Multiple rooms
      const roomDetails = roomPricing.map(rp => `${rp.roomType}: $${rp.currentPrice} → $${rp.newPrice}`).join(', ');
      const roomNames = roomPricing.map(rp => rp.roomType).join(', ');
      messageText = `Done. Applied ${durationText} pricing to ${roomPricing.length} rooms: ${roomDetails}. The system will automatically revert ${roomNames} after that.`;
    }

    return {
      success: true,
      message: `${messageText} You can see the updated prices on the dashboard right now. Keep an eye on bookings during this period.`,
      data: {
        tempOfferId,
        appliedOverrides: appliedOverrides.length,
        revertDate: revertDateStr,
        roomPricing
      }
    };
  } catch (error) {
    console.error('Error applying temporary pricing:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Process scheduled reverts (should be called by a background job)
 */
async function processScheduledReverts() {
  try {
    const config = await getActionConfig();
    const now = new Date();
    const scheduledReverts = config.scheduledReverts || [];

    const revertsToProcess = scheduledReverts.filter(r => {
      if (r.status !== 'scheduled') return false;

      const revertDate = new Date(r.revertDate);

      // For time-based reverts, check exact datetime
      if (r.isTimeBased) {
        return revertDate <= now;
      }

      // For day-based reverts, check date only
      const today = now.toISOString().split('T')[0];
      const revertDay = revertDate.toISOString().split('T')[0];
      return revertDay <= today;
    });

    if (revertsToProcess.length === 0) {
      return { success: true, message: 'No reverts to process', processed: 0 };
    }

    let processedCount = 0;

    for (const revert of revertsToProcess) {
      // Remove temporary overrides
      config.overrides = config.overrides.filter(o =>
        o.tempOfferId !== revert.tempOfferId
      );

      // Restore original prices
      for (const original of revert.originalPrices) {
        const dateStr = new Date().toISOString().split('T')[0];
        await saveActionToConfig('overrides', {
          roomId: original.roomId,
          date: dateStr,
          newPrice: parseInt(original.originalPrice),
          isRevert: true,
          revertedFrom: revert.tempOfferId
        });
      }

      // Mark revert as completed
      const revertIndex = config.scheduledReverts.findIndex(r => r.tempOfferId === revert.tempOfferId);
      if (revertIndex >= 0) {
        config.scheduledReverts[revertIndex].status = 'completed';
        config.scheduledReverts[revertIndex].completedAt = new Date().toISOString();
      }

      processedCount++;
    }

    // Save updated config
    await fs.writeFile(ACTIONS_CONFIG_PATH, JSON.stringify(config, null, 2));

    console.log(`✓ Processed ${processedCount} scheduled reverts`);

    return {
      success: true,
      message: `Processed ${processedCount} scheduled reverts`,
      processed: processedCount
    };
  } catch (error) {
    console.error('Error processing scheduled reverts:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Undo the last action (removes last override or reverts temporary pricing)
 * @returns {object} Result of undo operation
 */
async function undoLastAction() {
  try {
    const config = await getActionConfig();

    // Find the most recent action across all types
    let lastAction = null;
    let lastActionType = null;
    let lastTimestamp = null;

    // Check overrides
    if (config.overrides && config.overrides.length > 0) {
      const lastOverride = config.overrides[config.overrides.length - 1];
      if (!lastTimestamp || new Date(lastOverride.timestamp) > new Date(lastTimestamp)) {
        lastTimestamp = lastOverride.timestamp;
        lastAction = lastOverride;
        lastActionType = 'overrides';
      }
    }

    // Check temporary offers
    if (config.temporaryOffers && config.temporaryOffers.length > 0) {
      const lastTemp = config.temporaryOffers[config.temporaryOffers.length - 1];
      if (!lastTimestamp || new Date(lastTemp.timestamp) > new Date(lastTimestamp)) {
        lastTimestamp = lastTemp.timestamp;
        lastAction = lastTemp;
        lastActionType = 'temporaryOffers';
      }
    }

    // Check adjustments
    if (config.adjustments && config.adjustments.length > 0) {
      const lastAdj = config.adjustments[config.adjustments.length - 1];
      if (!lastTimestamp || new Date(lastAdj.timestamp) > new Date(lastTimestamp)) {
        lastTimestamp = lastAdj.timestamp;
        lastAction = lastAdj;
        lastActionType = 'adjustments';
      }
    }

    if (!lastAction) {
      return { success: false, message: 'No actions to undo' };
    }

    // Remove the last action
    if (lastActionType === 'overrides') {
      config.overrides.pop();

      // If this was a temporary offer, also remove related scheduled revert
      if (lastAction.tempOfferId) {
        config.scheduledReverts = (config.scheduledReverts || []).filter(
          r => r.tempOfferId !== lastAction.tempOfferId
        );
        config.temporaryOffers = (config.temporaryOffers || []).filter(
          t => t.tempOfferId !== lastAction.tempOfferId
        );
      }

      // Restore original price if available
      if (lastAction.originalPrice) {
        const roomType = lastAction.mappedRoomType || lastAction.roomId;
        if (dataLoader.rooms) {
          const room = dataLoader.rooms.find(r =>
            (r.room_type || '').toLowerCase() === roomType.toLowerCase()
          );
          if (room) room.base_price = parseFloat(lastAction.originalPrice);
        }
      }
    } else if (lastActionType === 'temporaryOffers') {
      // Remove the temporary offer and its overrides
      const tempOffer = config.temporaryOffers.pop();

      // Remove related overrides
      config.overrides = (config.overrides || []).filter(
        o => o.tempOfferId !== tempOffer.tempOfferId
      );

      // Remove scheduled revert
      config.scheduledReverts = (config.scheduledReverts || []).filter(
        r => r.tempOfferId !== tempOffer.tempOfferId
      );

      // Restore original prices
      if (tempOffer.originalPrices) {
        for (const orig of tempOffer.originalPrices) {
          if (dataLoader.rooms) {
            const room = dataLoader.rooms.find(r =>
              (r.room_type || '').toLowerCase() === orig.roomType.toLowerCase()
            );
            if (room) room.base_price = parseFloat(orig.originalPrice);
          }
        }
      }
    } else if (lastActionType === 'adjustments') {
      const adjustment = config.adjustments.pop();

      // Revert the price adjustment by applying inverse percentage
      if (adjustment.roomTypes && adjustment.percentage) {
        const fsSync = require('fs');
        const roomsCsvPath = path.resolve(__dirname, '../data/csv/rooms.csv');

        // Calculate inverse percentage: if we increased by 10%, decrease by ~9.09% (1/1.1)
        // if we decreased by 15%, increase by ~17.65% (1/0.85)
        const inverseMultiplier = 1 / (1 + adjustment.percentage / 100);

        adjustment.roomTypes.forEach(roomType => {
          const room = dataLoader.rooms.find(r => (r.room_type || r['Room Type']) === roomType);
          if (room) {
            const currentPrice = parseFloat(room.base_price || room['Base Price']);
            const revertedPrice = Math.round(currentPrice * inverseMultiplier);
            dataLoader.updateRoomPrice(roomType, revertedPrice);
            console.log(`✓ Reverted ${roomType} from $${currentPrice} to $${revertedPrice}`);
          }
        });

        // Update CSV file to persist changes
        let csvLines = fsSync.readFileSync(roomsCsvPath, 'utf8').split('\n');
        csvLines = csvLines.map((line, idx) => {
          if (idx === 0 || !line.trim()) return line;
          const parts = line.split(',');
          const roomTypeInCsv = parts[0];
          if (adjustment.roomTypes.includes(roomTypeInCsv)) {
            const room = dataLoader.rooms.find(r => (r.room_type || r['Room Type']) === roomTypeInCsv);
            if (room) {
              parts[2] = String(room.base_price || room['Base Price']);
              return parts.join(',');
            }
          }
          return line;
        });
        fsSync.writeFileSync(roomsCsvPath, csvLines.join('\n'));
        console.log('✓ CSV file updated with reverted prices');
      }
    }

    // Save updated config
    await fs.writeFile(ACTIONS_CONFIG_PATH, JSON.stringify(config, null, 2));

    const roomName = lastAction.mappedRoomType || lastAction.roomId || lastAction.roomTypes?.join(', ') || 'Room';

    console.log(`✓ Undo successful: removed ${lastActionType} action for ${roomName}`);

    return {
      success: true,
      message: `Undo successful! Removed the last ${lastActionType.replace(/s$/, '')} action for ${roomName}. The price has been reverted.`,
      data: {
        undoneAction: lastAction,
        actionType: lastActionType
      }
    };
  } catch (error) {
    console.error('Error undoing action:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Apply multiple promotions at once
 * @param {Array} promotions - Array of {roomType, currentPrice, newPrice, percentage, promotionType}
 * @param {boolean} applyAll - If true, apply all promotions
 * @returns {object} Result with all applied promotions
 */
async function applyMultiplePromotions(promotions) {
  try {
    if (!Array.isArray(promotions) || promotions.length === 0) {
      return { success: false, message: 'No promotions provided' };
    }

    const results = [];
    const errors = [];
    let totalOldRevenue = 0;
    let totalNewRevenue = 0;

    for (const promo of promotions) {
      const { roomType, newPrice, percentage } = promo;

      if (!roomType || newPrice === undefined) {
        errors.push({ roomType: roomType || 'Unknown', error: 'Missing required fields' });
        continue;
      }

      try {

        // Apply the price change directly to CSV and memory
        const rooms = dataLoader.rooms || [];
        const room = rooms.find(r =>
          (r.room_type || r['Room Type']).toLowerCase() === roomType.toLowerCase()
        );

        if (!room) {
          errors.push({ roomType, error: 'Room type not found' });
          continue;
        }

        const totalRooms = parseInt(room.total_rooms || room['Total Rooms'] || 10);
        const oldPrice = parseFloat(room.base_price || room['Base Price']);

        // Update the room price in memory
        if (room.base_price !== undefined) {
          room.base_price = newPrice;
        }
        if (room['Base Price'] !== undefined) {
          room['Base Price'] = newPrice;
        }

        // Update CSV
        const roomsCsvPath = path.resolve(__dirname, '../data/csv/rooms.csv');
        let csvLines = require('fs').readFileSync(roomsCsvPath, 'utf8').split('\n');
        csvLines = csvLines.map((line, idx) => {
          if (idx === 0 || !line.trim()) return line;
          const parts = line.split(',');
          if (parts[0] && parts[0].toLowerCase() === roomType.toLowerCase()) {
            parts[2] = String(newPrice);
            return parts.join(',');
          }
          return line;
        });
        require('fs').writeFileSync(roomsCsvPath, csvLines.join('\n'));

        // Save to config for undo tracking
        await saveActionToConfig('adjustments', {
          roomTypes: [roomType],
          percentage,
          scope: 'all',
          promotionType: promo.promotionType,
          oldPrice,
          newPrice
        });

        // Calculate revenue impact (30-day projection)
        const occupancyEstimate = 0.5; // Conservative 50% estimate
        const oldMonthlyRevenue = oldPrice * totalRooms * occupancyEstimate * 30;
        const newMonthlyRevenue = newPrice * totalRooms * occupancyEstimate * 30;
        const revenueImpact = newMonthlyRevenue - oldMonthlyRevenue;

        totalOldRevenue += oldMonthlyRevenue;
        totalNewRevenue += newMonthlyRevenue;

        results.push({
          roomType,
          oldPrice,
          newPrice,
          percentage,
          promotionType: promo.promotionType,
          revenueImpact: Math.round(revenueImpact),
          status: 'applied'
        });

        console.log(`✓ Applied ${promo.promotionType}: ${roomType} $${oldPrice} → $${newPrice}`);

      } catch (err) {
        errors.push({ roomType, error: err.message });
        console.error(`✗ Failed to apply promotion for ${roomType}:`, err.message);
      }
    }

    if (results.length === 0) {
      return {
        success: false,
        message: 'Failed to apply any promotions',
        errors
      };
    }

    const totalRevenueImpact = Math.round(totalNewRevenue - totalOldRevenue);

    // Build detailed response message
    let message = `Applied ${results.length} promotional strategies:\n\n`;

    results.forEach((r, idx) => {
      const changeDir = r.percentage >= 0 ? '+' : '';
      message += `${idx + 1}. ${r.roomType}: $${r.oldPrice} → $${r.newPrice} (${changeDir}${r.percentage}%)\n`;
      message += `   Type: ${r.promotionType?.replace(/_/g, ' ')}\n`;
      message += `   30-Day Revenue Impact: ${r.revenueImpact >= 0 ? '+' : ''}$${r.revenueImpact}\n\n`;
    });

    message += `--- Total Impact ---\n`;
    message += `Total 30-Day Revenue Change: ${totalRevenueImpact >= 0 ? '+' : ''}$${totalRevenueImpact}\n`;

    if (errors.length > 0) {
      message += `\nNote: ${errors.length} promotion(s) could not be applied.`;
    }

    return {
      success: true,
      message,
      data: {
        applied: results,
        errors,
        totalRevenueImpact,
        appliedCount: results.length,
        errorCount: errors.length
      }
    };

  } catch (error) {
    console.error('Error applying multiple promotions:', error);
    return { success: false, message: error.message };
  }
}

module.exports = {
  applyPriceOverride,
  adjustRateClamp,
  updateCompetitorWeight,
  updateCompetitorDifferential,
  applyPriceIncrease,
  applyWeekendRateIncrease,
  applyTemporaryPricing,
  applyMultiplePromotions,
  processScheduledReverts,
  undoLastAction,
  getActionConfig // Export for reading stored actions
};
