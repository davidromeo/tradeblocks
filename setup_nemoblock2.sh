#!/bin/bash
set -e

# Go to parent directory
cd ..

if [ -d "Nemoblock2" ]; then
    echo "Directory Nemoblock2 already exists. Skipping clone."
    cd Nemoblock2
else
    echo "Cloning Nemoblock2..."
    git clone https://github.com/jeevansaims/Nemoblock2.git
    cd Nemoblock2
fi

echo "--- Fixing Origin Remote (Auth) ---"
git remote set-url origin https://jeevansaims@github.com/jeevansaims/Nemoblock2.git

echo "--- Configuring Remotes ---"
# Remove if exists to avoid error
git remote remove upstream 2>/dev/null || true
git remote remove nemo 2>/dev/null || true

git remote add upstream https://github.com/davidromeo/tradeblocks.git
# Use local path to ensure we get the latest unpushed/pushed changes from THIS machine
git remote add nemo ../Nemoblock

echo "--- Fetching Remotes ---"
git fetch upstream
git fetch nemo

echo "--- Syncing Main with Upstream ---"
# Ensure we are on main
git checkout -B main
# Hard reset to upstream
git reset --hard upstream/master
# echo "--- Pushing Main ---"
# git push origin main --force || echo "⚠️ Push failed (Auth). Proceeding locally..."

echo "--- Creating Feature Branch ---"
git checkout -B feature/pl-calendar main

echo "--- Porting P/L Calendar Files ---"
# Checkout specific files from the OLD repo remote
# Use directory for components to catch all files (YearViewBlock, etc.)
git checkout nemo/feature/avg-pl-and-withdrawals -- \
  "app/(platform)/pl-calendar/page.tsx" \
  "components/pl-calendar" \
  "lib/utils/trading-day.ts" \
  "lib/settings/pl-calendar-settings.ts" \
  "lib/calculations/portfolio-stats.ts" \
  "lib/models/portfolio-stats.ts"

# Apply patches to ALL files in components/pl-calendar
echo "Applying patches to components/pl-calendar..."
find components/pl-calendar -name "*.tsx" -exec sed -i '' 's/trade.dayKey/(trade as any).dayKey/g' {} +
find components/pl-calendar -name "*.tsx" -exec sed -i '' 's/\([^a-zA-Z]\)t\.drawdownPct/\1(t as any).drawdownPct/g' {} +
find components/pl-calendar -name "*.tsx" -exec sed -i '' 's/\([^a-zA-Z]\)t\.fundsAtClose/\1(t as any).fundsAtClose/g' {} +

echo "Files ported:"
git status --short

echo "--- Installing Dependencies ---"
# Check if pnpm is available, else npm
if command -v pnpm &> /dev/null; then
    pnpm install
    pnpm add date-fns-tz react-day-picker
    pnpm add -D @types/plotly.js
else
    npm install
    npm install date-fns-tz react-day-picker
    npm install --save-dev @types/plotly.js
fi

echo "--- Building ---"
# Run build
if command -v pnpm &> /dev/null; then
    pnpm run build
else
    npm run build
fi

echo "--- Committing Feature ---"
git add .
git commit -m "feat: port PL Calendar logic from NemoBlocks" || echo "Nothing to commit"

# echo "--- Pushing Feature Branch ---"
# git push origin feature/pl-calendar --force || echo "⚠️ Push failed (Auth). Proceeding locally..."

echo "✅ Setup Complete!"
echo "If pushes failed, run manually:"
echo "cd Nemoblock2"
echo "git push origin main --force"
echo "git push origin feature/pl-calendar --force"
