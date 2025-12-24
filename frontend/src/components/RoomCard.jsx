import React, { useState } from 'react';

export default function RoomCard({ room, onApprove }) {
  const [approved, setApproved] = useState(false);
  const [adjustedPrice, setAdjustedPrice] = useState(room.suggested || room.currentPrice);

  const handleApprove = () => {
    onApprove({ id: room.id, approved: !approved, suggested: adjustedPrice });
    setApproved(!approved);
  };

  const priceChange = adjustedPrice - room.currentPrice;
  const pctChange = (priceChange / room.currentPrice) * 100;

  return (
    <div style={{ ...styles.card, borderLeft: approved ? '4px solid #4CAF50' : '4px solid #E0D4EB' }}>
      <div style={styles.header}>
        <h3 style={styles.title}>{room.name}</h3>
        <div style={styles.status}>
          {approved ? (
            <span style={styles.statusApproved}>✓ Marked for Approval</span>
          ) : (
            <span style={styles.statusPending}>○ Awaiting Decision</span>
          )}
        </div>
      </div>

      <div style={styles.analysis}>
        <div style={styles.stat}>
          <span style={styles.label}>Current Price</span>
          <span style={styles.value}>${room.currentPrice.toFixed(2)}</span>
        </div>
        <div style={styles.stat}>
          <span style={styles.label}>Copilot Suggests</span>
          <span style={{ ...styles.value, color: '#C099DD' }}>${(room.suggested || room.currentPrice).toFixed(2)}</span>
        </div>
        <div style={styles.stat}>
          <span style={styles.label}>Change</span>
          <span style={{ ...styles.value, color: priceChange >= 0 ? '#4CAF50' : '#F44336', fontWeight: '700' }}>
            {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)} ({pctChange >= 0 ? '+' : ''}{pctChange.toFixed(1)}%)
          </span>
        </div>
      </div>

      {room.reasonSummary && (
        <div style={styles.reasoning}>
          <strong>🔍 Why This Price?</strong>
          <div style={styles.reasonText}>{room.reasonSummary}</div>
          {room.reason && (
            <div style={styles.reasonDetail}>{room.reason}</div>
          )}
        </div>
      )}

      <div style={styles.constraints}>
        <strong>Constraints:</strong> ${room.minAllowed?.toFixed(2) || 'N/A'} – ${room.maxAllowed?.toFixed(2) || 'N/A'}
      </div>

      <div style={styles.controls}>
        <div style={styles.inputGroup}>
          <label style={styles.adjustLabel}>Adjust if needed (optional):</label>
          <input
            type="number"
            step="0.01"
            value={adjustedPrice}
            onChange={(e) => setAdjustedPrice(parseFloat(e.target.value) || room.currentPrice)}
            style={styles.input}
          />
        </div>
        <button
          onClick={handleApprove}
          style={{
            ...styles.button,
            background: approved ? '#4CAF50' : '#C099DD',
            fontWeight: approved ? '700' : '600'
          }}
        >
          {approved ? '✓ Approve This Change' : '☐ Approve This Change'}
        </button>
      </div>

      <div style={styles.note}>
        ℹ️ This is a <strong>proposal only</strong>. No changes applied yet. You can approve multiple rooms, then apply all at once.
      </div>
    </div>
  );
}

const styles = {
  card: {
    padding: '16px',
    background: '#FFFFFF',
    border: '1px solid #E0D4EB',
    borderRadius: '8px',
    marginBottom: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  title: {
    margin: '0',
    fontSize: '18px',
    fontWeight: '700',
    color: '#2C2C2C'
  },
  status: {
    fontSize: '12px',
    fontWeight: '600'
  },
  statusApproved: {
    color: '#4CAF50'
  },
  statusPending: {
    color: '#999'
  },
  analysis: {
    display: 'flex',
    gap: '16px',
    marginBottom: '12px',
    padding: '12px',
    background: '#F5F0FA',
    borderRadius: '4px'
  },
  stat: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column'
  },
  label: {
    fontSize: '12px',
    color: '#6B6B6B',
    marginBottom: '4px',
    fontWeight: '600'
  },
  value: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#C099DD'
  },
  reasoning: {
    padding: '12px',
    background: '#FFFAF0',
    border: '1px solid #F0E0D0',
    borderRadius: '4px',
    marginBottom: '12px',
    fontSize: '13px'
  },
  reasonText: {
    margin: '8px 0 4px 0',
    fontWeight: '600',
    color: '#2C2C2C'
  },
  reasonDetail: {
    margin: '4px 0 0 0',
    fontSize: '12px',
    color: '#6B6B6B'
  },
  constraints: {
    padding: '8px 12px',
    background: '#F5F5F5',
    borderRadius: '4px',
    fontSize: '12px',
    color: '#6B6B6B',
    marginBottom: '12px'
  },
  controls: {
    display: 'flex',
    gap: '12px',
    marginBottom: '12px',
    alignItems: 'flex-end'
  },
  inputGroup: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  adjustLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#2C2C2C'
  },
  input: {
    padding: '8px 10px',
    border: '1px solid #E0D4EB',
    borderRadius: '4px',
    fontSize: '13px',
    fontFamily: 'inherit',
    boxSizing: 'border-box'
  },
  button: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    color: 'white',
    whiteSpace: 'nowrap',
    transition: 'background 0.2s'
  },
  note: {
    padding: '8px 12px',
    background: '#E8F5E9',
    border: '1px solid #C8E6C9',
    borderRadius: '4px',
    fontSize: '12px',
    color: '#2E7D32'
  }
};
