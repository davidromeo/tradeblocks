# Upstream Contribution Checklist (NemoBlocks → TradeBlocks)

0. **Decide the scope**
   - Pick one feature/fix to upstream (e.g., “P/L Calendar date-range filter”, “Report Builder tweaks”).
   - Make sure the change doesn’t include Nemo-only stuff (branding, extra pages, custom analytics, etc.).

---

1. **Prep local repos and remotes**

In `NemoBlocks`:
```
cd /Users/nemotaka/Nemoblock
git checkout feature/avg-pl-and-withdrawals
git pull
```

Confirm remotes:
```
git remote -v
# origin   -> jeevansaiias/NemoBlocks
# upstream -> davidromeo/tradeblocks
```

---

2. **Create a clean upstream branch**
```
git fetch upstream
git checkout -B pl-calendar-upstream upstream/feature/pl-calendar
# adjust branch names if targeting a different upstream branch
```

---

3. **Copy only the relevant files from NemoBlocks**

Example for P/L Calendar:
```
git checkout feature/avg-pl-and-withdrawals -- \
  app/(platform)/pl-calendar/page.tsx \
  components/pl-calendar/
```

Then:
```
git status
git diff
```
Keep only the intended files (feature code). If something unrelated shows up, drop it:
```
git restore --staged path/to/unwanted-file
git restore path/to/unwanted-file
```

---

4. **Run checks in the upstream context**
```
npm install          # first time or when deps changed
npm run lint
npm run build
```
Fix type/import errors inside the feature files; avoid changing upstream tooling unless necessary.

---

5. **Commit with a clear message**
```
git add app/(platform)/pl-calendar/page.tsx components/pl-calendar/*
# plus any other intentional files
git commit -m "feat: add date-range filter to P/L Calendar"  # example
```

---

6. **Push to the upstream branch**
```
git push upstream pl-calendar-upstream:feature/pl-calendar
# adjust names for other features
```

---

7. **Tell Romeo (when ready)**
Send a note like:
> Updated feature/<branch> with <feature description>. `npm run build` passes locally. Ready for review when you have time.

Open a PR to upstream/main only when he’s ready.

---

8. **Sync back into NemoBlocks (optional)**
After upstream merges/updates:
```
cd /Users/nemotaka/Nemoblock
git checkout feature/avg-pl-and-withdrawals
git fetch upstream
git merge upstream/feature/pl-calendar   # or upstream/main once merged
git push origin feature/avg-pl-and-withdrawals
```

---

### Rules of thumb
- Never merge NemoBlocks branches directly into David’s repo.
- Always copy by path into a clean upstream-based branch.
- Keep contributions small and focused (one feature per branch).
- Always run `npm run build` in the upstream branch before pushing.
