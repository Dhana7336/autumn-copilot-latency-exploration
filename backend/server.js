require('dotenv').config();
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

// Import data loader
const dataLoader = require('./services/dataLoader');

// Import revert scheduler
const { startRevertScheduler } = require('./services/revertScheduler');

// Import routes
const hotelsRouter = require('./routes/hotels');
const bookingsRouter = require('./routes/bookings');
const copilotRouter = require('./routes/copilot');
const uploadRouter = require('./routes/upload');
const apiRouter = require('./routes/api');
const pricingRouter = require('./routes/pricing');

const app = express();
const PORT = process.env.PORT || 4001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api', apiRouter);
app.use('/api/hotels', hotelsRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/copilot', copilotRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/pricing', pricingRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), dataLoaded: dataLoader.loaded });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Load CSV data and start server
async function startServer() {
  try {
    console.log('Loading CSV data...');
    await dataLoader.loadAllData();

    app.listen(PORT, () => {
      console.log(`\n🚀 AI Copilot Backend listening on http://localhost:${PORT}`);
      console.log(`\nAvailable Routes:`);
      console.log(`  POST /api/copilot/chat     - AI chat with action proposals`);
      console.log(`  POST /api/copilot/suggest  - Get pricing suggestions`);
      console.log(`  POST /api/copilot/apply    - Apply approved actions`);
      console.log(`  GET  /api/copilot/dashboard - Dashboard data`);
      console.log(`\n  Additional routes:`);
      console.log(`  /api/copilot/actions/*     - Action management`);
      console.log(`  /api/copilot/data/*        - Data access`);
      console.log(`  /api/pricing/*             - Pricing analysis`);
      console.log(`  /api/bookings              - Bookings`);
      console.log(`  /api/hotels                - Hotels`);
      console.log(`  /api/upload                - File upload`);
      console.log(`\n✓ Server ready!\n`);

      // Start the automatic revert scheduler (runs every hour)
      console.log('⏰ Starting temporary pricing revert scheduler...');
      startRevertScheduler(60 * 60 * 1000);
      console.log('✓ Revert scheduler started\n');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
