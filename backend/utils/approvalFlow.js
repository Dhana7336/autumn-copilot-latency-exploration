const fs = require('fs').promises;
const path = require('path');

const AUDIT_PATH = path.resolve(__dirname, '../data/audit.json');

const pendingActions = new Map();

/**
 * Check if user message is an approval
 * @param {string} message - User message
 * @returns {boolean}
 */
function isApprovalMessage(message) {
  const approvalPhrases = [
    'yes', 'ok', 'okay', 'approve', 'approved', 'apply',
    'proceed', 'go ahead', 'do it', 'execute', 'confirm',
    'yes please', 'yes apply', 'apply it', 'yes do it'
  ];

  const lower = message.toLowerCase().trim();

  // Exact match or starts with approval phrase
  return approvalPhrases.some(phrase =>
    lower === phrase ||
    lower.startsWith(phrase + ' ') ||
    lower.startsWith(phrase + ',') ||
    lower.startsWith(phrase + '.')
  );
}

/**
 * Extract specific room from user message (returns first match)
 * @param {string} message - User message
 * @returns {string|null} Room name or null
 */
function extractRoomFromMessage(message) {
  const rooms = extractRoomsFromMessage(message);
  return rooms.length > 0 ? rooms[0] : null;
}

/**
 * Extract ALL rooms mentioned in user message
 * @param {string} message - User message
 * @returns {string[]} Array of room names
 */
function extractRoomsFromMessage(message) {
  const lower = message.toLowerCase();
  const foundRooms = [];

  // Check for Lily Hall room names
  const roomMap = {
    'bernard': 'Bernard',
    'larua': 'LaRua',
    'santiago': 'Santiago',
    'pilar': 'Pilar',
    'mariana': 'Mariana'
  };

  for (const [key, value] of Object.entries(roomMap)) {
    if (lower.includes(key) && !foundRooms.includes(value)) {
      foundRooms.push(value);
    }
  }

  // Check for AI room names (only if not already found by direct name)
  const aiRoomMap = {
    'standard': 'Bernard',
    'deluxe': 'LaRua',
    'executive': 'Santiago',
    'premium': 'Pilar',
    'presidential': 'Mariana'
  };

  for (const [key, value] of Object.entries(aiRoomMap)) {
    if (lower.includes(key) && !foundRooms.includes(value)) {
      foundRooms.push(value);
    }
  }

  return foundRooms;
}

/**
 * Check if user message is a rejection
 * @param {string} message - User message
 * @returns {boolean}
 */
function isRejectionMessage(message) {
  const rejectionPhrases = [
    'no', 'cancel', 'reject', 'stop', 'don\'t', 'dont',
    'nevermind', 'never mind', 'abort', 'nope', 'nah'
  ];

  const lower = message.toLowerCase().trim();
  return rejectionPhrases.some(phrase => lower.startsWith(phrase));
}

/**
 * Store a pending action for approval
 * @param {string} sessionId - User session ID
 * @param {object} actionProposal - The proposed action
 */
function storePendingAction(sessionId, actionProposal) {
  pendingActions.set(sessionId, {
    ...actionProposal,
    createdAt: new Date().toISOString(),
    status: 'pending'
  });
}

/**
 * Get pending action for a session
 * @param {string} sessionId - User session ID
 * @returns {object|null}
 */
function getPendingAction(sessionId) {
  return pendingActions.get(sessionId) || null;
}

/**
 * Clear pending action for a session
 * @param {string} sessionId - User session ID
 */
function clearPendingAction(sessionId) {
  pendingActions.delete(sessionId);
}

/**
 * Find pending action from conversation history
 * @param {Array} conversationHistory - Previous messages
 * @returns {object|null}
 */
function findPendingActionFromHistory(conversationHistory) {
  if (!conversationHistory || conversationHistory.length === 0) return null;

  // Look backwards through history for last action proposal
  for (let i = conversationHistory.length - 1; i >= 0; i--) {
    const msg = conversationHistory[i];
    if (msg.role === 'assistant' && msg.actionProposal && msg.actionProposal.actionName) {
      return msg.actionProposal;
    }
  }

  return null;
}

/**
 * Filter action proposal to a specific room
 * @param {object} actionProposal - The full action proposal
 * @param {string} roomName - The specific room to filter to
 * @returns {object} Filtered action proposal
 */
function filterActionToRoom(actionProposal, roomName) {
  return filterActionToRooms(actionProposal, [roomName]);
}

/**
 * Filter action proposal to multiple rooms
 * @param {object} actionProposal - The full action proposal
 * @param {string[]} roomNames - Array of room names to filter to
 * @returns {object} Filtered action proposal
 */
function filterActionToRooms(actionProposal, roomNames) {
  if (!actionProposal || !roomNames || roomNames.length === 0) return actionProposal;

  const lowerRoomNames = roomNames.map(r => r.toLowerCase());

  // Handle applyMultiplePromotions - filter to specified rooms
  if (actionProposal.actionName === 'applyMultiplePromotions' && actionProposal.parameters?.promotions) {
    const filteredPromotions = actionProposal.parameters.promotions.filter(promo =>
      lowerRoomNames.includes(promo.roomType?.toLowerCase())
    );

    if (filteredPromotions.length > 0) {
      // Build roomPricing array for all matching rooms
      const roomPricing = filteredPromotions.map(promo => ({
        roomType: promo.roomType,
        currentPrice: promo.currentPrice,
        newPrice: promo.newPrice
      }));

      const roomDescriptions = roomPricing.map(rp => `${rp.roomType}: $${rp.currentPrice} → $${rp.newPrice}`).join(', ');
      const reason = filteredPromotions[0].reason || '10% promotion';

      return {
        actionName: 'applyTemporaryPricing',
        parameters: {
          roomPricing,
          startDate: filteredPromotions[0].startDate || new Date().toISOString(),
          endDate: filteredPromotions[0].endDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          reason
        },
        description: `Apply ${reason} to ${roomPricing.length} room(s): ${roomDescriptions}`,
        confidence: 0.9,
        reasoning: `Selected ${roomNames.join(', ')} from available promotions`
      };
    }
  }

  // Handle applyTemporaryPricing with multiple rooms - filter to specified rooms
  if (actionProposal.actionName === 'applyTemporaryPricing' && actionProposal.parameters?.roomPricing) {
    const filteredPricing = actionProposal.parameters.roomPricing.filter(rp =>
      lowerRoomNames.includes(rp.roomType?.toLowerCase())
    );

    if (filteredPricing.length > 0) {
      const roomDescriptions = filteredPricing.map(rp => `${rp.roomType}: $${rp.currentPrice} → $${rp.newPrice}`).join(', ');
      return {
        ...actionProposal,
        parameters: {
          ...actionProposal.parameters,
          roomPricing: filteredPricing
        },
        description: `Apply promotion to ${filteredPricing.length} room(s): ${roomDescriptions}`
      };
    }
  }

  return actionProposal;
}

/**
 * Check if message is requesting to apply a specific room offer
 * e.g., "apply Mariana", "apply Bernard and Santiago", "apply the LaRua promotion"
 * @param {string} message - User message
 * @returns {boolean}
 */
function isSpecificRoomApplyRequest(message) {
  const lower = message.toLowerCase().trim();
  const hasApplyWord = lower.startsWith('apply') || lower.includes('apply the') || lower.includes('apply this');
  const hasRooms = extractRoomsFromMessage(message).length > 0;
  return hasApplyWord && hasRooms;
}

/**
 * Check if message is a simple confirmation (yes, ok, confirm, etc.)
 * WITHOUT a room name - meaning user is confirming a previous proposal
 * @param {string} message - User message
 * @returns {boolean}
 */
function isSimpleConfirmation(message) {
  const confirmPhrases = ['yes', 'ok', 'okay', 'confirm', 'proceed', 'go ahead', 'do it', 'yes please'];
  const lower = message.toLowerCase().trim();
  return confirmPhrases.some(phrase => lower === phrase || lower === phrase + '!');
}

/**
 * Process approval flow
 * @param {string} message - User message
 * @param {string} sessionId - Session ID
 * @param {Array} conversationHistory - Previous messages
 * @returns {object} Flow result
 */
function processApprovalFlow(message, sessionId, conversationHistory = []) {
  // Extract ALL rooms mentioned (not just first one)
  const specificRooms = extractRoomsFromMessage(message);
  const hasRooms = specificRooms.length > 0;

  // Case 1: User says "apply [room(s)]" - show confirmation for those specific rooms
  if (isSpecificRoomApplyRequest(message) && hasRooms) {
    let pendingAction = getPendingAction(sessionId);
    if (!pendingAction) {
      pendingAction = findPendingActionFromHistory(conversationHistory);
    }

    if (pendingAction) {
      // Filter to ALL specified rooms (not just first one)
      const filteredAction = filterActionToRooms(pendingAction, specificRooms);

      // Store the filtered action for next confirmation
      storePendingAction(sessionId, filteredAction);

      const roomLabel = specificRooms.length === 1 ? specificRooms[0] : `${specificRooms.length} rooms (${specificRooms.join(', ')})`;

      return {
        type: 'NEEDS_CONFIRMATION',
        actionProposal: {
          ...filteredAction,
          requiresApproval: true
        },
        message: `Ready to apply offer for ${roomLabel}:\n\n${filteredAction.description}\n\nShould I proceed? (yes/no)`
      };
    }

    return {
      type: 'NO_PENDING_ACTION',
      message: `No pending offers found. Would you like me to show available promotions?`
    };
  }

  // Case 2: Simple confirmation (yes, ok, confirm) - execute the pending action
  if (isSimpleConfirmation(message)) {
    let pendingAction = getPendingAction(sessionId);

    if (!pendingAction) {
      pendingAction = findPendingActionFromHistory(conversationHistory);
    }

    if (pendingAction) {
      clearPendingAction(sessionId);

      return {
        type: 'APPROVAL',
        actionProposal: {
          ...pendingAction,
          requiresApproval: false
        },
        message: `Approval received. Executing: ${pendingAction.description}`
      };
    }

    return {
      type: 'NO_PENDING_ACTION',
      message: 'Nothing to approve. What would you like me to do?'
    };
  }

  // Case 3: Generic approval message (apply, approve, etc.) without specific room - apply all
  if (isApprovalMessage(message) && !hasRooms) {
    let pendingAction = getPendingAction(sessionId);

    if (!pendingAction) {
      pendingAction = findPendingActionFromHistory(conversationHistory);
    }

    if (pendingAction) {
      clearPendingAction(sessionId);

      return {
        type: 'APPROVAL',
        actionProposal: {
          ...pendingAction,
          requiresApproval: false
        },
        message: `Approval received. Executing: ${pendingAction.description}`
      };
    }

    return {
      type: 'NO_PENDING_ACTION',
      message: 'Nothing to approve. What would you like me to do?'
    };
  }

  // Case 4: Rejection
  if (isRejectionMessage(message)) {
    clearPendingAction(sessionId);
    return {
      type: 'REJECTION',
      message: 'Action cancelled. What else can I help you with?'
    };
  }

  // Case 5: Not an approval/rejection - treat as new request
  return {
    type: 'NEW_REQUEST',
    message: null
  };
}

/**
 * Create audit entry for an executed action
 * @param {object} action - The executed action
 * @param {object} result - Execution result
 * @param {string} operator - Who approved it
 * @param {string} prompt - Original prompt
 * @returns {object} Audit entry
 */
function createAuditEntry(action, result, operator = 'system', prompt = '') {
  return {
    time: new Date().toISOString(),
    operator,
    operatorName: operator,
    prompt,
    intent: action.actionName,
    actionProposal: action,
    approvals: [{
      actionName: action.actionName,
      parameters: action.parameters,
      approved: true,
      timestamp: new Date().toISOString()
    }],
    applied: [{
      success: result.success,
      message: result.message,
      data: result.data,
      actionName: action.actionName,
      parameters: action.parameters,
      timestamp: new Date().toISOString()
    }]
  };
}

/**
 * Save audit entry to file
 * @param {object} entry - Audit entry
 */
async function saveAuditEntry(entry) {
  try {
    let auditLog = [];
    try {
      const data = await fs.readFile(AUDIT_PATH, 'utf8');
      auditLog = JSON.parse(data);
    } catch {
      // File doesn't exist or is empty
    }

    auditLog.push(entry);

    // Keep last 1000 entries
    if (auditLog.length > 1000) {
      auditLog = auditLog.slice(-1000);
    }

    await fs.writeFile(AUDIT_PATH, JSON.stringify(auditLog, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Failed to save audit entry:', err);
    return false;
  }
}

/**
 * Get recent audit entries
 * @param {number} limit - Max entries to return
 * @returns {Array}
 */
async function getRecentAuditEntries(limit = 10) {
  try {
    const data = await fs.readFile(AUDIT_PATH, 'utf8');
    const auditLog = JSON.parse(data);
    return auditLog.slice(-limit).reverse();
  } catch {
    return [];
  }
}

/**
 * Format action for user confirmation
 * @param {object} actionProposal - The proposed action
 * @returns {string} Formatted confirmation message
 */
function formatConfirmationMessage(actionProposal) {
  const { actionName, description, reasoning, impact } = actionProposal;

  let message = `Proposed Action: ${description}\n\n`;

  if (reasoning) {
    message += `📊 Reasoning: ${reasoning}\n\n`;
  }

  if (impact) {
    message += `📈 Impact:\n`;
    if (impact.currentPrice && impact.newPrice) {
      message += `• Price: $${impact.currentPrice} → $${impact.newPrice}\n`;
    }
    if (impact.priceChange) {
      message += `• Change: ${impact.priceChange}\n`;
    }
    if (impact.riskLevel) {
      message += `• Risk: ${impact.riskLevel}\n`;
    }
    message += '\n';
  }

  message += `Would you like me to apply this change? (yes/no)`;

  return message;
}

module.exports = {
  isApprovalMessage,
  isRejectionMessage,
  storePendingAction,
  getPendingAction,
  clearPendingAction,
  findPendingActionFromHistory,
  processApprovalFlow,
  createAuditEntry,
  saveAuditEntry,
  getRecentAuditEntries,
  formatConfirmationMessage,
  extractRoomsFromMessage,
  filterActionToRooms
};
