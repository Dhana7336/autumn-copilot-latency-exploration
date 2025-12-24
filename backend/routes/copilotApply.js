/**
 * Copilot Apply Route
 * Handles action execution and audit logging
 */

const express = require('express');
const router = express.Router();

const agent = require('../copilot/agent');
const { saveAuditEntry, createAuditEntry } = require('../utils/approvalFlow');

router.post('/', async (req, res) => {
  try {
    const { actionName, parameters, operator, operatorName, prompt } = req.body;

    if (!actionName || !parameters) {
      return res.status(400).json({ error: 'Missing actionName or parameters' });
    }

    const actions = require('../copilot/actions');

    if (typeof actions[actionName] !== 'function') {
      return res.status(400).json({
        error: 'Invalid action',
        validActions: Object.keys(actions).filter(k => typeof actions[k] === 'function')
      });
    }

    console.log(`🎯 Applying action: ${actionName}`, parameters);

    let result;
    switch (actionName) {
      case 'applyPriceOverride':
        result = await actions.applyPriceOverride(parameters.roomId, parameters.date, parameters.newPrice);
        break;
      case 'adjustRateClamp':
        result = await actions.adjustRateClamp(parameters.roomType, parameters.clampType, parameters.newValue, parameters.startDate, parameters.endDate);
        break;
      case 'applyTemporaryPricing':
        result = await actions.applyTemporaryPricing(parameters.roomPricing, parameters.startDate, parameters.endDate, parameters.reason);
        break;
      case 'applyPriceIncrease':
        result = await actions.applyPriceIncrease(parameters.roomTypes, parameters.percentage, parameters.scope);
        break;
      case 'updateCompetitorDifferential':
        result = await actions.updateCompetitorDifferential(parameters.competitorName, parameters.newDifferential);
        break;
      case 'updateCompetitorWeight':
        result = await actions.updateCompetitorWeight(parameters.competitorName, parameters.newWeight);
        break;
      case 'applyWeekendRateIncrease':
        result = await actions.applyWeekendRateIncrease(parameters.roomTypes, parameters.percentage, parameters.scope);
        break;
      case 'applyMultiplePromotions':
        result = await actions.applyMultiplePromotions(parameters.promotions);
        break;
      case 'undoLastAction':
        result = await actions.undoLastAction();
        break;
      default:
        result = await actions[actionName](...Object.values(parameters));
    }

    const actionProposal = { actionName, parameters, description: `${actionName} action` };
    const auditEntry = createAuditEntry(
      actionProposal,
      result,
      operatorName || operator || 'system',
      prompt || `Action: ${actionName}`
    );

    const saved = await saveAuditEntry(auditEntry);
    if (!saved) {
      console.warn('Failed to persist audit entry');
    }

    agent.logAudit(auditEntry);

    res.json({
      success: result.success,
      message: result.message,
      data: result.data,
      audit: auditEntry
    });

  } catch (err) {
    console.error('Apply error:', err);
    res.status(500).json({ error: 'Failed to apply action', details: err.message });
  }
});

module.exports = router;
