import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CSVUpload from '../components/CSVUpload';
import { TrendingUp, DollarSign, Users, Calendar, Settings } from 'lucide-react';

export default function NewDashboard() {
  const navigate = useNavigate();
  const [hotelSettings, setHotelSettings] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalBookings: 0,
    averagePrice: 0,
    occupancyRate: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const settingsRes = await fetch('http://localhost:4001/api/upload/onboarding');
      const settingsData = await settingsRes.json();
      if (settingsData.success && settingsData.settings) {
        setHotelSettings(settingsData.settings);
      }

      const reservationsRes = await fetch('http://localhost:4001/api/upload/reservations');
      const reservationsData = await reservationsRes.json();
      if (reservationsData.success && reservationsData.data) {
        setReservations(reservationsData.data);
        calculateStats(reservationsData.data);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data) => {
    if (!data || data.length === 0) return;

    const totalRevenue = data.reduce((sum, booking) => {
      const price = parseFloat(booking['Total Price'] || booking.totalPrice || booking.price || 0);
      return sum + price;
    }, 0);

    const totalBookings = data.length;
    const confirmedBookings = data.filter(b =>
      (b.Status || b.status || '').toLowerCase() === 'confirmed'
    ).length;
    const averagePrice = totalRevenue / totalBookings;

    setStats({
      totalRevenue: totalRevenue.toFixed(2),
      totalBookings,
      averagePrice: averagePrice.toFixed(2),
      occupancyRate: ((confirmedBookings / totalBookings) * 100).toFixed(1)
    });
  };

  const handleUploadSuccess = () => {
    loadData();
  };

  if (loading) {
    return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>Loading...</div>;
  }

  return (
    <div style={{minHeight:'100vh',background:'#F7F9FC'}}>
      <header style={{background:'#FFF',borderBottom:'1px solid #E0D4EB',padding:'24px 32px'}}>
        <div style={{maxWidth:'1200px',margin:'0 auto',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <h1 style={{fontSize:'28px',fontWeight:'700',margin:0}}>{hotelSettings?.hotelName || 'Hotel'} Dashboard</h1>
            <p style={{fontSize:'14px',color:'#6B6B6B',margin:0}}>Revenue & Pricing Analytics</p>
          </div>
          <div style={{display:'flex',gap:'12px'}}>
            <button onClick={() => navigate('/onboarding')} style={{padding:'10px 20px',background:'#F5F5F5',border:'none',borderRadius:'8px',cursor:'pointer'}}>Settings</button>
            <button onClick={() => navigate('/')} style={{padding:'10px 20px',background:'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',color:'#FFF',border:'none',borderRadius:'8px',cursor:'pointer'}}>AI Copilot</button>
          </div>
        </div>
      </header>
      <div style={{maxWidth:'1200px',margin:'0 auto',padding:'32px'}}>
        <CSVUpload onUploadSuccess={handleUploadSuccess} />
      </div>
    </div>
  );
}
