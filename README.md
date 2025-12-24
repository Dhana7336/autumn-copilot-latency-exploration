# AI Hotel Revenue Copilot – Dynamic Pricing System

> Intelligent, human-in-the-loop revenue optimization for hotels using OpenAI

An AI-powered copilot that helps hotels dynamically adjust room prices based on demand patterns such as weekdays vs weekends, holidays, and room-type elasticity — with clear explanations, conversational approval, and real-time dashboard updates.

---

## Quick Start

### System Requirements

- Node.js 16+
- npm
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))

### Start the System

**Terminal 1 – Backend**

```bash
cd backend
npm install
node server.js
```

**Terminal 2 – Frontend**

```bash
cd frontend
npm install
npm run dev
```

### Open in Browser

| Page | URL |
|------|-----|
| Chat Interface | http://localhost:5173/chat |
| Pricing Dashboard | http://localhost:5173/dashboard |
| Calendar View | http://localhost:5173/calendar |

---

## What It Does

### Intelligent Dynamic Pricing

Hotels sell perishable inventory — an unsold room tonight is lost revenue forever. This system acts as an AI revenue manager that continuously recommends optimal pricing based on demand signals and applies changes only after explicit approval.

The AI identifies demand periods and suggests pricing actions accordingly:

| Demand Level | Premium | Triggers |
|--------------|---------|----------|
| Peak Demand | 20–30% | Major holidays (Christmas, New Year, Thanksgiving), large-scale events |
| High Demand | 10–20% | Weekends (Friday–Sunday), long weekends |
| Normal Demand | Base pricing | Weekdays (Monday–Thursday) |

### Weekday vs Weekend Strategy

| Period | Strategy | Target |
|--------|----------|--------|
| Weekdays | Lower, occupancy-driven pricing | Business travelers |
| Weekends | Higher, margin-driven pricing | Leisure demand |

---

## Try It Now

### Example 1: Weekend Pricing

**Type in chat:**
```
suggest weekend pricing strategy
```

**AI Response:**
```
Standard Room:
- Weekday (Mon–Thu): $155
- Weekend (Fri–Sun): $185
- Current Rate: $165
```

**Approve:**
```
yes
```

**Result:**
- Pricing is applied immediately
- Dashboard updates automatically

### Example 2: All Room Types

**Type:**
```
I want pricing recommendations for all rooms showing weekday and weekend rates
```

**Result:**
- AI returns structured weekday/weekend pricing
- All room categories are shown side by side

### Example 3: Holiday Pricing

**Type:**
```
what should I do for Christmas week?
```

**AI Recommendation:**
- 20–30% holiday premium
- Optional bundles and minimum-stay guidance

---

## Conversational Approval

Pricing changes are applied only after explicit human approval.

**Accepted approval phrases:**

| Phrase | Alternative |
|--------|-------------|
| `yes` | `approve` |
| `ok` | `go ahead` |
| `apply` | `proceed` |
| `confirm` | `do it` |

No buttons required — fully conversational.

---

## Revenue Impact (Typical)

| Strategy | Revenue Lift |
|----------|--------------|
| Weekend pricing | ~14% |
| Holiday pricing | ~25% |
| Full dynamic pricing adoption | ~20% monthly |

*Figures are representative of common hospitality pricing patterns.*

---

## Configuration

### OpenAI API Key (Required)

Create or edit `/backend/.env`:

```env
OPENAI_API_KEY=your-key-here
OPENAI_MODEL=gpt-4-turbo
PORT=4001
```

### Security Notes

- Do not commit `.env` files
- Ensure `.env` is included in `.gitignore`
- Rotate API keys regularly in production

---

## Troubleshooting

### AI not giving strategic recommendations?

1. Confirm `OPENAI_API_KEY` is valid
2. Restart the backend server

### Dashboard not updating?

1. Refresh once after backend restart
2. Auto-refresh resumes automatically (every 10 seconds)

---

## Features

- [x] Weekday vs weekend pricing split
- [x] Holiday and event surge pricing
- [x] Room-type–specific strategies
- [x] Competitive positioning logic
- [x] Conversational approval workflow
- [x] Real-time dashboard auto-refresh
- [x] Pricing audit trail
- [x] Agentic flow with live data access
- [x] Duration-aware temporary pricing (2 weeks, 1 month, etc.)

---

## Project Structure

```
ai-copilot/
├── backend/
│   ├── server.js              # Express server entry point
│   ├── routes/
│   │   └── copilot.js         # Main copilot API routes
│   ├── services/
│   │   ├── dataLoader.js      # CSV data loading
│   │   └── llmService.js      # OpenAI integration
│   ├── utils/
│   │   ├── actionProposal.js  # Intent detection & proposals
│   │   ├── approvalFlow.js    # Approval workflow
│   │   └── revenueCalculations.js
│   └── data/csv/              # Hotel data files
│       ├── rooms.csv
│       ├── competitors.csv
│       └── Lily Hall Reservations.csv
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # React router
│   │   ├── pages/
│   │   │   ├── Chat.jsx       # AI copilot interface
│   │   │   ├── Dashboard.jsx  # Pricing dashboard
│   │   │   └── Calendar.jsx   # Calendar view
│   │   └── components/
│   └── package.json
└── README.md
```

---

## Notes

This project demonstrates:

- Real-world revenue management concepts
- Human-in-the-loop AI decision making
- Production-safe OpenAI integration
- Clear separation of UI, backend, and AI logic

**Start maximizing hotel revenue with explainable, controlled AI pricing.**
