// This handles the agent flow with action proposals
const express = require('express');
const router = express.Router();
const agent = require('../copilot/agent');

// POST /api/chat/agent - Main agent flow (analyzes intent, proposes actions)
router.post('/agent', async (req, res) => {
  try {
    const { prompt, contextData, conversationHistory } = req.body || {};
    
    if (!prompt) {
      return res.status(400).json({ 
        error: 'Missing prompt',
        type: 'ERROR'
      });
    }
    
    // 1. Analyze prompt with conversational flow
    const flowResult = agent.handleConversationalFlow(prompt, conversationHistory || []);
    
    // 2. If this is an approval, return the action to execute
    if (flowResult.type === 'APPROVAL') {
      return res.json({
        type: 'APPROVAL',
        actionProposal: flowResult.actionProposal,
        text: flowResult.text || 'Approval detected. Action ready to execute.',
        requiresConfirmation: true
      });
    }
    
    // 3. Otherwise, analyze and propose new action
    const actionProposal = agent.planActionFromPrompt(prompt, contextData || {});
    
    // 4. Return the proposal
    res.json({
      type: actionProposal.actionName ? 'ACTION_PROPOSAL' : 'INFORMATIONAL',
      actionProposal: actionProposal.actionName ? {
        actionName: actionProposal.actionName,
        parameters: actionProposal.parameters,
        description: actionProposal.description,
        confidence: actionProposal.confidence,
        reasoning: actionProposal.reasoning,
        requires_approval: true
      } : null,
      text: actionProposal.actionName 
        ? `${actionProposal.description}\n\n${actionProposal.reasoning}\n\nShould I proceed with this action?`
        : `${actionProposal.description}\n\n${actionProposal.reasoning}`,
      suggestions: actionProposal.suggestions
    });
    
  } catch (err) {
    console.error('Agent flow error:', err);
    res.status(500).json({ 
      type: 'ERROR',
      error: 'Agent analysis failed',
      details: err.message 
    });
  }
});

module.exports = router;