import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Onboarding() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    hotelName: '',
    websiteUrl: '',
    pricingObjective: '',
    competitorUrls: '',
    targetMarket: 'general'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = {
        ...formData,
        competitorUrls: formData.competitorUrls.split('\n').filter(url => url.trim())
      };

      const response = await fetch('http://localhost:4001/api/upload/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      } else {
        setError(data.error || 'Failed to save hotel settings');
      }
    } catch (err) {
      setError('Failed to connect to server: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={styles.container}>
        <div style={styles.successCard}>
          <div style={styles.successIcon}>✓</div>
          <h2 style={styles.successTitle}>Hotel Settings Saved!</h2>
          <p style={styles.successText}>Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Hotel Onboarding</h1>
          <p style={styles.subtitle}>
            Set up your hotel pricing strategy and AI copilot preferences
          </p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>
              Hotel Name <span style={styles.required}>*</span>
            </label>
            <input
              type="text"
              name="hotelName"
              value={formData.hotelName}
              onChange={handleChange}
              required
              placeholder="e.g., Grand Plaza Hotel"
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>
              Hotel Website URL
            </label>
            <input
              type="url"
              name="websiteUrl"
              value={formData.websiteUrl}
              onChange={handleChange}
              placeholder="https://www.yourhotel.com"
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>
              Pricing Objective <span style={styles.required}>*</span>
            </label>
            <textarea
              name="pricingObjective"
              value={formData.pricingObjective}
              onChange={handleChange}
              required
              rows="4"
              placeholder="e.g., I want to be priced slightly below competitor XYZ on weekdays and slightly above competitors on weekends when there is more demand"
              style={styles.textarea}
            />
            <p style={styles.hint}>
              Describe your pricing goals and strategy in detail
            </p>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>
              Competitor URLs (one per line)
            </label>
            <textarea
              name="competitorUrls"
              value={formData.competitorUrls}
              onChange={handleChange}
              rows="4"
              placeholder={'https://competitor1.com\nhttps://competitor2.com\nhttps://competitor3.com'}
              style={styles.textarea}
            />
            <p style={styles.hint}>
              Add competitor hotel websites for price comparison
            </p>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>
              Target Market
            </label>
            <select
              name="targetMarket"
              value={formData.targetMarket}
              onChange={handleChange}
              style={styles.select}
            >
              <option value="general">General</option>
              <option value="business">Business Travelers</option>
              <option value="leisure">Leisure Travelers</option>
              <option value="luxury">Luxury Market</option>
              <option value="budget">Budget Market</option>
            </select>
          </div>

          {error && (
            <div style={styles.errorBox}>
              {error}
            </div>
          )}

          <div style={styles.buttonGroup}>
            <button
              type="button"
              onClick={() => navigate('/')}
              style={styles.cancelButton}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                ...styles.submitButton,
                opacity: loading ? 0.6 : 1,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '40px 20px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  },
  card: {
    background: '#FFFFFF',
    borderRadius: '12px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
    maxWidth: '700px',
    width: '100%',
    padding: '40px'
  },
  header: {
    marginBottom: '32px',
    textAlign: 'center'
  },
  title: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#2C2C2C',
    margin: '0 0 8px 0'
  },
  subtitle: {
    fontSize: '16px',
    color: '#6B6B6B',
    margin: 0
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
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
  required: {
    color: '#E53E3E'
  },
  input: {
    padding: '12px 16px',
    border: '2px solid #E0D4EB',
    borderRadius: '8px',
    fontSize: '15px',
    fontFamily: 'system-ui, sans-serif',
    transition: 'border-color 0.2s',
    outline: 'none'
  },
  textarea: {
    padding: '12px 16px',
    border: '2px solid #E0D4EB',
    borderRadius: '8px',
    fontSize: '15px',
    fontFamily: 'system-ui, sans-serif',
    resize: 'vertical',
    transition: 'border-color 0.2s',
    outline: 'none'
  },
  select: {
    padding: '12px 16px',
    border: '2px solid #E0D4EB',
    borderRadius: '8px',
    fontSize: '15px',
    fontFamily: 'system-ui, sans-serif',
    background: '#FFFFFF',
    cursor: 'pointer',
    outline: 'none'
  },
  hint: {
    fontSize: '13px',
    color: '#999',
    margin: 0
  },
  errorBox: {
    padding: '12px 16px',
    background: '#FEE',
    border: '1px solid #E53E3E',
    borderRadius: '8px',
    color: '#E53E3E',
    fontSize: '14px'
  },
  buttonGroup: {
    display: 'flex',
    gap: '12px',
    marginTop: '16px'
  },
  cancelButton: {
    flex: 1,
    padding: '14px 24px',
    background: '#F5F5F5',
    color: '#2C2C2C',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background 0.2s'
  },
  submitButton: {
    flex: 2,
    padding: '14px 24px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'opacity 0.2s'
  },
  successCard: {
    background: '#FFFFFF',
    borderRadius: '12px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
    padding: '60px 40px',
    textAlign: 'center',
    maxWidth: '500px'
  },
  successIcon: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: '#48BB78',
    color: '#FFFFFF',
    fontSize: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 24px',
    fontWeight: '700'
  },
  successTitle: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#2C2C2C',
    margin: '0 0 12px 0'
  },
  successText: {
    fontSize: '16px',
    color: '#6B6B6B',
    margin: 0
  }
};