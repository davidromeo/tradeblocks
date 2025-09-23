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

# Ensure Poetry is installed
print_status "Checking for Poetry..."
if ! command -v poetry &> /dev/null; then
    print_error "Poetry is not installed. See https://python-poetry.org/docs/#installation"
    exit 1
fi
print_success "Poetry detected"

# Install project dependencies using Poetry (create .venv in project)
print_status "Installing project dependencies via Poetry..."
POETRY_VIRTUALENVS_IN_PROJECT=1 poetry install --with dev
print_success "Dependencies installed"

# Setup pre-commit hooks if .pre-commit-config.yaml exists
# Install pre-commit hooks within Poetry environment
if [ -f ".pre-commit-config.yaml" ]; then
    print_status "Installing pre-commit hooks..."
    POETRY_VIRTUALENVS_IN_PROJECT=1 poetry run pre-commit install
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

# Check if Docker is installed
if command -v docker &> /dev/null; then
    print_success "Docker is installed"
    if command -v docker-compose &> /dev/null; then
        print_success "Docker Compose is installed"
    else
        print_warning "Docker Compose not found. Install it for container development."
    fi
else
    print_warning "Docker not found. Install Docker for container development."
fi

# Setup complete, ready to develop!

print_success "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Activate virtual environment: source venv/bin/activate"
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
