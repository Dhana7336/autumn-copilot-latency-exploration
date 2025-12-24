/**
 * Copilot Chat Route
 * Handles AI chat interactions and action proposals
 */

const express = require('express');
const router = express.Router();

const dataLoader = require('../services/dataLoader');
const llmService = require('../services/llmService');
const { validateString, sanitizeInput } = require('../middleware/validation');
const { buildActionProposal, buildMultiplePromotionProposals, buildPromotionImpactAnalysis, isMultiplePromotionRequest, isImpactAnalysisRequest } = require('../utils/actionProposal');
const { processApprovalFlow } = require('../utils/approvalFlow');
const { cache, CACHE_TTL } = require('../utils/cache');
const { buildSystemPrompt, buildResponseText } = require('../utils/llmPrompts');

router.post('/', async (req, res) => {
  try {
    const { prompt, conversationHistory, sessionId } = req.body || {};

    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    const promptValidation = validateString(prompt, 'prompt', 1, 10000);
    if (!promptValidation.valid) {
      return res.status(400).json({ error: promptValidation.error });
    }

    const sanitizedPrompt = sanitizeInput(prompt);

    const contextData = {
      rooms: dataLoader.rooms || [],
      competitors: dataLoader.competitors || [],
      reservations: dataLoader.reservations || []
    };

    // Check approval flow
    const approvalCheck = processApprovalFlow(sanitizedPrompt, sessionId || 'default', conversationHistory);

    // User said "apply [room]" - show confirmation for that specific room
    if (approvalCheck.type === 'NEEDS_CONFIRMATION' && approvalCheck.actionProposal) {
      return res.json({
        ok: true,
        text: approvalCheck.message,
        actionProposal: approvalCheck.actionProposal,
        source: 'approval-flow'
      });
    }

    // User confirmed (yes, ok) - execute the action
    if (approvalCheck.type === 'APPROVAL' && approvalCheck.actionProposal) {
      return res.json({
        ok: true,
        text: approvalCheck.message,
        actionProposal: approvalCheck.actionProposal,
        source: 'approval-flow'
      });
    }

    // User rejected
    if (approvalCheck.type === 'REJECTION') {
      return res.json({
        ok: true,
        text: approvalCheck.message,
        actionProposal: null,
        source: 'approval-flow'
      });
    }

    // No pending action found
    if (approvalCheck.type === 'NO_PENDING_ACTION') {
      return res.json({
        ok: true,
        text: approvalCheck.message,
        actionProposal: null,
        source: 'approval-flow'
      });
    }

    // Check for impact analysis request (Step 2)
    const wantsImpactAnalysis = isImpactAnalysisRequest(sanitizedPrompt);
    const lastAssistantMessage = conversationHistory?.slice().reverse().find(m => m.role === 'assistant');
    const justShowedPromotions = lastAssistantMessage?.actionProposal?.needsImpactAnalysis ||
                                  lastAssistantMessage?.text?.includes('Would you like to see the estimated revenue impact');

    // Build action proposal
    let actionProposal;
    if (wantsImpactAnalysis && justShowedPromotions) {
      actionProposal = buildPromotionImpactAnalysis(contextData);
    } else if (isMultiplePromotionRequest(sanitizedPrompt)) {
      actionProposal = buildMultiplePromotionProposals(contextData);
    } else {
      actionProposal = buildActionProposal(sanitizedPrompt, contextData);
    }

    // Determine cache type
    const lowerPrompt = sanitizedPrompt.toLowerCase();
    const isAnalysisQuery = lowerPrompt.match(/\b(analyze|analysis|how|what|show|compare|performance|occupancy|revenue)\b/);
    const isCompetitorQuery = lowerPrompt.match(/\b(competitor|competition|market|versus|vs|hilton|marriott|hampton)\b/);
    const isSimulationQuery = lowerPrompt.match(/\b(simulate|preview|what if|forecast|predict|estimate)\b/);

    let cacheType = null;
    if (isCompetitorQuery) cacheType = 'competitor';
    else if (isAnalysisQuery) cacheType = 'analysis';
    else if (isSimulationQuery) cacheType = 'simulation';

    const isActionRequest = actionProposal.actionName && actionProposal.requiresApproval;
    if (isActionRequest) cacheType = null;

    // Try LLM for richer responses
    if (llmService.isAvailable()) {
      try {
        const systemPrompt = buildSystemPrompt(contextData);

        if (cacheType) {
          const cacheKey = cache.generateKey(cacheType, { prompt: sanitizedPrompt });
          const cached = cache.get(cacheKey);
          if (cached) {
            console.log(`[Cache] HIT for ${cacheType} query`);
            return res.json({ ...cached, _cached: true, _cacheType: cacheType });
          }
        }

        const llmResponse = await llmService.chat(systemPrompt, sanitizedPrompt, 1024, conversationHistory);

        if (llmResponse.ok) {
          const response = {
            ok: true,
            text: llmResponse.text,
            actionProposal: actionProposal.actionName ? actionProposal : null,
            source: 'llm'
          };

          if (cacheType) {
            const cacheKey = cache.generateKey(cacheType, { prompt: sanitizedPrompt });
            const ttl = CACHE_TTL[cacheType] || CACHE_TTL.default;
            cache.set(cacheKey, response, ttl);
            console.log(`[Cache] STORED ${cacheType} query (TTL: ${ttl/1000}s)`);
          }

          return res.json(response);
        }
      } catch (llmError) {
        console.error('LLM error, falling back to rule-based:', llmError.message);
      }
    }

    // Fallback to rule-based response
    const responseText = buildResponseText(actionProposal);

    res.json({
      ok: true,
      text: responseText,
      actionProposal: actionProposal.actionName ? actionProposal : null,
      source: 'rule-based'
    });

  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Chat request failed', details: err.message });
  }
});

module.exports = router;
