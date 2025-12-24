import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, StopCircle, Send } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [showResponse, setShowResponse] = useState(false);
  const [approvalState, setApprovalState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [lastQuery, setLastQuery] = useState('');
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const [interim, setInterim] = useState('');

  const suggestedPrompts = [
    'My prices look low next weekend',
    'Increase Deluxe room prices',
    'How did you calculate today\'s rates?',
    'Show occupancy trends'
  ];

  const mockResponse = {
    analysis: 'Based on current market data, competitor pricing, and weekend demand forecasts, your hotel is positioned ~12% below market rates for premium rooms. Occupancy for next weekend is forecasted at 78%, indicating strong demand.',
    recommendation: 'Prices appear under market by approximately 12%',
    proposedAction: 'Increase Deluxe Room prices by 10% next weekend',
    rooms: [
      { id: 1, name: 'Deluxe Room', current: 189, suggested: 208, change: '+10%' },
      { id: 2, name: 'Standard Room', current: 129, suggested: 139, change: '+8%' }
    ]
  };

  // Start/stop voice recognition (Web Speech API) with graceful fallback
  const handleMicClick = () => {
    const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (SpeechRecognition) {
      if (!recognitionRef.current) {
        const r = new SpeechRecognition();
        r.lang = 'en-US';
        r.interimResults = true;
        r.maxAlternatives = 1;
        r.onresult = (e) => {
          let final = '';
          let interimText = '';
          for (let i = 0; i < e.results.length; i++) {
            const res = e.results[i];
            if (res.isFinal) final += res[0].transcript;
            else interimText += res[0].transcript;
          }
          setInterim(interimText);
          if (final) {
            setInput(final.trim());
            // Do not auto-send — allow user to edit before submitting
            setIsListening(false);
            r.stop();
          }
        };
        r.onend = () => {
          setIsListening(false);
          setInterim('');
        };
        recognitionRef.current = r;
      }

      if (!isListening) {
        setIsListening(true);
        setInterim('');
        try {
          recognitionRef.current.start();
        } catch (err) {
          // some browsers throw if start called repeatedly; handle gracefully
          console.warn('SpeechRecognition start error', err);
        }
      } else {
        recognitionRef.current.stop();
        setIsListening(false);
      }
    } else {
      // fallback: mock short recording
      if (!isListening) {
        setIsListening(true);
        setTimeout(() => {
          setInput('My prices look low next weekend');
          // do not auto-send on fallback; allow editing
          setIsListening(false);
        }, 2000);
      } else {
        setIsListening(false);
      }
    }
  };

  const handleSuggestedPrompt = (prompt) => {
    // Place the prompt into the input so the user can edit before sending
    setInput(prompt);
    // focus the textarea so the user can continue editing
    setTimeout(() => inputRef.current && inputRef.current.focus(), 50);
  };

  const handleSend = async (textToSend = null) => {
    const textContent = (textToSend || input || '').trim();
    if (!textContent) return;

    // Always redirect to auth page when user submits from home page
    // Save the message to localStorage so it can be used after login
    localStorage.setItem('pendingMessage', textContent);
    navigate('/auth');
  };

  const handleApprove = () => {
    setApprovalState('approved');
  };

  const handleReject = () => {
    setApprovalState('rejected');
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          {/* Logo */}
          <div style={styles.logo}>Autumn</div>

          {/* Center Navigation */}
          <nav style={styles.nav}>
            <a href="#" style={styles.navActive}>Home</a>
            <span style={styles.navDisabled}>Dashboard</span>
            <span style={styles.navDisabled}>Calendar</span>
          </nav>

          {/* Right Actions */}
          <div style={styles.headerActions}>
            <button style={styles.loginBtn}>Login</button>
            <button style={styles.ctaBtn}>Start using AI</button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={styles.main}>
        {/* Hero Section */}
        <div style={styles.heroSection}>
          <h1 style={styles.headline}>Ask your hotel AI copilot anything</h1>
          <p style={styles.subheading}>
            Pricing, bookings, revenue, and operations — explained and actioned with your approval.
          </p>
        </div>

        {/* Chat Input - Hero Element */}
        <div style={styles.chatContainer}>
          <div style={styles.inputWrapper}>
            <div style={styles.inputBox}>
              <textarea
                ref={inputRef}
                rows={3}
                value={isListening && interim ? interim : input}
                onChange={(e) => setInput(e.target.value)}
                onInput={(e) => {
                  // auto-resize
                  const el = e.target;
                  el.style.height = 'auto';
                  el.style.height = Math.min(el.scrollHeight, 400) + 'px';
                }}
                onKeyDown={(e) => {
                  // Submit on Enter (no Shift)
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={isListening ? (interim || 'Listening… speak your request') : 'Ask about pricing, bookings, or revenue…'}
                style={{...styles.input, ...styles.textarea}}
              />
              <div style={styles.inputActions}>
                <button
                  onClick={handleMicClick}
                  style={{
                    ...styles.micBtn,
                    ...(isListening && styles.micBtnActive)
                  }}
                  aria-label={isListening ? 'Stop recording' : 'Start voice input'}
                >
                  {isListening ? <StopCircle size={18} /> : <Mic size={18} />}
                </button>
                <button
                  onClick={() => handleSend()}
                  style={{
                    ...styles.sendBtn,
                    ...( ((input && input.trim().length>0) || (interim && interim.trim().length>0)) && !isListening ? styles.sendBtnActive : styles.sendBtnDisabled )
                  }}
                  aria-label="Send message"
                  disabled={!( (input && input.trim().length>0) || (interim && interim.trim().length>0) ) || isListening}
                >
                  <Send size={18} />
                </button>
              </div>
            </div>

            {/* Disclaimer */}
            <p style={styles.disclaimer}>
              AI suggestions require your approval before changes are applied.
            </p>
          </div>

          {/* Suggested Prompts */}
          <div style={styles.suggestedContainer}>
            {suggestedPrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSuggestedPrompt(prompt)}
                style={styles.pill}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Response Card with Loading State */}
        {(showResponse || loading) && (
          <div style={styles.responseCardWrapper} className="fade-in">
            <div style={styles.responseCard}>
              {loading && (
                <div style={styles.loadingContainer}>
                  <div style={styles.spinner}></div>
                  <p style={styles.loadingText}>Analyzing your request…</p>
                </div>
              )}

              {!loading && response && (
                <>
                  {/* Analysis Section */}
                  <div style={styles.section}>
                    <h3 style={styles.sectionTitle}>Analysis</h3>
                    <p style={styles.sectionText}>
                      {response.analysis}
                    </p>
                  </div>

                  {/* Recommendation Section */}
                  <div style={styles.recommendationBox}>
                    <h3 style={styles.sectionTitle}>Recommendation</h3>
                    <p style={styles.sectionText}>
                      {response.recommendation}
                    </p>
                  </div>

                  {/* Proposed Action Section */}
                  <div style={styles.actionBox}>
                    <h3 style={styles.sectionTitle}>Proposed Action</h3>
                    <p style={styles.sectionText}>
                      {response.proposedAction}
                    </p>

                    {/* Room Impacts */}
                    {response.rooms && response.rooms.length > 0 && (
                      <div style={styles.roomImpacts}>
                        {response.rooms.map(room => (
                          <div key={room.id} style={styles.roomRow}>
                            <span style={styles.roomName}>{room.name}</span>
                            <div style={styles.roomPrices}>
                              ${room.current} → <span style={styles.suggestedPrice}>${room.suggested}</span>
                              <span style={styles.percentChange}>({room.change})</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Action Buttons - only show when not loading */}
            {!loading && response && (
              <>
                {/* Action Buttons */}
                {approvalState === null && (
                  <div style={styles.buttonsContainer}>
                    <button
                      onClick={handleApprove}
                      style={styles.approveBtn}
                      onMouseEnter={(e) => e.target.style.background = '#B388C7'}
                      onMouseLeave={(e) => e.target.style.background = '#C099DD'}
                    >
                      Approve
                    </button>
                    <button
                      onClick={handleReject}
                      style={styles.rejectBtn}
                      onMouseEnter={(e) => e.target.style.background = '#E5E7EB'}
                      onMouseLeave={(e) => e.target.style.background = '#F3F4F6'}
                    >
                      Reject
                    </button>
                  </div>
                )}

                {/* Success/Reject States */}
                {approvalState === 'approved' && (
                  <div style={styles.successState}>
                    <p style={styles.successText}>✓ Change approved and applied</p>
                  </div>
                )}

                {approvalState === 'rejected' && (
                  <div style={styles.rejectState}>
                    <p style={styles.rejectText}>No changes were made</p>
                  </div>
                )}

                {/* Bottom Text */}
                <p style={styles.bottomText}>
                  No changes are applied without approval.
                </p>
              </>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={styles.footer}>
        <p style={styles.footerText}>
          Autumn AI Copilot — Demo experience
        </p>
      </footer>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .fade-in {
          animation: fadeIn 0.3s ease-out;
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(192,137,221,0.28); }
          70% { box-shadow: 0 0 0 10px rgba(192,137,221,0); }
          100% { box-shadow: 0 0 0 0 rgba(192,137,221,0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#FFFFFF',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'system-ui, -apple-system, Roboto, "Helvetica Neue", Arial'
  },

  // Header
  header: {
    borderBottom: '1px solid #F0F0F0',
    backgroundColor: '#FFFFFF',
    position: 'sticky',
    top: 0,
    zIndex: 50
  },
  headerContent: {
    maxWidth: '1440px',
    margin: '0 auto',
    padding: '16px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    boxSizing: 'border-box'
  },
  logo: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#1F2937'
  },
  nav: {
    display: 'flex',
    gap: '32px',
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)'
  },
  navActive: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1F2937',
    borderBottom: '2px solid #C099DD',
    paddingBottom: '4px',
    textDecoration: 'none',
    cursor: 'pointer'
  },
  navDisabled: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#D1D5DB',
    cursor: 'not-allowed'
  },
  headerActions: {
    display: 'flex',
    gap: '12px'
  },
  loginBtn: {
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#1F2937',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background 0.2s'
  },
  ctaBtn: {
    padding: '8px 24px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#FFFFFF',
    backgroundColor: '#C099DD',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background 0.2s'
  },

  // Main
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: '80px',
    paddingLeft: '24px',
    paddingRight: '24px'
  },

  // Hero Section
  heroSection: {
    maxWidth: '768px',
    margin: '0 auto',
    textAlign: 'center',
    marginBottom: '48px'
  },
  headline: {
    fontSize: '48px',
    fontWeight: 'bold',
    color: '#1F2937',
    margin: '0 0 16px 0'
  },
  subheading: {
    fontSize: '20px',
    color: '#4B5563',
    margin: 0,
    lineHeight: '1.5'
  },

  // Chat Container
  chatContainer: {
    maxWidth: '672px',
    width: '100%',
    marginBottom: '48px'
  },
  inputWrapper: {
    marginBottom: '16px'
  },
  inputBox: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    border: '2px solid #E5E7EB',
    borderRadius: '16px',
    padding: '16px 24px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)',
    transition: 'border-color 0.2s, box-shadow 0.2s'
  },
  input: {
    flex: 1,
    backgroundColor: 'transparent',
    color: '#1F2937',
    border: 'none',
    outline: 'none',
    fontSize: '18px',
    fontFamily: 'inherit'
  },
  textarea: {
    minHeight: '64px',
    maxHeight: '400px',
    resize: 'vertical',
    overflow: 'auto',
    padding: '8px 0',
    lineHeight: '1.4'
  },
  inputActions: {
    display: 'flex',
    gap: '12px',
    marginLeft: '16px'
  },
  micBtn: {
    padding: '12px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#9CA3AF',
    cursor: 'pointer',
    fontSize: '20px',
    transition: 'all 0.2s'
  },
  micBtnActive: {
    backgroundColor: '#C099DD',
    color: '#FFFFFF',
    animation: 'pulse 1.6s ease-out infinite'
  },
  sendBtn: {
    padding: '12px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#C099DD',
    cursor: 'pointer',
    fontSize: '20px',
    transition: 'background 0.2s'
  },
  sendBtnActive: {
    backgroundColor: '#C099DD',
    color: '#FFFFFF'
  },
  sendBtnDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed'
  },
  disclaimer: {
    fontSize: '14px',
    color: '#9CA3AF',
    textAlign: 'center',
    margin: '12px 0 0 0'
  },

  // Suggested Prompts
  suggestedContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    justifyContent: 'center'
  },
  pill: {
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    backgroundColor: '#F3F4F6',
    border: '1px solid #D1D5DB',
    borderRadius: '24px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },

  // Response Card
  responseCardWrapper: {
    maxWidth: '672px',
    width: '100%',
    marginBottom: '48px'
  },
  responseCard: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '16px',
    padding: '32px',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.08)'
  },

  section: {
    marginBottom: '32px'
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    margin: '0 0 12px 0'
  },
  sectionText: {
    fontSize: '16px',
    color: '#374151',
    lineHeight: '1.6',
    margin: 0
  },

  recommendationBox: {
    marginBottom: '32px',
    padding: '16px',
    backgroundColor: '#EFF6FF',
    border: '1px solid #DBEAFE',
    borderRadius: '8px'
  },

  actionBox: {
    marginBottom: '32px',
    padding: '16px',
    backgroundColor: '#F5F0FA',
    border: '1px solid #E0D4EB',
    borderRadius: '8px'
  },

  roomImpacts: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '12px'
  },
  roomRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '14px'
  },
  roomName: {
    fontWeight: '600',
    color: '#374151'
  },
  roomPrices: {
    color: '#4B5563'
  },
  suggestedPrice: {
    fontWeight: '700',
    color: '#C099DD'
  },
  percentChange: {
    color: '#16A34A',
    fontWeight: '600',
    marginLeft: '8px'
  },

  buttonsContainer: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px'
  },
  approveBtn: {
    flex: 1,
    padding: '12px 24px',
    backgroundColor: '#C099DD',
    color: '#FFFFFF',
    fontWeight: '700',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'background 0.2s'
  },
  rejectBtn: {
    flex: 1,
    padding: '12px 24px',
    backgroundColor: '#F3F4F6',
    color: '#1F2937',
    fontWeight: '700',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'background 0.2s'
  },

  successState: {
    marginBottom: '16px',
    padding: '16px',
    backgroundColor: '#F0FDF4',
    border: '1px solid #DCFCE7',
    borderRadius: '8px',
    textAlign: 'center'
  },
  successText: {
    color: '#15803D',
    fontWeight: '600',
    margin: 0
  },

  rejectState: {
    marginBottom: '16px',
    padding: '16px',
    backgroundColor: '#F3F4F6',
    border: '1px solid #D1D5DB',
    borderRadius: '8px',
    textAlign: 'center'
  },
  rejectText: {
    color: '#374151',
    fontWeight: '600',
    margin: 0
  },

  bottomText: {
    fontSize: '12px',
    color: '#9CA3AF',
    textAlign: 'center',
    margin: 0
  },

  // Loading state
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 32px'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #E5E7EB',
    borderTop: '4px solid #C099DD',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite'
  },
  loadingText: {
    marginTop: '16px',
    fontSize: '16px',
    color: '#6B7280',
    fontWeight: '500'
  },

  // Footer
  footer: {
    marginTop: 'auto',
    borderTop: '1px solid #F0F0F0',
    padding: '24px',
    textAlign: 'center'
  },
  footerText: {
    fontSize: '14px',
    color: '#9CA3AF',
    margin: 0
  }
};

