const express = require('express');
const router = express.Router();
const agent = require('../copilot/agent');
const dataLoader = require('../services/dataLoader');
const { validateString, sanitizeInput } = require('../middleware/validation');

// Simple rule-based chat responses
router.post('/simple', async (req, res) => {
  try {
    const { prompt } = req.body || {};
    
    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt' });
    }
    
    const promptValidation = validateString(prompt, 'prompt', 1, 5000);
    if (!promptValidation.valid) {
      return res.status(400).json({ error: promptValidation.error });
    }
    
    const sanitizedPrompt = sanitizeInput(prompt);
    const promptLower = sanitizedPrompt.toLowerCase();
    
    const reservations = dataLoader.reservations || [];
    const totalRooms = dataLoader.getTotalRooms() || 0;
    
    // Date context helper
    const getDateContext = (prompt) => {
      const today = new Date();
      const promptLower = prompt.toLowerCase();
      
      if (promptLower.includes('today')) {
        return { type: 'today', date: today, label: 'Today' };
      }
      
      if (promptLower.includes('tomorrow')) {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return { type: 'tomorrow', date: tomorrow, label: 'Tomorrow' };
      }
      
      if (promptLower.includes('this weekend') || promptLower.includes('next weekend')) {
        const daysUntilSaturday = (6 - today.getDay() + 7) % 7 || 7;
        const nextSaturday = new Date(today);
        nextSaturday.setDate(today.getDate() + daysUntilSaturday);
        const nextSunday = new Date(nextSaturday);
        nextSunday.setDate(nextSaturday.getDate() + 1);
        return { 
          type: 'weekend',
          startDate: nextSaturday,
          endDate: nextSunday,
          label: promptLower.includes('this weekend') ? 'This Weekend' : 'Next Weekend'
        };
      }
      
      return { type: 'general', label: 'Overall' };
    };
    
    const dateContext = getDateContext(sanitizedPrompt);
    let response = '';
    
    // Occupancy queries
    if (promptLower.includes('occupied') || promptLower.includes('occupancy')) {
      let filteredReservations = reservations;
      
      if (dateContext.type === 'today' || dateContext.type === 'tomorrow') {
        const targetDate = dateContext.date.toISOString().split('T')[0];
        filteredReservations = reservations.filter(r => {
          const checkIn = r.check_in_date || r['Check In Date'] || r.checkInDate;
          const checkOut = r.check_out_date || r['Check Out Date'] || r.checkOutDate;
          return checkIn <= targetDate && checkOut > targetDate;
        });
      }
      
      const confirmed = filteredReservations.filter(r =>
        (r.Status || r.status || '').toLowerCase() === 'confirmed'
      ).length;
      const rate = ((confirmed / totalRooms) * 100).toFixed(1);
      
      response = `${dateContext.label} Occupancy: ${confirmed}/${totalRooms} rooms (${rate}%)`;
    }
    // Revenue queries
    else if (promptLower.includes('revenue') || promptLower.includes('income')) {
      let filteredReservations = reservations;
      
      if (dateContext.type === 'today' || dateContext.type === 'tomorrow') {
        const targetDate = dateContext.date.toISOString().split('T')[0];
        filteredReservations = reservations.filter(r => {
          const checkIn = r.check_in_date || r['Check In Date'] || r.checkInDate;
          const checkOut = r.check_out_date || r['Check Out Date'] || r.checkOutDate;
          return checkIn <= targetDate && checkOut > targetDate;
        });
      }
      
      const totalRevenue = filteredReservations.reduce((sum, r) => {
        const price = parseFloat(r['Total Price'] || r.totalPrice || r.price || 0);
        return sum + price;
      }, 0);
      
      response = `${dateContext.label} Revenue: $${totalRevenue.toFixed(2)} (${filteredReservations.length} bookings)`;
    }
    // Default response
    else {
      response = `I can help you with occupancy, revenue, or booking information. Try asking:\n- "What's today's occupancy?"\n- "How much revenue this weekend?"\n- "How many bookings do we have?"`;
    }
    
    res.json({ ok: true, text: response });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Chat request failed' });
  }
});

// Agent-based chat with action proposals
router.post('/agent', async (req, res) => {
  try {
    const { prompt, conversationHistory } = req.body || {};
    
    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt' });
    }
    
    const promptValidation = validateString(prompt, 'prompt', 1, 10000);
    if (!promptValidation.valid) {
      return res.status(400).json({ error: promptValidation.error });
    }
    
    const sanitizedPrompt = sanitizeInput(prompt);
    
    // Use agent to plan action from prompt
    const contextData = {
      rooms: dataLoader.rooms || [],
      competitors: dataLoader.competitors || [],
      reservations: dataLoader.reservations || []
    };
    
    const actionProposal = agent.planActionFromPrompt(sanitizedPrompt, contextData);
    
    // Check if this is approval of a previous action
    const promptLower = sanitizedPrompt.toLowerCase().trim();
    const exactApprovalPhrases = ['yes', 'ok', 'okay', 'approve', 'apply', 'proceed', 'go ahead', 'do it', 'execute', 'confirm'];
    
    const isApproval = !promptLower.includes('?') && 
                      promptLower.split(' ').length <= 3 &&
                      exactApprovalPhrases.some(phrase => promptLower === phrase);
    
    // If approval and we have conversation history, look for last action
    if (isApproval && conversationHistory && conversationHistory.length >= 2) {
      let lastActionProposal = null;
      
      for (let i = conversationHistory.length - 1; i >= 0; i--) {
        const msg = conversationHistory[i];
        if (msg.role === 'assistant' && msg.actionProposal && msg.actionProposal.actionName) {
          lastActionProposal = msg.actionProposal;
          break;
        }
      }
      
      if (lastActionProposal) {
        return res.json({
          ok: true,
          text: `Approval received. Ready to execute: ${lastActionProposal.description}`,
          actionProposal: {
            ...lastActionProposal,
            requiresApproval: false
          }
        });
      }
    }
    
    // Otherwise, return the analyzed action proposal
    let responseText = '';
    
    if (actionProposal.actionName) {
      responseText = `I understand you want to ${actionProposal.description.toLowerCase()}.\n\n`;
      responseText += `Reasoning: ${actionProposal.reasoning}\n\n`;
      responseText += `Confidence: ${Math.round(actionProposal.confidence * 100)}%\n\n`;
      responseText += `Should I proceed with this action?`;
    } else {
      responseText = actionProposal.description || 'I need more information to help with that request.';
      
      if (actionProposal.suggestions) {
        responseText += '\n\nTry one of these:\n' + actionProposal.suggestions.map(s => `- ${s}`).join('\n');
      }
    }
    
    res.json({
      ok: true,
      text: responseText,
      actionProposal: actionProposal.actionName ? actionProposal : null
    });
    
  } catch (err) {
    console.error('Agent chat error:', err);
    res.status(500).json({ error: 'Agent request failed' });
  }
});

module.exports = router;