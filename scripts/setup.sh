#!/bin/bash

# Portfolio Analyzer - One-Command Setup Script
# This script sets up the development environment

set -e  # Exit on any error

echo "🚀 Setting up Portfolio Analyzer development environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Ensure uv is installed
print_status "Checking for uv package manager..."
if ! command -v uv &> /dev/null; then
    print_error "uv is not installed. Install it from https://github.com/astral-sh/uv and rerun."
    exit 1
fi
print_success "uv detected"

# Ensure Python runtime is available via uv
TARGET_PYTHON="3.12"
print_status "Ensuring Python ${TARGET_PYTHON} is available..."
if uv python find "${TARGET_PYTHON}" &> /dev/null; then
    print_success "Python ${TARGET_PYTHON} already available"
else
    print_status "Installing Python ${TARGET_PYTHON} via uv (first run only)..."
    uv python install "${TARGET_PYTHON}"
fi

# Synchronize dependencies (creates .venv by default)
print_status "Syncing project dependencies (including dev tools)..."
uv sync --python "${TARGET_PYTHON}" --extra dev --frozen
print_success "Dependencies installed into .venv"

# Setup pre-commit hooks if .pre-commit-config.yaml exists
if [ -f ".pre-commit-config.yaml" ]; then
    print_status "Installing pre-commit hooks..."
    uv run --python "${TARGET_PYTHON}" --frozen pre-commit install
    print_success "Pre-commit hooks installed"
else
    print_warning "No pre-commit configuration found, skipping pre-commit setup"
fi

# Create .env file from template if it doesn't exist
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    print_status "Creating .env file from template..."
    cp .env.example .env
    print_success ".env file created"
    print_warning "Please review and update .env file with your settings"
else
    print_status ".env file already exists or no template found"
fi

# Setup complete, ready to develop!

print_success "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Activate virtual environment: source .venv/bin/activate"
echo "     (or use 'uv run <command>' without activating)"
echo "  2. Start development server: ./scripts/start-dev.sh"
echo "  3. Open browser: http://localhost:8000"
echo ""
echo "Available scripts:"
echo "  ./scripts/start-dev.sh  - Start development server"
echo "  ./scripts/seed-data.sh  - Load sample data"
echo "  pytest                  - Run tests"
echo "  black app tests         - Format code"
echo "  ruff check app tests    - Check code quality"
echo ""
echo "Happy coding! 🚀"
