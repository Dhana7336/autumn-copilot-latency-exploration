#!/bin/bash
# Start the AI Copilot Backend Server

echo "🚀 Starting AI Copilot Backend..."
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found"
    echo "   The server will run in fallback mode (rule-based logic)"
    echo ""
    echo "   To enable Claude AI:"
    echo "   1. Copy .env.example to .env"
    echo "   2. Add your ANTHROPIC_API_KEY"
    echo ""
fi

# Check if ANTHROPIC_API_KEY is set
if [ -f .env ]; then
    source .env
    if [ -z "$ANTHROPIC_API_KEY" ]; then
        echo "⚠️  ANTHROPIC_API_KEY not configured in .env"
        echo "   Running in fallback mode"
        echo ""
    else
        echo "✅ Claude AI enabled (API key configured)"
        echo "   Model: ${CLAUDE_MODEL:-claude-3-5-sonnet-20241022}"
        echo ""
    fi
fi

# Start the server
echo "Starting server on port ${PORT:-4001}..."
node backend/server.js
