---
phase: 14-multi-platform-agent-skills
plan: "04"
subsystem: npm-packaging
tags: [npm, packaging, installer, skills]

requires:
  - phase: 14-03
    provides: Skills documentation (README, INSTALL, install.sh)
provides:
  - Skill manifest (index.json)
  - Package.json skill bundling
  - Skill installer module for Phase 15 CLI
affects: [phase-15-polish]

tech-stack:
  added: []
  patterns:
    - Copy-on-build for skill bundling
    - Multi-entry tsup configuration
    - Cross-platform skill installation

key-files:
  created:
    - packages/agent-skills/index.json
    - packages/agent-skills/.gitignore
    - packages/mcp-server/src/skill-installer.ts
  modified:
    - packages/mcp-server/package.json
    - packages/mcp-server/.gitignore
    - packages/mcp-server/tsup.config.ts
    - .planning/STATE.md
    - .planning/ROADMAP.md

key-decisions:
  - "Copy skills during build (not symlink) for npm portability"
  - "Bundle skills with MCP server (not separate package) for simplicity"
  - "Multi-entry tsup config: index.ts (executable) + skill-installer.ts (library)"

patterns-established:
  - "Skill manifest (index.json) for programmatic skill listing"
  - "Skill installer API: install/uninstall/check functions"

issues-created: []

duration: 8min
completed: 2026-01-16
---

# Phase 14-04: npm Packaging Preparation Summary

**Prepared agent skills for npm distribution and created installer module for Phase 15 CLI**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-16
- **Tasks:** 3
- **Files created:** 3
- **Files modified:** 3

## Accomplishments

1. **Skill Portability Audit**
   - Verified all SKILL.md and reference files have no hardcoded absolute paths
   - Paths in documentation files (INSTALL.md, README.md) are expected (they explain installation)
   - Created index.json manifest listing all 6 skills and platform paths
   - Added .gitignore to prevent platform-specific files (.DS_Store, etc.)

2. **Package.json Updates for Skill Bundling**
   - Added `agent-skills` to `files` array for npm publish inclusion
   - Added `copy-skills` build step to copy skills from sibling package during build
   - Updated .gitignore to exclude copied agent-skills directory (build artifact)

3. **Skill Installer Module**
   - Created skill-installer.ts with full API for Phase 15 CLI
   - Functions: installSkills, uninstallSkills, checkInstallation, listAvailableSkills
   - Support for force reinstall option
   - Cross-platform path handling with proper ESM imports (fileURLToPath)
   - Updated tsup.config.ts for multi-entry build (index.ts + skill-installer.ts)

## Files Created

- `packages/agent-skills/index.json` - Manifest listing skills and platform paths
- `packages/agent-skills/.gitignore` - Prevent platform-specific files
- `packages/mcp-server/src/skill-installer.ts` - Programmatic skill installation API

## Files Modified

- `packages/mcp-server/package.json` - Added files array, copy-skills script
- `packages/mcp-server/.gitignore` - Exclude copied agent-skills/
- `packages/mcp-server/tsup.config.ts` - Multi-entry build configuration

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Copy skills during build | npm packages cannot contain symlinks; copying ensures portability |
| Bundle with MCP server | Simpler distribution; can split later if skills grow large |
| Skill installer as library | Phase 15 CLI will import and use these functions |
| Force option for reinstall | Allows overwriting existing skills when updates available |

## API Reference

```typescript
// Platform types
type Platform = "claude" | "codex" | "gemini"

// Install skills to platform
installSkills(platform: Platform, { force?: boolean }): Promise<InstallResult>

// Uninstall skills from platform
uninstallSkills(platform: Platform): Promise<string[]>

// Check installation status
checkInstallation(platform: Platform): Promise<{ installed: string[], missing: string[] }>

// List available skills
listAvailableSkills(): Promise<string[]>
```

## Commit Summary

| Commit | Type | Description |
|--------|------|-------------|
| bbc907e | feat | Add skill manifest and portability safeguards |
| 6c0af2f | feat | Bundle agent-skills with MCP server npm package |
| ed867ae | feat | Create skill installer module for Phase 15 CLI |

## Phase 14 Complete

All 4 plans completed:
- 14-01: Core analysis skills (health-check, wfa, risk)
- 14-02: Comparison and portfolio skills (compare, portfolio, optimize)
- 14-03: Documentation and installation scripts
- 14-04: npm packaging preparation

Ready for Phase 15: Polish and Documentation.
