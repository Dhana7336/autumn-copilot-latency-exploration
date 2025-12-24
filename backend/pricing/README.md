# Advanced Pricing Modules

## Overview
Comprehensive hotel pricing system with ML training fix, competitor analysis, demand forecasting, risk assessment, and business rules validation.

## Modules

### 1. **pricingEngine.js** (Fixed)
**Fixed Training Target**: Now trains on optimal price based on competitor average and occupancy, not arbitrary formula.

```javascript
const target = room.currentPrice + (compAvg - room.currentPrice) * 0.5 + ...

// New (correct): Clear optimal price target
const optimalPrice = compAvg * occupancyFactor;
```

### 2. **competitorAnalysis.js**
Comprehensive market positioning analysis.

**Features**:
- Market position classification (budget/value/competitive/premium/ultra-premium)
- Price gap analysis vs competitors
- Competitive threats identification
- Market share estimation
- Revenue potential calculation

**Example**:
```javascript
const analysis = competitorAnalysis.analyzeCompetitors(room, competitors, allRooms);
// Returns: position, priceGap, marketAvg, recommendation, threats
```

### 3. **demandForecast.js**
Time series prediction for occupancy and dynamic pricing.

**Features**:
- 7-day occupancy forecast using exponential smoothing
- Weekend/weekday demand patterns
- Confidence intervals
- Demand-based pricing recommendations

**Example**:
```javascript
const forecast = demandForecast.forecastOccupancy(reservations, rooms, 7);
const pricing = demandForecast.getDemandBasedPricing(room, forecast, competitors);
```

### 4. **riskAssessment.js**
Calculate risks and impacts of price changes.

**Features**:
- Risk level assessment (low/medium/high)
- Revenue impact projection
- Elasticity modeling
- Market deviation analysis
- Scenario comparison

**Example**:
```javascript
const risk = riskAssessment.assessPriceChangeRisk(room, newPrice, forecast, competitors);
// Returns: riskLevel, riskScore, impact, recommendation
```

### 5. **businessRules.js**
Common hotel pricing constraints and validation.

**Business Rules Implemented**:
1. **Minimum price floor** - Ensure cost coverage ($50 minimum)
2. **Maximum single change** - Prevent price shock (15% max change)
3. **Room type hierarchy** - Higher tiers must be 15% more expensive
4. **Weekend premium** - Friday/Saturday 10% above weekday
5. **Competitor parity** - Stay within 25% of market average
6. **Occupancy-based limits** - No increases when low occupancy, no decreases when high
7. **Rounding rules** - Prices end in .00 or .99
8. **Seasonal blackouts** - No decreases during high season

**Example**:
```javascript
const validation = businessRules.validatePriceChange(room, newPrice, {
  competitorAvg: 200,
  currentOccupancy: 0.75
});
// Returns: approved, finalPrice, violations, warnings
```

## API Endpoints

### GET `/api/pricing/analysis/:roomType`
Comprehensive pricing analysis for a specific room type.

**Response**:
```json
{
  "roomType": "Deluxe Room",
  "currentPrice": 219,
  "analysis": {
    "competitor": { "position": "value", "priceGap": -30, "recommendation": "..." },
    "demand": { "forecast": [...], "trend": "increasing", "pricing": {...} },
    "risk": { "riskLevel": "low", "impact": {...} },
    "validation": { "approved": true, "finalPrice": 234.99 },
    "scenarios": [...]
  },
  "recommendation": {
    "suggestedPrice": 234.99,
    "confidence": "high",
    "reasoning": ["...", "...", "..."]
  }
}
```

### GET `/api/pricing/forecast?days=7`
Get occupancy and demand forecast.

**Response**:
```json
{
  "currentOccupancy": "54.1%",
  "trend": "increasing",
  "forecasts": [
    {
      "date": "2025-12-18",
      "dayOfWeek": "Thu",
      "forecastOccupancy": 0.56,
      "estimatedRoomsBooked": 55,
      "confidence": "0.87",
      "recommendation": "Moderate demand - maintain rates"
    }
  ]
}
```

### GET `/api/pricing/market-position`
Get market positioning for all room types.

**Response**:
```json
{
  "positions": [
    {
      "roomType": "Standard Room",
      "currentPrice": 159,
      "position": "value",
      "marketAvg": 169,
      "priceGap": "-5.9%",
      "recommendation": "Slightly below market average..."
    }
  ],
  "marketShare": [...]
}
```

### POST `/api/pricing/validate`
Validate a proposed price change.

**Request**:
```json
{
  "roomType": "Deluxe",
  "newPrice": 250
}
```

**Response**:
```json
{
  "original": 219,
  "requested": 250,
  "approved": false,
  "final": 251.99,
  "validation": {
    "violations": ["Price change 14.2% exceeds 15% limit"],
    "recommendation": "Price adjusted to comply with business rules"
  },
  "risk": {
    "riskLevel": "medium",
    "impact": {...}
  }
}
```

## Testing

Test the comprehensive analysis:
```bash
curl http://localhost:4001/api/pricing/analysis/deluxe
```

Test demand forecast:
```bash
curl http://localhost:4001/api/pricing/forecast?days=7
```

Test market positioning:
```bash
curl http://localhost:4001/api/pricing/market-position
```

Test price validation:
```bash
curl -X POST http://localhost:4001/api/pricing/validate \
  -H "Content-Type: application/json" \
  -d '{"roomType": "Deluxe", "newPrice": 250}'
```

## Integration

All modules work together in the analysis endpoint:

1. **Competitor Analysis** → Determines market position
2. **Demand Forecast** → Predicts occupancy trends
3. **Risk Assessment** → Evaluates change impact
4. **Business Rules** → Validates and adjusts price
5. **Scenario Comparison** → Shows multiple options

This provides a complete, data-driven pricing recommendation with full explainability.
