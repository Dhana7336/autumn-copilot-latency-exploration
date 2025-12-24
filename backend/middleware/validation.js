const validateString = (value, fieldName, minLength = 1, maxLength = 10000) => {
  if (typeof value !== 'string') {
    return { valid: false, error: `${fieldName} must be a string` };
  }
  if (value.trim().length < minLength) {
    return { valid: false, error: `${fieldName} must be at least ${minLength} characters` };
  }
  if (value.length > maxLength) {
    return { valid: false, error: `${fieldName} exceeds maximum length of ${maxLength} characters` };
  }
  return { valid: true };
};

const validateObject = (value, fieldName) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { valid: false, error: `${fieldName} must be a valid object` };
  }
  return { valid: true };
};

const validateActionName = (actionName) => {
  const validActions = [
    'applyPriceOverride',
    'adjustRateClamp',
    'updateCompetitorWeight',
    'updateCompetitorDifferential',
    'applyPriceIncrease',
    'applyWeekendRateIncrease',
    'applyTemporaryPricing',
    'applyMultiplePromotions',
    'undoLastAction'
  ];
  if (!validActions.includes(actionName)) {
    return { valid: false, error: `Invalid action name. Valid actions: ${validActions.join(', ')}` };
  }
  return { valid: true };
};

const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  // Remove potentially harmful characters but keep normal punctuation
  return input.replace(/[<>]/g, '').trim();
};

module.exports = {
  validateString,
  validateObject,
  validateActionName,
  sanitizeInput
};