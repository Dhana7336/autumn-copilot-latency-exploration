const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const csvParser = require('csv-parser');
const { createReadStream } = require('fs');

const UPLOADS_DIR = path.resolve(__dirname, '../uploads');
const CSV_DIR = path.resolve(__dirname, '../data/csv');
const HOTEL_SETTINGS_PATH = path.resolve(__dirname, '../data/hotel-settings.json');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

/**
 * POST /api/upload/reservations - Upload reservation CSV file
 */
router.post('/reservations', upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const results = [];
    const filePath = req.file.path;

    // Parse CSV file
    createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        try {
          // Save parsed data to CSV directory
          const targetPath = path.join(CSV_DIR, 'reservations.csv');
          await fs.copyFile(filePath, targetPath);

          // Also save as JSON for easier backend processing
          const jsonPath = path.join(CSV_DIR, 'reservations.json');
          await fs.writeFile(jsonPath, JSON.stringify(results, null, 2));

          res.json({
            success: true,
            message: 'Reservations uploaded successfully',
            recordCount: results.length,
            filePath: targetPath,
            preview: results.slice(0, 5) // Send first 5 rows as preview
          });
        } catch (err) {
          console.error('Error saving CSV:', err);
          res.status(500).json({ error: 'Failed to save CSV data' });
        }
      })
      .on('error', (err) => {
        console.error('Error parsing CSV:', err);
        res.status(500).json({ error: 'Failed to parse CSV file' });
      });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/upload/reservations - Get current reservation data
 */
router.get('/reservations', async (req, res) => {
  try {
    const jsonPath = path.join(CSV_DIR, 'reservations.json');
    const data = await fs.readFile(jsonPath, 'utf8');
    const reservations = JSON.parse(data);

    res.json({
      success: true,
      count: reservations.length,
      data: reservations
    });
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.json({ success: true, count: 0, data: [], message: 'No reservations uploaded yet' });
    } else {
      res.status(500).json({ error: 'Failed to load reservations' });
    }
  }
});

/**
 * POST /api/upload/onboarding - Save hotel onboarding information
 */
router.post('/onboarding', async (req, res) => {
  try {
    const { hotelName, websiteUrl, pricingObjective, competitorUrls, targetMarket } = req.body;

    if (!hotelName || !pricingObjective) {
      return res.status(400).json({ error: 'Hotel name and pricing objective are required' });
    }

    const settings = {
      hotelName,
      websiteUrl: websiteUrl || '',
      pricingObjective,
      competitorUrls: competitorUrls || [],
      targetMarket: targetMarket || 'general',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await fs.writeFile(HOTEL_SETTINGS_PATH, JSON.stringify(settings, null, 2));

    res.json({
      success: true,
      message: 'Hotel settings saved successfully',
      settings
    });
  } catch (err) {
    console.error('Error saving hotel settings:', err);
    res.status(500).json({ error: 'Failed to save hotel settings' });
  }
});

/**
 * GET /api/upload/onboarding - Get hotel settings
 */
router.get('/onboarding', async (req, res) => {
  try {
    const data = await fs.readFile(HOTEL_SETTINGS_PATH, 'utf8');
    const settings = JSON.parse(data);
    res.json({ success: true, settings });
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.json({ success: true, settings: null, message: 'No hotel settings found' });
    } else {
      res.status(500).json({ error: 'Failed to load hotel settings' });
    }
  }
});

module.exports = router;