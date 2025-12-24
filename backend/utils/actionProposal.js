/**
 * Action Proposal Builder - Main Entry Point
 * Routes user intents to appropriate proposal builders
 * Split into smaller modules for better performance
 */

const { detectIntent, extractRoomType, extractPrice, extractPercentage, parseDuration, isMultiplePromotionRequest, isImpactAnalysisRequest } = require('./intentDetection');
const { buildPriceOverrideProposal, buildTemporaryPricingProposal, buildRateClampProposal, buildPriceIncreaseProposal, buildCompetitorAdjustmentProposal, buildAnalysisResponse, buildUndoProposal, buildHelpResponse } = require('./proposalBuilders');
const { buildMultiplePromotionProposals, buildPromotionImpactAnalysis } = require('./promotionProposals');

/**
 * Build an action proposal from user intent and context
 * @param {string} prompt - User's natural language request
 * @param {object} context - { rooms, competitors, reservations }
 * @returns {object} Action proposal
 */
function buildActionProposal(prompt, context = {}) {
  const { rooms = [], competitors = [], reservations = [] } = context;
  const lower = prompt.toLowerCase();

  const intent = detectIntent(lower);

  switch (intent.type) {
    case 'price_override':
      return buildPriceOverrideProposal(lower, rooms, competitors, reservations);
    case 'temporary_pricing':
      return buildTemporaryPricingProposal(lower, rooms, competitors, reservations);
    case 'rate_clamp':
      return buildRateClampProposal(lower, rooms);
    case 'price_increase':
      return buildPriceIncreaseProposal(lower, rooms, competitors, reservations);
    case 'competitor_adjustment':
      return buildCompetitorAdjustmentProposal(lower, competitors);
    case 'analysis':
      return buildAnalysisResponse(rooms, reservations);
    case 'undo':
      return buildUndoProposal();
    default:
      return buildHelpResponse();
  }
}

module.exports = {
  buildActionProposal,
  buildMultiplePromotionProposals,
  buildPromotionImpactAnalysis,
  isMultiplePromotionRequest,
  isImpactAnalysisRequest,
  detectIntent,
  extractRoomType,
  extractPrice,
  extractPercentage,
  parseDuration
};
