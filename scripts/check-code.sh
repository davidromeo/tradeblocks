#!/bin/bash

# TradeBlocks Code Quality Check Script
# Simple, practical code checks

set -e

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

echo "🧱 TradeBlocks - Quick Code Check"
echo "================================="

# Ensure uv exists and environment is synced
if ! command -v uv &> /dev/null; then
    print_error "uv not found. Install it from https://github.com/astral-sh/uv and rerun."
    exit 1
fi

if [ ! -d ".venv" ]; then
    print_error ".venv not found. Run './scripts/setup.sh' first."
    exit 1
fi

# 1. Import check (essential)
echo "🔍 Checking imports..."
if uv run python -c "from app.main import app; print('App imports successfully')" 2>/dev/null; then
    print_success "Imports working"
else
    print_error "Import errors found!"
    uv run python -c "from app.main import app"
    exit 1
fi

# 2. Basic syntax check (essential)
echo "🔧 Checking syntax..."
if uv run python -m py_compile app/main.py 2>/dev/null; then
    print_success "Main syntax OK"
else
    print_error "Syntax errors in main.py"
    exit 1
fi

# 3. Code formatting (advisory only)
if uv run black --version &> /dev/null; then
    echo "🎨 Checking formatting..."
    if uv run black --check app/ -q 2>/dev/null; then
        print_success "Code formatted"
    else
        print_warning "Code formatting could be improved (run: black app/)"
    fi
fi

print_success "TradeBlocks ready to go! 🚀"
