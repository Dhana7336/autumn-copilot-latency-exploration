const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const agent = require('../copilot/agent');
const { validateString, validateObject, validateActionName, sanitizeInput } = require('../middleware/validation');
const { invalidateOnAction, cache } = require('../utils/cache');
const { estimateRevenueImpact, calculateOccupancy } = require('../utils/revenueCalculations');
const dataLoader = require('../services/dataLoader');
const AUDIT_PATH = path.resolve(__dirname, '../data/audit.json');

/**
 * Generate future analysis for applied actions
 * @param {string} actionName - Name of the action
 * @param {object} parameters - Action parameters
 * @param {object} result - Action result
 * @returns {object} Future analysis with revenue projections
 */
function generateFutureAnalysis(actionName, parameters, result) {
  const analysis = {
    summary: '',
    projections: [],
    recommendations: [],
    followUp: ''
  };

  const rooms = dataLoader.rooms || [];
  const reservations = dataLoader.reservations || [];

  try {
    if (actionName === 'applyPriceIncrease' || actionName === 'applyWeekendRateIncrease') {
      const updates = result.data || [];

      updates.forEach(update => {
        const room = rooms.find(r => (r.room_type || r['Room Type']) === update.roomType);
        const totalRooms = room ? parseInt(room.total_rooms || room['Total Rooms'] || 10) : 10;

        const occupancyData = calculateOccupancy(reservations, update.roomType, totalRooms);
        const impact = estimateRevenueImpact(
          update.oldPrice,
          update.newPrice,
          occupancyData.rate,
          totalRooms,
          30
        );

        analysis.projections.push({
          roomType: update.roomType,
          priceChange: `$${update.oldPrice} → $${update.newPrice}`,
          currentOccupancy: `${impact.currentOccupancy}%`,
          projectedOccupancy: `${impact.projectedOccupancy}%`,
          revenueImpact: impact.revenueDelta >= 0 ? `+$${impact.revenueDelta}` : `-$${Math.abs(impact.revenueDelta)}`,
          revenueChange: `${impact.revenueDeltaPct}%`,
          riskLevel: impact.riskLevel,
          period: '30-day projection'
        });
      });

      const isDecrease = (parameters.percentage || 0) < 0;
      analysis.summary = isDecrease
        ? 'Price reduction applied to boost occupancy'
        : 'Price increase applied to maximize revenue';

      analysis.recommendations.push(
        'Monitor booking velocity over the next 48-72 hours',
        'Compare competitor rates weekly',
        isDecrease ? 'Track if occupancy increases as expected' : 'Watch for any drop in conversion rates'
      );
    }

    else if (actionName === 'adjustRateClamp') {
      const roomType = parameters.roomType;
      const clampType = parameters.clampType;
      const newValue = parameters.newValue;

      analysis.projections.push({
        roomType: roomType,
        change: `${clampType === 'floor' ? 'Minimum' : 'Maximum'} price set to $${newValue}`,
        dateRange: `${parameters.startDate} to ${parameters.endDate}`,
        effect: clampType === 'floor'
          ? 'Prevents prices from dropping below this level'
          : 'Caps prices to maintain competitiveness',
        riskLevel: 'low'
      });

      analysis.summary = `Rate ${clampType} constraint applied`;
      analysis.recommendations.push(
        `Pricing will automatically stay ${clampType === 'floor' ? 'above' : 'below'} $${newValue}`,
        'Review clamp settings monthly based on market conditions'
      );
    }

    else if (actionName === 'applyTemporaryPricing') {
      const roomPricing = parameters.roomPricing || [];

      roomPricing.forEach(rp => {
        const room = rooms.find(r => (r.room_type || r['Room Type']).toLowerCase() === rp.roomType.toLowerCase());
        const totalRooms = room ? parseInt(room.total_rooms || room['Total Rooms'] || 10) : 10;
        const occupancyData = calculateOccupancy(reservations, rp.roomType, totalRooms);

        const impact = estimateRevenueImpact(
          rp.currentPrice,
          rp.newPrice,
          occupancyData.rate,
          totalRooms,
          7
        );

        analysis.projections.push({
          roomType: rp.roomType,
          priceChange: `$${rp.currentPrice} → $${rp.newPrice}`,
          duration: `${parameters.startDate} to ${parameters.endDate}`,
          projectedOccupancyBoost: `${impact.occupancyDelta > 0 ? '+' : ''}${impact.occupancyDelta}%`,
          shortTermImpact: impact.revenueDelta >= 0 ? `+$${impact.revenueDelta}` : `-$${Math.abs(impact.revenueDelta)}`,
          autoRevert: 'Yes - prices will automatically restore',
          riskLevel: impact.riskLevel
        });
      });

      analysis.summary = 'Temporary promotional pricing activated';
      analysis.recommendations.push(
        'Prices will automatically revert after the promotion ends',
        'Track booking surge during promotional period',
        'Consider extending if results are positive'
      );
    }

    else if (actionName === 'updateCompetitorDifferential' || actionName === 'updateCompetitorWeight') {
      analysis.projections.push({
        competitor: parameters.competitorName,
        change: actionName === 'updateCompetitorDifferential'
          ? `Positioning: $${Math.abs(parameters.newDifferential)} ${parameters.newDifferential < 0 ? 'below' : 'above'}`
          : `Weight: ${Math.round((parameters.newWeight || 0) * 100)}%`,
        effect: 'Pricing algorithm will adjust recommendations accordingly',
        riskLevel: 'low'
      });

      analysis.summary = 'Competitor strategy updated';
      analysis.recommendations.push(
        'Review competitor positioning weekly',
        'Monitor market share changes'
      );
    }

    // Generate follow-up prompt
    analysis.followUp = generateFollowUpPrompt(actionName);

  } catch (err) {
    console.error('Error generating future analysis:', err);
    analysis.summary = 'Action applied successfully';
    analysis.followUp = 'Would you like to make any other pricing adjustments or review the dashboard?';
  }

  return analysis;
}

/**
 * Generate a conversational follow-up prompt
 */
function generateFollowUpPrompt(actionName) {
  // Action-specific follow-ups
  if (actionName === 'applyPriceIncrease' || actionName === 'applyWeekendRateIncrease') {
    return 'Would you like to implement similar strategies for other room types, or should I monitor the impact of this change?';
  }

  if (actionName === 'applyTemporaryPricing') {
    return 'The promotion is now active. Would you like to extend it to other room categories, or should I set up alerts for booking velocity?';
  }

  if (actionName === 'adjustRateClamp') {
    return 'Rate constraints are now in place. Would you like to set similar constraints for other room types or adjust the date range?';
  }

  return 'Would you like to implement any of these strategies for other areas, or need further assistance with specific promotional actions?';
}

/**
 * Format analysis for chat display
 *
 * List formatting rules:
 * - One blank line before the list
 * - No blank lines inside the list
 * - Consistent bullet style (•)
 */
function formatAnalysisForChat(analysis, result) {
  let output = '';

  // Summary
  if (analysis.summary) {
    output += `${analysis.summary}\n\n`;
  }

  // Action result message
  if (result.message) {
    output += `${result.message}\n\n`;
  }

  // Future Analysis Section
  if (analysis.projections && analysis.projections.length > 0) {
    output += '--- Future Analysis ---\n';

    analysis.projections.forEach((proj, idx) => {
      output += `\n${proj.roomType || proj.competitor || 'Item ' + (idx + 1)}:\n`;

      // Build details as a compact list (no blank lines inside)
      if (proj.priceChange) output += `  Price: ${proj.priceChange}\n`;
      if (proj.currentOccupancy) output += `  Current Occupancy: ${proj.currentOccupancy}\n`;
      if (proj.projectedOccupancy) output += `  Projected Occupancy: ${proj.projectedOccupancy}\n`;
      if (proj.projectedOccupancyBoost) output += `  Occupancy Impact: ${proj.projectedOccupancyBoost}\n`;
      if (proj.revenueImpact) output += `  30-Day Revenue Impact: ${proj.revenueImpact} (${proj.revenueChange})\n`;
      if (proj.shortTermImpact) output += `  7-Day Revenue Impact: ${proj.shortTermImpact}\n`;
      if (proj.duration) output += `  Duration: ${proj.duration}\n`;
      if (proj.dateRange) output += `  Date Range: ${proj.dateRange}\n`;
      if (proj.autoRevert) output += `  Auto-Revert: ${proj.autoRevert}\n`;
      if (proj.riskLevel) output += `  Risk Level: ${proj.riskLevel}\n`;
      if (proj.change) output += `  Change: ${proj.change}\n`;
      if (proj.effect) output += `  Effect: ${proj.effect}\n`;
    });
  }

  // Recommendations - one blank line before, no blank lines inside
  if (analysis.recommendations && analysis.recommendations.length > 0) {
    output += '\n--- Recommendations ---\n';
    analysis.recommendations.forEach(rec => {
      output += `• ${rec}\n`;
    });
  }

  // Follow-up prompt - one blank line before
  if (analysis.followUp) {
    output += `\n${analysis.followUp}`;
  }

  return output.trim();
}

// Execute an approved action
router.post('/execute', async (req, res) => {
  try {
    const { actionName, parameters, operator, operatorName, prompt } = req.body;
    
    // Validate required fields
    if (!actionName || !parameters) {
      return res.status(400).json({ error: 'Missing actionName or parameters' });
    }
    
    const actionValidation = validateString(actionName, 'actionName', 1, 100);
    if (!actionValidation.valid) {
      return res.status(400).json({ error: actionValidation.error });
    }
    
    const actionNameValidation = validateActionName(actionName);
    if (!actionNameValidation.valid) {
      return res.status(400).json({ error: actionNameValidation.error });
    }
    
    const paramsValidation = validateObject(parameters, 'parameters');
    if (!paramsValidation.valid) {
      return res.status(400).json({ error: paramsValidation.error });
    }
    
    if (operator) {
      const operatorValidation = validateString(operator, 'operator', 1, 200);
      if (!operatorValidation.valid) {
        return res.status(400).json({ error: operatorValidation.error });
      }
    }
    
    if (prompt) {
      const promptValidation = validateString(prompt, 'prompt', 1, 5000);
      if (!promptValidation.valid) {
        return res.status(400).json({ error: promptValidation.error });
      }
    }
    
    // Import actions module
    const actions = require('../copilot/actions');
    
    // Verify action exists
    if (typeof actions[actionName] !== 'function') {
      return res.status(400).json({ 
        error: 'Invalid action',
        message: `Action "${actionName}" is not recognized`,
        validActions: Object.keys(actions).filter(key => typeof actions[key] === 'function')
      });
    }
    
    console.log(`🎯 Executing action: ${actionName}`, parameters);
    
    // Execute the action with proper parameter mapping
    let result;
    try {
      switch (actionName) {
        case 'applyPriceOverride':
          result = await actions.applyPriceOverride(parameters.roomId, parameters.date, parameters.newPrice);
          break;
        case 'adjustRateClamp':
          result = await actions.adjustRateClamp(parameters.roomType, parameters.clampType, parameters.newValue, parameters.startDate, parameters.endDate);
          break;
        case 'updateCompetitorWeight':
          result = await actions.updateCompetitorWeight(parameters.competitorName, parameters.newWeight);
          break;
        case 'updateCompetitorDifferential':
          result = await actions.updateCompetitorDifferential(parameters.competitorName, parameters.newDifferential);
          break;
        case 'applyPriceIncrease':
          result = await actions.applyPriceIncrease(parameters.roomTypes, parameters.percentage, parameters.scope);
          break;
        case 'applyWeekendRateIncrease':
          result = await actions.applyWeekendRateIncrease(parameters.roomTypes, parameters.percentage, parameters.scope);
          break;
        case 'applyTemporaryPricing':
          result = await actions.applyTemporaryPricing(parameters.roomPricing, parameters.startDate, parameters.endDate, parameters.reason);
          break;
        case 'applyMultiplePromotions':
          result = await actions.applyMultiplePromotions(parameters.promotions);
          break;
        case 'undoLastAction':
          result = await actions.undoLastAction();
          break;
        default:
          throw new Error(`Unknown action: ${actionName}`);
      }
    } catch (error) {
      console.error('Action execution error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to execute action',
        message: error.message
      });
    }
    
    // Create audit entry
    const auditEntry = {
      time: new Date().toISOString(),
      operator: operator || 'system@hotel.com',
      operatorName: operatorName || (operator || 'System User'),
      prompt: prompt || `Direct action: ${actionName}`,
      intent: actionName,
      approvals: [{
        actionName,
        parameters,
        approved: true,
        timestamp: new Date().toISOString()
      }],
      applied: [{
        success: result.success,
        message: result.message,
        data: result.data,
        actionName,
        parameters,
        timestamp: new Date().toISOString()
      }],
      isTemporary: actionName === 'applyTemporaryPricing'
    };
    
    // Save to audit log
    try {
      const auditLog = await fs.readFile(AUDIT_PATH, 'utf8')
        .then(d => JSON.parse(d))
        .catch(() => []);
      auditLog.push(auditEntry);
      await fs.writeFile(AUDIT_PATH, JSON.stringify(auditLog, null, 2), 'utf8');
      console.log('✓ Audit log updated');
    } catch (auditErr) {
      console.error('⚠️ Audit log write failed:', auditErr);
    }
    
    agent.logAudit(auditEntry);

    // Invalidate cache after action execution
    invalidateOnAction();

    // Generate future analysis for the applied action
    const futureAnalysis = generateFutureAnalysis(actionName, parameters, result);

    // Format the enhanced message with analysis
    const enhancedMessage = formatAnalysisForChat(futureAnalysis, result);

    res.json({
      success: result.success,
      message: enhancedMessage,
      originalMessage: result.message,
      data: result.data,
      futureAnalysis: futureAnalysis,
      audit: auditEntry
    });
    
  } catch (err) {
    console.error('❌ Action execution error:', err);
    res.status(500).json({
      error: 'Failed to execute action',
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Undo the last action
router.post('/undo', async (req, res) => {
  try {
    const actions = require('../copilot/actions');
    const result = await actions.undoLastAction();

    if (result.success) {
      console.log('✓ Undo action executed successfully');
      // Invalidate cache after undo
      invalidateOnAction();
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (err) {
    console.error('❌ Undo action error:', err);
    res.status(500).json({
      error: 'Failed to undo action',
      details: err.message
    });
  }
});

// Get action configuration
router.get('/config', async (req, res) => {
  try {
    const actions = require('../copilot/actions');
    const config = await actions.getActionConfig();
    
    res.json({
      success: true,
      data: config,
      summary: {
        totalOverrides: config.overrides?.length || 0,
        totalClamps: config.clamps?.length || 0,
        activeWeights: config.weights?.length || 0,
        activeDifferentials: config.differentials?.length || 0
      }
    });
  } catch (err) {
    console.error('Failed to load action config:', err);
    res.status(500).json({ error: 'Failed to load action configuration' });
  }
});

// Get cache statistics
router.get('/cache-stats', (req, res) => {
  res.json({
    success: true,
    stats: cache.getStats()
  });
});

// Clear cache manually
router.post('/cache-clear', (req, res) => {
  cache.clear();
  console.log('[Cache] Manually cleared');
  res.json({
    success: true,
    message: 'Cache cleared'
  });
});

module.exports = router;