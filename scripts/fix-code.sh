#!/bin/bash

# TradeBlocks Code Auto-Fix Script
# Simple code formatting

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

echo "🧱 TradeBlocks - Quick Code Fix"
echo "==============================="

# Ensure uv exists and environment is synced
if ! command -v uv &> /dev/null; then
    print_error "uv not found. Install it from https://github.com/astral-sh/uv and rerun."
    exit 1
fi

if [ ! -d ".venv" ]; then
    print_error ".venv not found. Run './scripts/setup.sh' first."
    exit 1
fi

# 1. Format code with Black (if available)
if uv run black --version &> /dev/null; then
    echo "🎨 Formatting code..."
    if uv run black app/ -q; then
        print_success "Code formatted"
    else
        print_warning "Formatting had issues"
    fi
else
    print_warning "Black not installed (optional)"
fi

# 2. Sort imports (if available)
if uv run isort --version &> /dev/null; then
    echo "📚 Sorting imports..."
    if uv run isort app/ -q; then
        print_success "Imports sorted"
    else
        print_warning "Import sorting had issues"
    fi
fi

print_success "TradeBlocks code tidied up! 🚀"
echo "Run './scripts/check-code.sh' to verify"
