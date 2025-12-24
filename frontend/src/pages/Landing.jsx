import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Mic } from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);

  const suggestedPrompts = [
    'My prices look low next weekend',
    'Increase Deluxe room prices',
    'Show occupancy trends',
    "What's our current occupancy rate?",
    'How many rooms are still available tonight?',
    "Show me today's revenue"
  ];

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    // Minimal landing behavior: send redirects to auth to continue
    navigate('/auth');
  };

  const handlePromptClick = (prompt) => {
    setInput(prompt);
  };

  useEffect(() => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSpeechSupported(false);
      return;
    }
    setIsSpeechSupported(true);
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join('');
      setInput(transcript);
    };
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);
    recognitionRef.current = recognition;
    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, []);

  const handleVoiceToggle = () => {
    if (!recognitionRef.current) return;
    if (isRecording) {
      recognitionRef.current.stop();
      return;
    }
    setIsRecording(true);
    recognitionRef.current.start();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-lavender-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-purple-600">Autumn</h1>
            <span className="text-xs text-gray-500 font-medium">AI Copilot</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 text-sm font-medium text-purple-600 hover:bg-purple-50 rounded-lg transition"
            >
              Sign in
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <h2 className="text-5xl font-bold text-gray-900 mb-4">
          Ask your hotel AI copilot anything
        </h2>
        <p className="text-xl text-gray-600 mb-12">
          Pricing, bookings, revenue, and operations — explained and actioned with your approval.
        </p>

        {/* Minimal Chat Input */}
        <div className="max-w-3xl mx-auto mb-10">
          <div className="bg-white border border-gray-200 rounded-2xl shadow-lg p-4">
            <div className="flex items-start gap-3">
              <textarea
                ref={textareaRef}
                rows={3}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask about pricing, bookings, or revenue…"
                className="flex-1 resize-none overflow-hidden bg-white border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                aria-label="Ask a question"
              />
              {isSpeechSupported ? (
                <button
                  onClick={handleVoiceToggle}
                  className={`px-4 py-3 rounded-xl font-medium border ${
                    isRecording ? 'bg-red-100 text-red-600 border-red-200' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                  aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                >
                  <Mic size={18} />
                </button>
              ) : (
                <button
                  disabled
                  title="Voice requires Chrome or Edge"
                  className="px-4 py-3 rounded-xl font-medium border bg-white text-gray-400 border-gray-300 cursor-not-allowed"
                >
                  <Mic size={18} />
                </button>
              )}
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="px-4 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send size={18} />
              </button>
            </div>
            {/* Helper text removed per request */}
          </div>
        </div>

        {/* Suggested Prompts */}
        <div className="flex flex-wrap gap-3 justify-center mb-16">
          {suggestedPrompts.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handlePromptClick(prompt)}
              className="px-5 py-2 bg-white border border-gray-300 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Feature Cards - Help users understand capabilities */}
        <div className="flex gap-6 mt-12 w-full justify-center">
          <div className="p-6 bg-white rounded-2xl border border-transparent flex-1 max-w-xs cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4 mx-auto">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2 text-center">Smart Pricing</h3>
            <p className="text-sm text-gray-600 text-center">AI-powered pricing recommendations based on market and occupancy</p>
          </div>
          <div className="p-6 bg-white rounded-2xl border border-transparent flex-1 max-w-xs cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4 mx-auto">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2 text-center">Bookings Insight</h3>
            <p className="text-sm text-gray-600 text-center">Real-time analysis of reservations, occupancy, and revenue trends</p>
          </div>
          <div className="p-6 bg-white rounded-2xl border border-transparent flex-1 max-w-xs cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4 mx-auto">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2 text-center">Secure & Approved</h3>
            <p className="text-sm text-gray-600 text-center">No changes applied without your explicit approval and audit trail</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 mt-20">
        <p className="text-center text-sm text-gray-500">
          Autumn AI Copilot — Your intelligent hotel revenue assistant
        </p>
      </footer>
    </div>
  );
}
