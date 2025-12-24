#!/bin/bash
# Start the AI Copilot Frontend UI

echo "🎨 Starting AI Copilot Frontend..."
echo ""

# Navigate to UI directory
cd frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
    echo ""
fi

# Start the frontend
echo "Starting React development server..."
npm run dev
