import React, { useState, useRef, useEffect } from 'react';

export default function Copilot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:4001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });

      const data = await response.json();

      const assistantMessage = {
        role: 'assistant',
        content: data.analysis,
        recommendation: data.recommendation,
        proposedAction: data.proposedAction,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyAction = async (action) => {
    try {
      const response = await fetch('http://localhost:4001/api/apply-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();

      if (data.success) {
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: `✅ ${data.message}\n\nApplied changes:\n${data.changes
              .map(
                c =>
                  `• ${c.room_type}: $${c.old_price} → $${c.new_price}`
              )
              .join('\n')}`,
          },
        ]);
      }
    } catch (error) {
      console.error('Error applying action:', error);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedQuestions = [
    "What's our current occupancy rate?",
    "Compare our prices with competitors",
    "Show me today's revenue",
    "How many bookings do we have?",
  ];

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                🏨 Lily Hall AI Copilot
              </h1>
              <p className="text-gray-600">
                Ask me about Lily Hall's performance, pricing, or compare with neighboring Pensacola hotels
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {suggestedQuestions.map((question, idx) => (
                <button
                  key={idx}
                  onClick={() => setInput(question)}
                  className="p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-lavender-300 transition-all"
                >
                  <div className="text-sm text-gray-700">{question}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-lavender-500 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  {msg.recommendation && (
                    <div className="mt-3 pt-3 border-t border-gray-300">
                      <div className="text-sm font-semibold mb-1">
                        💡 Recommendation:
                      </div>
                      <div className="text-sm">{msg.recommendation}</div>
                    </div>
                  )}

                  {msg.proposedAction && (
                    <div className="mt-3 pt-3 border-t border-gray-300">
                      <div className="text-sm font-semibold mb-2">
                        📋 Proposed Action:
                      </div>
                      <div className="text-sm mb-3">
                        {msg.proposedAction.description}
                      </div>
                      <div className="space-y-2 mb-3">
                        {msg.proposedAction.rooms.map((room, i) => (
                          <div
                            key={i}
                            className="text-sm bg-white bg-opacity-50 rounded px-3 py-2"
                          >
                            <div className="font-medium">{room.room_type}</div>
                            <div className="text-xs">
                              ${room.current_price} → ${room.proposed_price}
                            </div>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => handleApplyAction(msg.proposedAction)}
                        className="w-full bg-lavender-600 text-white px-4 py-2 rounded-lg hover:bg-lavender-700 transition-colors text-sm font-medium"
                      >
                        Apply Changes
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {loading && (
          <div className="max-w-3xl mx-auto flex justify-start">
            <div className="bg-gray-100 rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 px-4 py-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask about your hotel performance..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lavender-500 focus:border-transparent"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="px-6 py-3 bg-lavender-600 text-white rounded-lg hover:bg-lavender-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}