#!/bin/bash

# Portfolio Analyzer - Development Server Script
# Starts the development server with hot-reload and additional development features

set -e

echo "🚀 Starting Portfolio Analyzer development server..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Ensure Poetry-managed virtualenv exists in project
if [ ! -d ".venv" ]; then
    print_warning ".venv not found. Run './scripts/setup.sh' first."
    exit 1
fi

# Set development environment variables
export PYTHONPATH="${PYTHONPATH:+$PYTHONPATH:}$(pwd)"
export DEBUG=True
export LOG_LEVEL=DEBUG

# Check if .env file exists and source it
if [ -f ".env" ]; then
    print_info "Loading environment variables from .env"
    export $(cat .env | grep -v '^#' | xargs)
fi

# Get port from environment or use default
PORT=${PORT:-8000}

print_info "Starting development server on port $PORT..."
print_info "Server will auto-reload when files change"
print_info "API docs available at: http://localhost:$PORT/docs"
print_info "Application available at: http://localhost:$PORT"
print_info ""
print_info "Press Ctrl+C to stop the server"
print_info ""

# Start the development server with hot-reload
POETRY_VIRTUALENVS_IN_PROJECT=1 poetry run python app/main.py
