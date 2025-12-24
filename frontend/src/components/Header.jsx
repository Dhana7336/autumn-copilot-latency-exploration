import React from 'react';

export default function Header() {
  return (
    <header style={styles.header}>
      <div style={styles.container}>
        <h1 style={styles.title}>AI Pricing Copilot</h1>
        <p style={styles.subtitle}>Dynamic pricing powered by AI recommendations</p>
      </div>
    </header>
  );
}

const styles = {
  header: {
    background: '#C099DD',
    color: 'white',
    padding: '24px 0',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  },
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    paddingLeft: '16px',
    paddingRight: '16px'
  },
  title: {
    margin: '0 0 8px 0',
    fontSize: '32px',
    fontWeight: '700'
  },
  subtitle: {
    margin: '0',
    fontSize: '14px',
    opacity: '0.9'
  }
};
