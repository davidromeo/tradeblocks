# Sync Upstream Checklist (TradeBlocks → NemoBlocks)

Follow this routine to pull latest changes from David's repo without breaking Nemo-specific features.

**Remotes:**
*   `origin` -> `jeevansaiias/Nemoblock` (Your Repo)
*   `upstream` -> `davidromeo/tradeblocks` (David's Repo)

## 🔄 Routine Sync (Main Branch)

1.  **Clean your tree**: Ensure `git status` is clean. Stash or commit if needed.
2.  **Fetch Upstream**:
    ```bash
    git fetch upstream
    ```
3.  **Update Tracking Branch** (Mirror of upstream main):
    ```bash
    git checkout -B upstream-main upstream/main
    ```
4.  **Merge into Nemo Main**:
    ```bash
    git checkout main
    git merge upstream-main
    # Resolve conflicts if any (keep Nemo behavior)
    git push origin main
    ```

## 🌲 Update Feature Branches

For each active feature branch (e.g., `feature/pl-calendar-tail-risk`, `feature/withdrawal-sim`):

```bash
git checkout feature/your-feature-name
git merge main
# Resolve conflicts in context of your feature
git push origin feature/your-feature-name
```

## 📦 Porting Specific Upstream Features

When David adds a localized feature (e.g., `feature/custom-report-builder`) that you want to import *without* merging his entire branch:

1.  **Create a local feature branch**:
    ```bash
    git checkout main
    git checkout -b feature/custom-report-builder-nemo
    ```
2.  **Copy files by path**:
    ```bash
    git checkout upstream/feature/custom-report-builder -- \
      app/(platform)/report-builder \
      components/report-builder \
      lib/calculations/report-logic.ts
      # Add other specific paths
    ```
3.  **Verify & Commit**:
    ```bash
    git status
    npm install
    npm run build
    git add .
    git commit -m "feat: port Report Builder from upstream"
    git push origin feature/custom-report-builder-nemo
    ```
