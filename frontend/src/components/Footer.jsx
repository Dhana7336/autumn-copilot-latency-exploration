import React from 'react';

export default function Footer() {
  return (
    <footer style={styles.footer}>
      <div style={styles.container}>
        <p style={styles.text}>© 2025 AI Pricing Copilot. All rights reserved.</p>
        <p style={styles.text}>Built with dynamic pricing intelligence</p>
      </div>
    </footer>
  );
}

const styles = {
  footer: {
    background: '#FFFFFF',
    borderTop: '1px solid #FFFFFF',
    padding: '24px 0',
    marginTop: '48px',
    textAlign: 'center'
  },
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    paddingLeft: '16px',
    paddingRight: '16px'
  },
  text: {
    margin: '8px 0',
    fontSize: '14px',
    color: '#6B6B6B'
  }
};
