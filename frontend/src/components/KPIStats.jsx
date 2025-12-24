import React from 'react';

export default function KPIStats({ rooms = [] }) {
  if (!rooms || rooms.length === 0) {
    return <div style={styles.empty}>No rooms data available</div>;
  }

  const avgPrice = rooms.reduce((sum, r) => sum + r.currentPrice, 0) / rooms.length;
  const avgOccupancy = rooms.reduce((sum, r) => sum + r.occupancy, 0) / rooms.length;
  const totalRevenue = rooms.reduce((sum, r) => sum + r.currentPrice * r.occupancy, 0);

  const stats = [
    { label: 'Avg Price', value: `$${avgPrice.toFixed(2)}` },
    { label: 'Avg Occupancy', value: `${(avgOccupancy * 100).toFixed(0)}%` },
    { label: 'Total Revenue', value: `$${totalRevenue.toFixed(2)}` },
    { label: 'Rooms', value: rooms.length }
  ];

  return (
    <div style={styles.container}>
      {stats.map((stat, idx) => (
        <div key={idx} style={styles.card}>
          <div style={styles.label}>{stat.label}</div>
          <div style={styles.value}>{stat.value}</div>
        </div>
      ))}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    gap: '16px',
    marginBottom: '24px',
    flexWrap: 'wrap'
  },
  card: {
    flex: '1',
    minWidth: '150px',
    padding: '16px',
    background: '#FFFFFF',
    border: '1px solid #E0D4EB',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
  },
  label: {
    fontSize: '12px',
    color: '#6B6B6B',
    marginBottom: '8px',
    textTransform: 'uppercase'
  },
  value: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#C099DD'
  },
  empty: {
    padding: '24px',
    textAlign: 'center',
    color: '#6B6B6B'
  }
};
