const https = require('https');
function stripMarkdown(text) {
  if (!text) return text;

  let result = text
    // Remove markdown formatting
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // **bold** -> bold
    .replace(/\*([^*]+)\*/g, '$1')       // *italic* -> italic
    .replace(/__([^_]+)__/g, '$1')       // __bold__ -> bold
    .replace(/_([^_]+)_/g, '$1')         // _italic_ -> italic
    .replace(/`([^`]+)`/g, '$1')         // `code` -> code
    .replace(/^#{1,6}\s+/gm, '')         // # headers -> plain text
    .replace(/^\s*[-*+]\s+/gm, '• ')     // - list items -> bullet
    .replace(/^\s*\d+\.\s+/gm, '• ');    // 1. numbered -> bullet

  // Format lists properly
  result = formatLists(result);

  // Clean up excessive newlines (more than 2 consecutive)
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim();
}
function formatLists(text) {
  const lines = text.split('\n');
  const result = [];
  let inList = false;
  let prevWasBlank = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const isBullet = trimmed.startsWith('• ');
    const isBlank = trimmed === '';

    if (isBullet) {
      if (!inList) {
        // Starting a new list - ensure one blank line before
        if (result.length > 0 && !prevWasBlank) {
          result.push('');
        }
        inList = true;
      }
      // Add bullet line (no blank lines inside list)
      result.push(line);
      prevWasBlank = false;
    } else if (isBlank) {
      if (inList) {
        // Check if next non-blank line is also a bullet
        let nextNonBlank = '';
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].trim() !== '') {
            nextNonBlank = lines[j].trim();
            break;
          }
        }
        if (nextNonBlank.startsWith('• ')) {
          // Skip blank lines inside lists
          continue;
        } else {
          // End of list
          inList = false;
          result.push('');
          prevWasBlank = true;
        }
      } else {
        if (!prevWasBlank) {
          result.push('');
          prevWasBlank = true;
        }
      }
    } else {
      // Regular text line
      if (inList) {
        // End of list
        inList = false;
        result.push('');
      }
      result.push(line);
      prevWasBlank = false;
    }
  }

  return result.join('\n');
}

/**
 * LLM Service - OpenAI GPT Integration
 * Hotel revenue analysis using GPT-4.1-turbo
 */

class LLMService {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.model = process.env.OPENAI_MODEL || 'gpt-4-turbo';
    this.baseURL = 'api.openai.com';
  }

  /**
   * Send a prompt to OpenAI and get a response
   * @param {string} systemPrompt - System instructions for GPT
   * @param {string} userPrompt - User's question/request
   * @param {number} maxTokens - Maximum tokens in response
   * @param {Array} conversationHistory - Optional conversation history [{role, content}]
   * @returns {Promise<{ok: boolean, text: string, error?: string}>}
   */
  async chat(systemPrompt, userPrompt, maxTokens = 1024, conversationHistory = null) {
    if (!this.apiKey) {
      return {
        ok: false,
        error: 'OPENAI_API_KEY not configured. Set environment variable to enable AI features.'
      };
    }

    // Build messages array with conversation history if provided
    const messages = [
      {
        role: 'system',
        content: systemPrompt
      }
    ];

    // Add conversation history (excluding the current user message which is in userPrompt)
    if (conversationHistory && Array.isArray(conversationHistory) && conversationHistory.length > 0) {
      // Add all but the last message (which is the current prompt)
      const history = conversationHistory.slice(0, -1);
      messages.push(...history);
    }

    // Add current user message
    messages.push({
      role: 'user',
      content: userPrompt
    });

    const body = JSON.stringify({
      model: this.model,
      max_tokens: maxTokens,
      messages: messages,
      temperature: 0.3
    });

    const options = {
      hostname: this.baseURL,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      }
    };

    return new Promise((resolve, reject) => {
      const request = https.request(options, (response) => {
        let data = '';

        response.on('data', chunk => {
          data += chunk;
        });

        response.on('end', () => {
          try {
            const parsed = JSON.parse(data);

            if (response.statusCode !== 200) {
              console.error('OpenAI API error:', parsed);
              resolve({
                ok: false,
                error: parsed.error?.message || `OpenAI API returned status ${response.statusCode}`
              });
              return;
            }

            const content = parsed.choices?.[0]?.message?.content;
            if (!content) {
              resolve({
                ok: false,
                error: 'No content in OpenAI response'
              });
              return;
            }

            // Strip markdown formatting from LLM response
            const cleanContent = stripMarkdown(content);

            resolve({
              ok: true,
              text: cleanContent,
              raw: parsed
            });
          } catch (err) {
            console.error('Failed to parse OpenAI response:', err, data);
            resolve({
              ok: false,
              error: 'Failed to parse OpenAI API response'
            });
          }
        });
      });

      request.on('error', (err) => {
        console.error('OpenAI API request error:', err);
        resolve({
          ok: false,
          error: `OpenAI API request failed: ${err.message}`
        });
      });

      request.write(body);
      request.end();
    });
  }

  /**
   * Check if LLM service is configured and available
   * @returns {boolean}
   */
  isAvailable() {
    return !!this.apiKey;
  }

  /**
   * Get the current model name
   * @returns {string}
   */
  getModel() {
    return this.model;
  }
}

// Export singleton instance
module.exports = new LLMService();
