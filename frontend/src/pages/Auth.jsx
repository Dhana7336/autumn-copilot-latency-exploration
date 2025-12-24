import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';

export default function Auth({ initialMode = 'signup' }) {
  const navigate = useNavigate();
  const location = useLocation();

  const getInitialMode = () => {
    const params = new URLSearchParams(location.search);
    const searchMode = params.get('mode');
    if (searchMode === 'login' || searchMode === 'signup') return searchMode;
    return initialMode === 'login' ? 'login' : 'signup';
  };

  const [mode, setMode] = useState(getInitialMode());
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (mode === 'signup') {
      if (!formData.firstName.trim()) {
        newErrors.firstName = 'First name is required';
      }
      if (!formData.lastName.trim()) {
        newErrors.lastName = 'Last name is required';
      }
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    // Simulated auth flow (local-only)
    setTimeout(() => {
      if (mode === 'signup') {
        // Signup: save new user with name
        const userProfile = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email.toLowerCase(), // Normalize email to lowercase
          createdAt: new Date().toISOString()
        };
        localStorage.setItem('autumnUser', JSON.stringify(userProfile));

        // Also add to users array so they can be found on next login
        const allUsers = JSON.parse(localStorage.getItem('autumnUsers') || '[]');

        // Check if user already exists (prevent duplicates)
        const existingIndex = allUsers.findIndex(u => u.email.toLowerCase() === userProfile.email.toLowerCase());
        if (existingIndex >= 0) {
          // Update existing user instead of creating duplicate
          allUsers[existingIndex] = userProfile;
        } else {
          // Add new user
          allUsers.push(userProfile);
        }
        localStorage.setItem('autumnUsers', JSON.stringify(allUsers));
      } else {
        // Login: retrieve existing user by email and update lastLoginAt (case-insensitive)
        const allUsers = JSON.parse(localStorage.getItem('autumnUsers') || '[]');
        const existingUser = allUsers.find(u => u.email.toLowerCase() === formData.email.toLowerCase());

        if (existingUser) {
          existingUser.lastLoginAt = new Date().toISOString();
          localStorage.setItem('autumnUser', JSON.stringify(existingUser));
          localStorage.setItem('autumnUsers', JSON.stringify(allUsers));
        } else {
          // User doesn't exist in our records - create minimal profile
          const userProfile = {
            firstName: 'User',
            lastName: '',
            email: formData.email.toLowerCase(),
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString()
          };
          localStorage.setItem('autumnUser', JSON.stringify(userProfile));
          allUsers.push(userProfile);
          localStorage.setItem('autumnUsers', JSON.stringify(allUsers));
        }
      }

      localStorage.setItem('autumnAuth', 'true');
      setIsSubmitting(false);
      navigate('/chat', { replace: true });
    }, 800);
  };

  return (
    <div style={styles.container}>
      {/* Logo */}
      <div style={styles.logo}>Autumn</div>

      {/* Main Card */}
      <div style={styles.card}>
        <div style={styles.cardContent}>
          {/* Title */}
          <h1 style={styles.title}>
            {mode === 'signup' ? 'Create your AI workspace' : 'Welcome back'}
          </h1>

          {/* Subtitle */}
          <p style={styles.subtitle}>
            {mode === 'signup'
              ? 'Add these last details to create an account and securely manage pricing, bookings, and AI actions.'
              : 'Log in to continue managing pricing, bookings, and AI actions securely.'}
          </p>

          {/* Mode toggle */}
          <div style={styles.toggle}>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrors({});
              }}
              style={{
                ...styles.toggleBtn,
                ...(mode === 'signup' ? styles.toggleBtnActive : {})
              }}
            >
              Create account
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrors({});
              }}
              style={{
                ...styles.toggleBtn,
                ...(mode === 'login' ? styles.toggleBtnActive : {})
              }}
            >
              Log in
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={styles.form}>
            {/* Two-column grid */}
            <div
              className="formGrid"
              style={{
                ...styles.formGrid,
                gridTemplateColumns: mode === 'signup' ? '1fr 1fr' : '1fr'
              }}
            >
              {mode === 'signup' && (
                <>
                  {/* First Name - only in signup */}
                  <div style={styles.formGroup}>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      placeholder="First name"
                      style={{
                        ...styles.input,
                        ...(errors.firstName ? styles.inputError : {})
                      }}
                    />
                    {errors.firstName && (
                      <span style={styles.errorText}>{errors.firstName}</span>
                    )}
                  </div>

                  {/* Last Name - only in signup */}
                  <div style={styles.formGroup}>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      placeholder="Last name"
                      style={{
                        ...styles.input,
                        ...(errors.lastName ? styles.inputError : {})
                      }}
                    />
                    {errors.lastName && (
                      <span style={styles.errorText}>{errors.lastName}</span>
                    )}
                  </div>
                </>
              )}

              {/* Email */}
              <div style={styles.formGroup}>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Email address"
                  style={{
                    ...styles.input,
                    ...(errors.email ? styles.inputError : {})
                  }}
                />
                {errors.email && (
                  <span style={styles.errorText}>{errors.email}</span>
                )}
              </div>

              {/* Password */}
              <div style={styles.formGroup}>
                <div style={styles.passwordWrapper}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Password"
                    style={{
                      ...styles.input,
                      ...styles.passwordInput,
                      ...(errors.password ? styles.inputError : {})
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff size={18} color="#9CA3AF" />
                    ) : (
                      <Eye size={18} color="#9CA3AF" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <span style={styles.errorText}>{errors.password}</span>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div style={styles.submitSection}>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  ...styles.submitButton,
                  ...(isSubmitting ? styles.submitButtonDisabled : {})
                }}
              >
                {isSubmitting
                  ? mode === 'signup' ? 'Creating account...' : 'Signing you in...'
                  : mode === 'signup' ? 'Create account & continue' : 'Log in & continue'}
              </button>
            </div>

            {/* Terms / Switch */}
            <div style={styles.bottomRow}>
              {mode === 'signup' ? (
                <p style={styles.terms}>By creating an account, you agree to our Terms of Service.</p>
              ) : (
                <p style={styles.terms}>Use your existing account email to continue.</p>
              )}

              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'signup' ? 'login' : 'signup');
                  setErrors({});
                }}
                style={styles.textButton}
              >
                {mode === 'signup' ? 'Already have an account? Log in' : 'New to Autumn? Create account'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Bottom spacing */}
      <div style={styles.bottomSpacer}></div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(to bottom, #FDFCFE 0%, #F9F7FB 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 20px',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },

  logo: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#C099DD',
    marginBottom: '60px',
    alignSelf: 'flex-start',
    marginLeft: 'max(20px, calc((100vw - 640px) / 2))'
  },

  card: {
    width: '100%',
    maxWidth: '640px',
    background: '#FFFFFF',
    borderRadius: '16px',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06), 0 0 1px rgba(0, 0, 0, 0.04)',
    overflow: 'hidden'
  },

  cardContent: {
    padding: '56px 64px'
  },

  title: {
    fontSize: '28px',
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    margin: '0 0 12px 0',
    letterSpacing: '-0.01em'
  },

  subtitle: {
    fontSize: '15px',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: '1.6',
    margin: '0 0 48px 0',
    maxWidth: '480px',
    marginLeft: 'auto',
    marginRight: 'auto'
  },

  toggle: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
    padding: '6px',
    background: '#F6F1FB',
    borderRadius: '12px',
    margin: '0 0 32px 0'
  },

  toggleBtn: {
    border: 'none',
    background: 'transparent',
    padding: '12px 10px',
    borderRadius: '10px',
    fontWeight: 600,
    color: '#6B7280',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },

  toggleBtnActive: {
    background: '#FFFFFF',
    color: '#1F2937',
    boxShadow: '0 6px 20px rgba(0,0,0,0.06)'
  },

  form: {
    width: '100%'
  },

  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '32px 24px',
    marginBottom: '40px'
  },

  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },

  input: {
    width: '100%',
    padding: '12px 0',
    fontSize: '15px',
    color: '#1F2937',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid #E5E7EB',
    outline: 'none',
    transition: 'border-color 0.2s ease',
    fontFamily: 'inherit',
    boxSizing: 'border-box'
  },

  inputError: {
    borderBottomColor: '#EF4444'
  },

  passwordWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },

  passwordInput: {
    paddingRight: '40px'
  },

  eyeButton: {
    position: 'absolute',
    right: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'opacity 0.2s'
  },

  errorText: {
    fontSize: '13px',
    color: '#EF4444',
    marginTop: '4px'
  },

  submitSection: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: '16px'
  },

  submitButton: {
    padding: '14px 32px',
    fontSize: '15px',
    fontWeight: '600',
    color: '#FFFFFF',
    background: 'linear-gradient(135deg, #C099DD 0%, #A07FC5 100%)',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 12px rgba(192, 153, 221, 0.25)',
    fontFamily: 'inherit',
    letterSpacing: '0.01em'
  },

  submitButtonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
    boxShadow: 'none'
  },

  terms: {
    fontSize: '13px',
    color: '#9CA3AF',
    textAlign: 'left',
    margin: 0
  },

  bottomRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    marginTop: '12px',
    flexWrap: 'wrap'
  },

  textButton: {
    border: 'none',
    background: 'transparent',
    color: '#7C4DA7',
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0
  },

  bottomSpacer: {
    height: '60px'
  }
};

// Add CSS for focus states
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  input:focus {
    border-bottom-color: #C099DD !important;
  }

  button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(192, 153, 221, 0.35) !important;
  }

  button:active:not(:disabled) {
    transform: translateY(0);
  }

  @media (max-width: 640px) {
    .formGrid {
      grid-template-columns: 1fr !important;
    }
  }
`;
document.head.appendChild(styleSheet);