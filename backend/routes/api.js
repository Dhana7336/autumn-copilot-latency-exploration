const express = require('express');
const router = express.Router();
const llmService = require('../services/llmService');
const dataLoader = require('../services/dataLoader');
const { validateString, sanitizeInput } = require('../middleware/validation');
router.post('/chat', async (req, res) => {
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
    
    // If LLM service is not available, fall back to simple chat
    if (!llmService.isAvailable()) {
      const simpleResponse = `AI assistant is not configured. Please set OPENAI_API_KEY environment variable.`;
      return res.json({ ok: true, text: simpleResponse });
    }
    
    // Prepare hotel data context
    const roomsData = dataLoader.rooms || [];
    const reservations = dataLoader.reservations || [];
    const competitors = dataLoader.competitors || [];
    const totalRooms = dataLoader.getTotalRooms() || 0;
    
    // Create system prompt with hotel context
    const systemPrompt = `You are an AI hotel pricing assistant for Lily Hall Hotel.
    
Current Hotel Context:
- Total Rooms: ${totalRooms}
- Room Types: ${roomsData.map(r => r.room_type).join(', ')}
- Active Reservations: ${reservations.length}
- Competitors Tracked: ${competitors.length}

Your role: Help with pricing decisions, revenue optimization, and answering hotel-related questions.
Be concise, data-driven, and focus on actionable insights.`;
    
    // User message with context
    const userMessage = `Hotel Data Context:
- Room Inventory: ${roomsData.length} types
- Current Revenue: $${dataLoader.getTotalRevenue().toFixed(2)}
- Today's Occupancy: ${dataLoader.getOccupancyRate()}%
- Competitor Count: ${competitors.length}

User Question: ${sanitizedPrompt}`;
    
    // Call LLM service
    const llmResponse = await llmService.chat(systemPrompt, userMessage, 1024, conversationHistory);
    
    if (!llmResponse.ok) {
      return res.status(502).json({
        ok: false,
        error: llmResponse.error || 'Failed to get AI response'
      });
    }
    
    res.json({
      ok: true,
      text: llmResponse.text,
      model: llmService.getModel()
    });
    
  } catch (err) {
    console.error('LLM chat error:', err);
    res.status(500).json({ error: 'LLM request failed' });
  }
});

module.exports = router;