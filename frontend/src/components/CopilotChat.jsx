import React from 'react';

export default function CopilotChat({ onSendPrompt, loading }) {
  const [prompt, setPrompt] = React.useState('');
  const [operator, setOperator] = React.useState('');

  const handleSend = () => {
    if (!operator.trim()) {
      alert('Please enter your operator name for audit logging.');
      return;
    }
    if (!prompt.trim()) {
      alert('Please describe what you want to do with pricing.');
      return;
    }
    onSendPrompt({ prompt, operator });
    setPrompt('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && e.ctrlKey && !loading) {
      handleSend();
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>🤖 AI Pricing Copilot</h2>
      <p style={styles.subtitle}>
        The copilot will explain reasoning, propose concrete actions, and wait for your approval before making any changes.
      </p>
      
      <div style={styles.rulesBox}>
        <strong>Agent Guarantees:</strong>
        <ul style={styles.rulesList}>
          <li>✓ Never silently apply changes</li>
          <li>✓ Always explain reasoning in plain English</li>
          <li>✓ Propose concrete price changes</li>
          <li>✓ Wait for explicit approval</li>
          <li>✓ Apply only after you say yes</li>
          <li>✓ Log all decisions in audit trail</li>
        </ul>
      </div>
      
      <div style={styles.form}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Your Name (required - for audit logging)</label>
          <input
            type="text"
            placeholder="e.g., Alice, Bob, or Operator ID"
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            disabled={loading}
            style={styles.input}
          />
        </div>
        
        <div style={styles.formGroup}>
          <label style={styles.label}>What do you want to achieve? (required)</label>
          <textarea
            placeholder={`Examples:
• Raise prices for high-occupancy rooms next weekend
• Lower economy room rates to boost bookings this week
• Match competitor pricing across all room types
• Maximize revenue for suite availability`}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={loading}
            style={styles.textarea}
            rows="4"
          />
          <div style={styles.hint}>Tip: Ctrl+Enter to submit</div>
        </div>
        
        <button
          onClick={handleSend}
          disabled={loading || !prompt.trim() || !operator.trim()}
          style={{
            ...styles.button,
            opacity: loading || !prompt.trim() || !operator.trim() ? 0.5 : 1,
            cursor: loading || !prompt.trim() || !operator.trim() ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? '⏳ Analyzing...' : '📊 Analyze & Propose'}
        </button>
      </div>

      <div style={styles.flowBox}>
        <strong>Step-by-Step Flow:</strong>
        <ol style={styles.flowSteps}>
          <li><strong>Interpret</strong> your intent from the prompt</li>
          <li><strong>Analyze</strong> pricing data: occupancy, competitors, constraints</li>
          <li><strong>Explain</strong> key signals driving each suggestion</li>
          <li><strong>Propose</strong> concrete price changes (never applied yet)</li>
          <li><strong>Ask</strong> for your explicit approval on each room</li>
          <li><strong>Apply</strong> only the changes you approve</li>
          <li><strong>Log</strong> all decisions with timestamps and reasoning</li>
        </ol>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '24px',
    background: '#FFFFFF',
    borderRadius: '8px',
    marginBottom: '24px',
    border: '1px solid #E0D4EB',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
  },
  title: {
    margin: '0 0 8px 0',
    fontSize: '22px',
    fontWeight: '700',
    color: '#2C2C2C'
  },
  subtitle: {
    margin: '0 0 16px 0',
    fontSize: '14px',
    color: '#6B6B6B',
    lineHeight: '1.5'
  },
  rulesBox: {
    padding: '12px 16px',
    background: '#F5F0FA',
    borderLeft: '4px solid #C099DD',
    borderRadius: '4px',
    marginBottom: '16px',
    fontSize: '13px'
  },
  rulesList: {
    margin: '8px 0 0 0',
    paddingLeft: '20px',
    color: '#6B6B6B'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#2C2C2C'
  },
  input: {
    padding: '10px 12px',
    border: '1px solid #E0D4EB',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'system-ui, sans-serif',
    boxSizing: 'border-box'
  },
  textarea: {
    padding: '10px 12px',
    border: '1px solid #E0D4EB',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'system-ui, sans-serif',
    resize: 'vertical',
    boxSizing: 'border-box'
  },
  hint: {
    fontSize: '12px',
    color: '#999',
    marginTop: '4px'
  },
  button: {
    padding: '12px 16px',
    background: '#C099DD',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background 0.2s'
  },
  flowBox: {
    padding: '16px',
    background: '#F5F0FA',
    borderLeft: '4px solid #7B68BE',
    borderRadius: '4px',
    marginTop: '16px',
    fontSize: '13px'
  },
  flowSteps: {
    margin: '12px 0 0 0',
    paddingLeft: '20px',
    color: '#6B6B6B',
    lineHeight: '1.6'
  }
};
