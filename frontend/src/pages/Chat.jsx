import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Send, LogOut, Settings, Calendar, LayoutDashboard, MessageSquare, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';

export default function Chat() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [pendingAction, setPendingAction] = useState(null);
  const [user, setUser] = useState(null);
  const [chatSessions, setChatSessions] = useState([]); // Store all chat sessions by date
  const [currentSessionId, setCurrentSessionId] = useState(null); // Track current session
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);

  // Load user details and chat sessions from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('autumnUser');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.error('Error parsing user data:', err);
        setUser(null);
      }
    }

    // Load chat sessions from localStorage
    const storedSessions = localStorage.getItem('autumnChatSessions');
    if (storedSessions) {
      try {
        const parsedSessions = JSON.parse(storedSessions);
        setChatSessions(parsedSessions);

        // Load the most recent session
        if (parsedSessions.length > 0) {
          const latestSession = parsedSessions[0];
          setCurrentSessionId(latestSession.id);
          setMessages(latestSession.messages);
        } else {
          // Create initial session if no sessions exist
          const initialSession = {
            id: Date.now().toString(),
            messages: [],
            createdAt: new Date().toISOString()
          };
          setChatSessions([initialSession]);
          setCurrentSessionId(initialSession.id);
        }
      } catch (err) {
        console.error('Error loading chat sessions:', err);
        // Create initial session on error
        const initialSession = {
          id: Date.now().toString(),
          messages: [],
          createdAt: new Date().toISOString()
        };
        setChatSessions([initialSession]);
        setCurrentSessionId(initialSession.id);
      }
    } else {
      // No stored sessions, create initial session
      const initialSession = {
        id: Date.now().toString(),
        messages: [],
        createdAt: new Date().toISOString()
      };
      setChatSessions([initialSession]);
      setCurrentSessionId(initialSession.id);
    }
  }, []);

  // Update current session when messages change
  useEffect(() => {
    if (messages.length > 0 && currentSessionId) {
      setChatSessions(prev => {
        const updated = prev.map(session =>
          session.id === currentSessionId ? { ...session, messages, updatedAt: new Date().toISOString() } : session
        );
        // Save immediately to localStorage
        localStorage.setItem('autumnChatSessions', JSON.stringify(updated));
        return updated;
      });
    }
  }, [messages, currentSessionId]);

  // Save chat sessions to localStorage whenever they change (backup)
  useEffect(() => {
    if (chatSessions.length > 0) {
      localStorage.setItem('autumnChatSessions', JSON.stringify(chatSessions));
    }
  }, [chatSessions]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const suggestedPrompts = [
    "Show today's bookings",
    'Compare prices',
    'Increase room rates'
  ];

  const handleSend = async (textToSend = null) => {
    const text = (textToSend || input || '').trim();
    if (!text || loading) return;

    // Ensure we have a current session
    if (!currentSessionId) {
      const newSession = {
        id: Date.now().toString(),
        messages: [],
        createdAt: new Date().toISOString()
      };
      setChatSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(newSession.id);
    }

    const userMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Send conversation history for context (last 10 messages including current)
      // Include actionProposal so backend can detect conversational approvals
      const conversationHistory = [...messages, userMessage].slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content,
        actionProposal: msg.actionProposal || null
      }));

      // Get user info from localStorage
      let operatorEmail = 'admin@hotel.com';
      let operatorName = 'Admin';
      try {
        const storedUser = localStorage.getItem('autumnUser');
        if (storedUser) {
          const userObj = JSON.parse(storedUser);
          if (userObj.email) operatorEmail = userObj.email;
          if (userObj.firstName || userObj.lastName) {
            operatorName = `${userObj.firstName || ''} ${userObj.lastName || ''}`.trim();
          }
        }
      } catch (err) {
        // fallback to default
      }

      const res = await fetch('http://localhost:4001/api/copilot/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          conversationHistory: conversationHistory,
          operator: operatorEmail,
          operatorName: operatorName
        })
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        const fallback = `I couldn't process that request. ${data.error || 'Please ensure the backend is running with ANTHROPIC_API_KEY configured.'}`;
        setMessages(prev => [...prev, { role: 'assistant', content: fallback }]);
      } else {
        const assistantMessage = {
          role: 'assistant',
          content: data.text || 'No response.',
          actionProposal: data.actionProposal
        };
        setMessages(prev => [...prev, assistantMessage]);

        // Store pending action if there's a proposal
        if (data.actionProposal && data.actionProposal.actionName) {
          setPendingAction(data.actionProposal);
        }

        // If the response contains "Action applied successfully" it means conversational approval was executed
        if (data.text && data.text.includes('Action applied successfully')) {
          // Trigger dashboard refresh
          localStorage.setItem('dashboardRefreshNeeded', Date.now().toString());
        }
      }
    } catch (err) {
      const errorMsg = `Error: ${err.message}. Check that backend is running on http://localhost:4001`;
      setMessages(prev => [...prev, { role: 'assistant', content: errorMsg }]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!pendingAction) return;
    

    setLoading(true);
    try {
      // Get the real user email and name from localStorage (autumnUser)
      let operatorEmail = 'admin@hotel.com';
      let operatorName = 'Admin';
      try {
        const storedUser = localStorage.getItem('autumnUser');
        if (storedUser) {
          const userObj = JSON.parse(storedUser);
          if (userObj.email) operatorEmail = userObj.email;
          if (userObj.firstName || userObj.lastName) {
            operatorName = `${userObj.firstName || ''} ${userObj.lastName || ''}`.trim();
          }
        }
      } catch (err) {
        // fallback to default
      }

      const res = await fetch('http://localhost:4001/api/copilot/actions/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionName: pendingAction.actionName,
          parameters: pendingAction.parameters,
          operator: operatorEmail,
          operatorName: operatorName,
          prompt: 'User approved action'
        })
      });

      const data = await res.json();
      
      if (data.success) {
        const successMessage = `Action applied successfully.\n\n${data.message || data.summary || 'Changes have been saved.'}\n\nTip: Navigate to the Dashboard to see the updated pricing immediately.`;

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: successMessage
        }]);

        // Trigger dashboard refresh by setting a localStorage flag
        localStorage.setItem('dashboardRefreshNeeded', Date.now().toString());
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `❌ Failed to apply action: ${data.error || 'Unknown error'}\n\nPlease try again or rephrase your request.`
        }]);
      }

      setPendingAction(null);
    } catch (err) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `❌ Error executing action: ${err.message}` 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = () => {
    setMessages(prev => [...prev, { 
      role: 'assistant', 
      content: 'Action canceled. No changes were made.' 
    }]);
    setPendingAction(null);
  };

  const handlePromptClick = (prompt) => {
    handleSend(prompt);
  };

  const handleLogout = () => {
    localStorage.removeItem('autumnUser');
    localStorage.removeItem('autumnAuth');
    localStorage.removeItem('autumnChatHistory');
    setMessages([]);
    navigate('/');
  };

  // Setup Web Speech API for voice-to-text
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

  const createNewChat = () => {
    const newSession = {
      id: Date.now().toString(),
      messages: [],
      createdAt: new Date().toISOString()
    };
    setChatSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setMessages([]);
  };

  const loadChatSession = (sessionId) => {
    const session = chatSessions.find(s => s.id === sessionId);
    if (session) {
      setCurrentSessionId(sessionId);
      setMessages(session.messages);
    }
  };

  const deleteChatSession = (sessionId) => {
    setChatSessions(prev => prev.filter(s => s.id !== sessionId));
    if (currentSessionId === sessionId) {
      if (chatSessions.length > 1) {
        const nextSession = chatSessions.find(s => s.id !== sessionId);
        loadChatSession(nextSession.id);
      } else {
        createNewChat();
      }
    }
  };

  const groupSessionsByDate = () => {
    const groups = {};
    chatSessions.forEach(session => {
      const date = new Date(session.createdAt);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      let key;
      if (date.toDateString() === today.toDateString()) {
        key = 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        key = 'Yesterday';
      } else {
        key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(session);
    });
    return groups;
  };

  const getSessionPreview = (session) => {
    const firstUserMsg = session.messages.find(m => m.role === 'user');
    return firstUserMsg ? firstUserMsg.content.substring(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '') : 'New Chat';
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-white border-r border-gray-200 flex flex-col transition-all duration-200`}
      >
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className={`${sidebarOpen ? 'block' : 'hidden'}`}>
            <h1 className="text-xl font-bold text-purple-600">Autumn</h1>
            <p className="text-xs text-gray-500 mt-1">AI Copilot</p>
          </div>
          <button
            onClick={() => setSidebarOpen(prev => !prev)}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <button className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-purple-100 text-purple-700 font-medium ${!sidebarOpen ? 'justify-center' : ''}`}>
            <MessageSquare size={sidebarOpen ? 22 : 28} />
            {sidebarOpen && <span>AI Copilot</span>}
          </button>
          <button
            onClick={createNewChat}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 ${!sidebarOpen ? 'justify-center' : ''}`}
            title="Start a new conversation"
          >
            <Plus size={sidebarOpen ? 22 : 28} />
            {sidebarOpen && <span>New Chat</span>}
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 ${!sidebarOpen ? 'justify-center' : ''}`}
          >
            <LayoutDashboard size={sidebarOpen ? 22 : 28} />
            {sidebarOpen && <span>Dashboard</span>}
          </button>
          <button 
            onClick={() => navigate('/calendar')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 ${!sidebarOpen ? 'justify-center' : ''}`}
          >
            <Calendar size={sidebarOpen ? 22 : 28} />
            {sidebarOpen && <span>Calendar</span>}
          </button>
          <button
            onClick={() => navigate('/settings')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 ${!sidebarOpen ? 'justify-center' : ''}`}
          >
            <Settings size={sidebarOpen ? 22 : 28} />
            {sidebarOpen && <span>Settings</span>}
          </button>
        </nav>

        {/* Chat History */}
        {sidebarOpen && chatSessions.length > 0 && (
          <div className="flex-1 overflow-y-auto border-t border-gray-200 p-3">
            <div className="text-xs font-semibold text-gray-500 mb-3">HISTORY</div>
            {Object.entries(groupSessionsByDate()).map(([date, sessions]) => (
              <div key={date} className="mb-4">
                <div className="text-xs text-gray-400 font-medium mb-2">{date}</div>
                {sessions.map(session => (
                  <div
                    key={session.id}
                    onClick={() => loadChatSession(session.id)}
                    className={`p-2 mb-1 rounded-lg cursor-pointer group flex items-center justify-between ${
                      currentSessionId === session.id
                        ? 'bg-purple-100 text-purple-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-sm truncate flex-1">{getSessionPreview(session)}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteChatSession(session.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded"
                      title="Delete chat"
                    >
                      <Trash2 size={14} className="text-red-600" />
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="p-3 border-t border-gray-200">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm font-medium">
              {user?.firstName?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            {sidebarOpen && (
              <div className="flex-1 text-sm">
                <div className="font-medium text-gray-900">
                  {user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Admin'}
                </div>
                <div className="text-xs text-gray-500">{user?.email || 'admin@hotel.com'}</div>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 mt-2 rounded-lg text-gray-700 hover:bg-gray-100"
          >
            <LogOut size={18} />
            {sidebarOpen && <span className="text-sm">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-8">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full mt-24">
                <h2 className="text-2xl font-medium text-gray-800 mb-6">
                  What can I help you with today?
                </h2>
                <div className="flex flex-wrap gap-3 justify-center">
                  {suggestedPrompts.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handlePromptClick(prompt)}
                      className="px-4 py-2 bg-white border border-gray-300 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xl ${
                        msg.role === 'user'
                          ? 'bg-purple-600 text-white px-4 py-3 rounded-2xl'
                          : ''
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="bg-white text-gray-900 border border-gray-200 rounded-2xl px-4 py-3">
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          
                          {/* Show Apply/Reject buttons if this is the last message and has action proposal */}
                          {idx === messages.length - 1 && msg.actionProposal && msg.actionProposal.actionName && pendingAction && (
                            <div className="flex gap-3 mt-4 pt-3 border-t border-gray-300">
                              <button
                                onClick={handleApprove}
                                disabled={loading}
                                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition"
                              >
                                Apply
                              </button>
                              <button
                                onClick={handleReject}
                                disabled={loading}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="max-w-xl px-4 py-3 rounded-2xl bg-white border border-gray-200">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Removed bottom widgets; now shown under suggestions only */}

        {/* Chat Input - Fixed to Bottom */}
        <div className="border-t border-gray-200 bg-white">
          <div className="max-w-3xl mx-auto px-4 py-4">
            <div className="flex items-center gap-3 bg-white border border-gray-300 rounded-full px-4 py-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask about pricing, bookings, or revenue…"
                className="flex-1 outline-none text-sm text-gray-900 placeholder-gray-500"
                disabled={loading}
              />
              {isSpeechSupported ? (
                <button
                  onClick={handleVoiceToggle}
                  className={`p-2 rounded-full border ${
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
                  className="p-2 rounded-full text-gray-400 border border-gray-300 cursor-not-allowed"
                >
                  <Mic size={18} />
                </button>
              )}
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                className="p-2 rounded-full bg-purple-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-purple-700 transition"
              >
                <Send size={18} />
              </button>
            </div>
            <p className="text-xs text-gray-500 text-center mt-2">
              AI suggestions require your approval before changes are applied.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

