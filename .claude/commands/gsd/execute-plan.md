---
name: gsd:execute-plan
description: Execute a PLAN.md file
argument-hint: "[path-to-PLAN.md]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Task
  - AskUserQuestion
  - SlashCommand
---

<objective>
Execute a PLAN.md file with per-task atomic commits, create SUMMARY.md, update project state.

Commit strategy:
- Each task → 1 commit immediately after completion (feat/fix/test/refactor)
- Plan completion → 1 metadata commit (docs: SUMMARY + STATE + ROADMAP)

Uses intelligent segmentation:
- Plans without checkpoints → spawn subagent for full autonomous execution
- Plans with verify checkpoints → segment execution, pause at checkpoints
- Plans with decision checkpoints → execute in main context
  </objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-phase.md
@./.claude/get-shit-done/templates/summary.md
@./.claude/get-shit-done/references/checkpoints.md
@./.claude/get-shit-done/references/tdd.md
</execution_context>

<context>
Plan path: $ARGUMENTS

**Load project state first:**
@.planning/STATE.md

**Load workflow config:**
@.planning/config.json
</context>

<process>
1. Check .planning/ directory exists (error if not - user should run /gsd:new-project)
2. Verify plan at $ARGUMENTS exists
3. Check if SUMMARY.md already exists (plan already executed?)
4. Load workflow config for mode (interactive/yolo)
5. Follow execute-phase.md workflow:
   - Parse plan and determine execution strategy (A/B/C)
   - Execute tasks (via subagent or main context as appropriate)
   - Handle checkpoints and deviations
   - Create SUMMARY.md
   - Update STATE.md
   - Commit changes
</process>

<execution_strategies>
**Strategy A: Fully Autonomous** (no checkpoints)

- Spawn subagent to execute entire plan
- Subagent creates SUMMARY.md and commits
- Main context: orchestration only (~5% usage)

**Strategy B: Segmented** (has verify-only checkpoints)

- Execute in segments between checkpoints
- Subagent for autonomous segments
- Main context for checkpoints
- Aggregate results → SUMMARY → commit

**Strategy C: Decision-Dependent** (has decision checkpoints)

- Execute in main context
- Decision outcomes affect subsequent tasks
- Quality maintained through small scope (2-3 tasks per plan)
  </execution_strategies>

<deviation_rules>
During execution, handle discoveries automatically:

1. **Auto-fix bugs** - Fix immediately, document in Summary
2. **Auto-add critical** - Security/correctness gaps, add and document
3. **Auto-fix blockers** - Can't proceed without fix, do it and document
4. **Ask about architectural** - Major structural changes, stop and ask user
5. **Log enhancements** - Nice-to-haves, log to ISSUES.md, continue

Only rule 4 requires user intervention.
</deviation_rules>

<commit_rules>
**Per-Task Commits:**

After each task completes:
1. Stage only files modified by that task
2. Commit with format: `{type}({phase}-{plan}): {task-name}`
3. Types: feat, fix, test, refactor, perf, chore
4. Record commit hash for SUMMARY.md

**Plan Metadata Commit:**

After all tasks complete:
1. Stage planning artifacts only: PLAN.md, SUMMARY.md, STATE.md, ROADMAP.md
2. Commit with format: `docs({phase}-{plan}): complete [plan-name] plan`
3. NO code files (already committed per-task)

**NEVER use:**
- `git add .`
- `git add -A`
- `git add src/` or any broad directory

**Always stage files individually.**

See ./.claude/get-shit-done/references/git-integration.md for full commit strategy.
</commit_rules>

<success_criteria>

- [ ] All tasks executed
- [ ] Each task committed individually (feat/fix/test/refactor)
- [ ] SUMMARY.md created with substantive content and commit hashes
- [ ] STATE.md updated (position, decisions, issues, session)
- [ ] ROADMAP updated (plan count, phase status)
- [ ] Metadata committed with docs({phase}-{plan}): complete [plan-name] plan
- [ ] User informed of next steps
      </success_criteria>
