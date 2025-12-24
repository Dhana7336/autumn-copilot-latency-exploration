import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Signup(){
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const disabled = !firstName.trim() || !lastName.trim() || !email.trim() || !password.trim() || submitting

  const handleSubmit = (e) => {
    e.preventDefault()
    if (disabled) return
    setSubmitting(true)
    // simulate account creation then redirect to AI Agent Home
    setTimeout(() => {
      setSubmitting(false)
      navigate('/chat')
    }, 600)
  }

  return (
    <div className="signup-page">
      <div className="brand">Autumn</div>
      <main className="signup-main">
        <form className="signup-card" onSubmit={handleSubmit} aria-label="Create account">
          <h1 className="card-title">Your AI workspace is ready</h1>
          <p className="card-sub">Add these last details to create an account and securely manage pricing, bookings, and AI actions.</p>

          <div className="form-grid">
            <div className="field">
              <label className="label">First name</label>
              <input value={firstName} onChange={e=>setFirstName(e.target.value)} className="input" required />
            </div>
            <div className="field">
              <label className="label">Last name</label>
              <input value={lastName} onChange={e=>setLastName(e.target.value)} className="input" required />
            </div>
            <div className="field">
              <label className="label">Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="input" required />
            </div>
            <div className="field">
              <label className="label">Password</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="input" required />
            </div>
          </div>

          <div className="card-footer">
            <div className="helper">By creating an account, you agree to our Terms of Service.</div>
            <button type="submit" className="primary" disabled={disabled} aria-disabled={disabled}>
              {submitting ? 'Creating…' : 'Create account & continue'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
