import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import Auth from './pages/Auth'
import Chat from './pages/Chat'
import Dashboard from './pages/Dashboard'
import DashboardTest from './pages/DashboardTest'
import ReportDashboard from './pages/ReportDashboard'
import Calendar from './pages/Calendar'
import SettingsPage from './pages/Settings'
import './styles.css'

export default function App(){
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/landing" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/signup" element={<Auth initialMode="signup" />} />
        <Route path="/login" element={<Auth initialMode="login" />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard-old" element={<Dashboard />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/reports" element={<ReportDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}