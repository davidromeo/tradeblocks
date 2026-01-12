<decimal_phase_numbering>
Decimal phases enable urgent work insertion without renumbering:

- Integer phases (1, 2, 3) = planned milestone work
- Decimal phases (2.1, 2.2) = urgent insertions between integers

**Rules:**
- Decimals between consecutive integers (2.1 between 2 and 3)
- Filesystem sorting works automatically (2 < 2.1 < 2.2 < 3)
- Directory format: `02.1-description/`, Plan format: `02.1-01-PLAN.md`

**Validation:** Integer X must exist and be complete, X+1 must exist, decimal X.Y must not exist, Y >= 1
</decimal_phase_numbering>

<required_reading>
**Read these files NOW:**

1. ./.claude/get-shit-done/templates/phase-prompt.md
2. ./.claude/get-shit-done/references/plan-format.md
3. ./.claude/get-shit-done/references/scope-estimation.md
4. ./.claude/get-shit-done/references/checkpoints.md
5. ./.claude/get-shit-done/references/tdd.md
6. .planning/ROADMAP.md
7. .planning/PROJECT.md

**Load domain expertise from ROADMAP:**
- Parse ROADMAP.md's `## Domain Expertise` section for paths
- Read each domain SKILL.md (these serve as indexes)
- Determine phase type and load ONLY references relevant to THIS phase type from each SKILL.md's `<references_index>`
</required_reading>

<purpose>
Create an executable phase prompt (PLAN.md). PLAN.md IS the prompt that Claude executes - not a document that gets transformed.
</purpose>

<planning_principles>
**Secure by design:** Assume hostile input on every boundary. Validate, parameterize, authenticate, fail closed.

**Performance by design:** Assume production load, not demo conditions. Plan for efficient data access, appropriate caching, minimal round trips.

**Observable by design:** Plan to debug your own work. Include meaningful error messages, appropriate logging, and clear failure states.
</planning_principles>

<process>

<step name="load_project_state" priority="first">
Read `.planning/STATE.md` and parse:
- Current position (which phase we're planning)
- Accumulated decisions (constraints on this phase)
- Deferred issues (candidates for inclusion)
- Blockers/concerns (things this phase may address)
- Brief alignment status

If STATE.md missing but .planning/ exists, offer to reconstruct or continue without.
</step>

<step name="load_codebase_context">
Check for codebase map:

```bash
ls .planning/codebase/*.md 2>/dev/null
```

**If .planning/codebase/ exists:** Load relevant documents based on phase type:

| Phase Keywords | Load These |
|----------------|------------|
| UI, frontend, components | CONVENTIONS.md, STRUCTURE.md |
| API, backend, endpoints | ARCHITECTURE.md, CONVENTIONS.md |
| database, schema, models | ARCHITECTURE.md, STACK.md |
| testing, tests | TESTING.md, CONVENTIONS.md |
| integration, external API | INTEGRATIONS.md, STACK.md |
| refactor, cleanup | CONCERNS.md, ARCHITECTURE.md |
| setup, config | STACK.md, STRUCTURE.md |
| (default) | STACK.md, ARCHITECTURE.md |

Track extracted constraints for PLAN.md context section.
</step>

<step name="identify_phase">
Check roadmap and existing phases:

```bash
cat .planning/ROADMAP.md
ls .planning/phases/
```

If multiple phases available, ask which one to plan. If obvious (first incomplete phase), proceed.

**Phase number parsing:** Regex `^(\d+)(?:\.(\d+))?$` - Group 1: integer, Group 2: decimal (optional)

**If decimal phase:** Validate integer X exists and is complete, X+1 exists in roadmap, decimal X.Y doesn't exist, Y >= 1.

Read any existing PLAN.md or DISCOVERY.md in the phase directory.
</step>

<step name="mandatory_discovery">
**Discovery is MANDATORY unless you can prove current context exists.**

<discovery_decision>
**Level 0 - Skip** (pure internal work, existing patterns only)
- ALL work follows established codebase patterns (grep confirms)
- No new external dependencies
- Pure internal refactoring or feature extension
- Examples: Add delete button, add field to model, create CRUD endpoint

**Level 1 - Quick Verification** (2-5 min)
- Single known library, confirming syntax/version
- Low-risk decision (easily changed later)
- Action: Context7 resolve-library-id + query-docs, no DISCOVERY.md needed

**Level 2 - Standard Research** (15-30 min)
- Choosing between 2-3 options
- New external integration (API, service)
- Medium-risk decision
- Action: Route to workflows/discovery-phase.md depth=standard, produces DISCOVERY.md

**Level 3 - Deep Dive** (1+ hour)
- Architectural decision with long-term impact
- Novel problem without clear patterns
- High-risk, hard to change later
- Action: Route to workflows/discovery-phase.md depth=deep, full DISCOVERY.md

**Depth indicators:**
- Level 2+: New library not in package.json, external API, "choose/select/evaluate" in description, roadmap marked Research: Yes
- Level 3: "architecture/design/system", multiple external services, data modeling, auth design, real-time/distributed
</discovery_decision>

If roadmap flagged `Research: Likely`, Level 0 (skip) is not available.

For niche domains (3D, games, audio, shaders, ML), suggest `/gsd:research-phase` before plan-phase.
</step>

<step name="read_project_history">
**Intelligent context assembly from frontmatter dependency graph:**

**1. Scan all summary frontmatter (cheap - first ~25 lines):**

```bash
for f in .planning/phases/*/*-SUMMARY.md; do
  # Extract frontmatter only (between first two --- markers)
  sed -n '1,/^---$/p; /^---$/q' "$f" | head -30
done
```

Parse YAML to extract: phase, subsystem, requires, provides, affects, tags, key-decisions, key-files

**2. Build dependency graph for current phase:**

- **Check affects field:** Which prior phases have current phase in their `affects` list? → Direct dependencies
- **Check subsystem:** Which prior phases share same subsystem? → Related work
- **Check requires chains:** If phase X requires phase Y, and we need X, we also need Y → Transitive dependencies
- **Check roadmap:** Any phases marked as dependencies in ROADMAP.md phase description?

**3. Select relevant summaries:**

Auto-select phases that match ANY of:
- Current phase name/number appears in prior phase's `affects` field
- Same `subsystem` value
- In `requires` chain (transitive closure)
- Explicitly mentioned in STATE.md decisions as affecting current phase

Typical selection: 2-4 prior phases (immediately prior + related subsystem work)

**4. Extract context from frontmatter (WITHOUT opening full summaries yet):**

From selected phases' frontmatter, extract:
- **Tech available:** Union of all tech-stack.added lists
- **Patterns established:** Union of all tech-stack.patterns and patterns-established
- **Key files:** Union of all key-files (for @context references)
- **Decisions:** Extract key-decisions from frontmatter

**5. Now read FULL summaries for selected phases:**

Only now open and read complete SUMMARY.md files for the selected relevant phases. Extract:
- Detailed "Accomplishments" section
- "Next Phase Readiness" warnings/blockers
- "Issues Encountered" that might affect current phase
- "Deviations from Plan" for patterns

**From STATE.md:** Decisions → constrain approach. Deferred issues → candidates. Blockers → may need to address.

**From ISSUES.md:**

```bash
cat .planning/ISSUES.md 2>/dev/null
```

Assess each open issue - relevant to this phase? Waiting long enough? Natural to address now? Blocking something?

**Answer before proceeding:**
- Q1: What decisions from previous phases constrain this phase?
- Q2: Are there deferred issues that should become tasks?
- Q3: Are there concerns from "Next Phase Readiness" that apply?
- Q4: Given all context, does the roadmap's description still make sense?

**Track for PLAN.md context section:**
- Which summaries were selected (for @context references)
- Tech stack available (from frontmatter)
- Established patterns (from frontmatter)
- Key files to reference (from frontmatter)
- Applicable decisions (from frontmatter + full summary)
- Issues being addressed (from ISSUES.md)
- Concerns being verified (from "Next Phase Readiness")
</step>

<step name="gather_phase_context">
Understand:
- Phase goal (from roadmap)
- What exists already (scan codebase if mid-project)
- Dependencies met (previous phases complete?)
- Any {phase}-RESEARCH.md (from /gsd:research-phase)
- Any DISCOVERY.md (from mandatory discovery)
- Any {phase}-CONTEXT.md (from /gsd:discuss-phase)

```bash
# If mid-project, understand current state
ls -la src/ 2>/dev/null
cat package.json 2>/dev/null | head -20

# Check for ecosystem research (from /gsd:research-phase)
cat .planning/phases/XX-name/${PHASE}-RESEARCH.md 2>/dev/null

# Check for phase context (from /gsd:discuss-phase)
cat .planning/phases/XX-name/${PHASE}-CONTEXT.md 2>/dev/null
```

**If RESEARCH.md exists:** Use standard_stack (these libraries), architecture_patterns (follow in task structure), dont_hand_roll (NEVER custom solutions for listed problems), common_pitfalls (inform verification), code_examples (reference in actions).

**If CONTEXT.md exists:** Honor vision, prioritize essential, respect boundaries, incorporate specifics.

**If neither exist:** Suggest /gsd:research-phase for niche domains, /gsd:discuss-phase for simpler domains, or proceed with roadmap only.
</step>

<step name="break_into_tasks">
Decompose phase into tasks and identify TDD candidates.

**Standard tasks need:**
- **Type**: auto, checkpoint:human-verify, checkpoint:decision (human-action rarely needed)
- **Task name**: Clear, action-oriented
- **Files**: Which files created/modified (for auto tasks)
- **Action**: Specific implementation (including what to avoid and WHY)
- **Verify**: How to prove it worked
- **Done**: Acceptance criteria

**TDD detection:** For each potential task, evaluate TDD fit:

TDD candidates (create dedicated TDD plans):
- Business logic with defined inputs/outputs
- API endpoints with request/response contracts
- Data transformations, parsing, formatting
- Validation rules and constraints
- Algorithms with testable behavior
- State machines and workflows

Standard tasks (remain in standard plans):
- UI layout, styling, visual components
- Configuration changes
- Glue code connecting existing components
- One-off scripts and migrations
- Simple CRUD with no business logic

**Heuristic:** Can you write `expect(fn(input)).toBe(output)` before writing `fn`?
→ Yes: Create a dedicated TDD plan for this feature (one feature per TDD plan)
→ No: Standard task in standard plan

**Why TDD gets its own plan:** TDD requires 2-3 execution cycles (RED → GREEN → REFACTOR), each with file reads, test runs, and potential debugging. Embedded in a multi-task plan, TDD work consumes 50-60% of context alone, degrading quality for remaining tasks.

**Test framework:** If project has no test setup and TDD plans are needed, the first TDD plan's RED phase handles framework setup as part of writing the first test.

See `./.claude/get-shit-done/references/tdd.md` for TDD plan structure.

**Checkpoints:** Visual/functional verification → checkpoint:human-verify. Implementation choices → checkpoint:decision. Manual action (email, 2FA) → checkpoint:human-action (rare).

**Critical:** If external resource has CLI/API (Vercel, Stripe, etc.), use type="auto" to automate. Only checkpoint for verification AFTER automation.

See ./.claude/get-shit-done/references/checkpoints.md for checkpoint structure.
</step>

<step name="estimate_scope">
After tasks, assess against quality degradation curve.

**Check depth setting:**
```bash
cat .planning/config.json 2>/dev/null | grep depth
```

<depth_aware_splitting>
**Depth controls compression tolerance, not artificial inflation.**

| Depth | Typical Plans/Phase | Tasks/Plan |
|-------|---------------------|------------|
| Quick | 1-3 | 2-3 |
| Standard | 3-5 | 2-3 |
| Comprehensive | 5-10 | 2-3 |

**Key principle:** Derive plans from actual work. Depth determines how aggressively you combine things, not a target to hit.

- Comprehensive auth phase = 8 plans (because auth genuinely has 8 concerns)
- Comprehensive "add config file" phase = 1 plan (because that's all it is)

For comprehensive depth:
- Create MORE plans when the work warrants it, not bigger ones
- If a phase has 15 tasks, that's 5-8 plans (not 3 plans with 5 tasks each)
- Don't compress to look efficient—thoroughness is the goal
- Let small phases stay small—don't pad to hit a number
- Each plan stays focused: 2-3 tasks, single concern

For quick depth:
- Combine aggressively into fewer plans
- 1-3 plans per phase is fine
- Focus on critical path
</depth_aware_splitting>

**ALWAYS split if:** >3 tasks, multiple subsystems, >5 files in any task, complex domains (auth, payments).

**If scope appropriate (2-3 tasks, single subsystem, <5 files/task):** Proceed to confirm_breakdown.

**If large (>3 tasks):** Split by subsystem, dependency, complexity, or autonomous vs interactive.

**Each plan must be:** 2-3 tasks max, ~50% context target, independently committable.

**Autonomous optimization:** No checkpoints → subagent (fresh context). Has checkpoints → main context. Group autonomous work together.

See ./.claude/get-shit-done/references/scope-estimation.md for complete guidance.
</step>

<step name="confirm_breakdown">
<if mode="yolo">
Auto-approve and proceed to write_phase_prompt.
</if>

<if mode="interactive">
Present breakdown inline:

```
Phase [X] breakdown:

### Tasks ({phase}-01-PLAN.md)
1. [Task] - [brief] [type]
2. [Task] - [brief] [type]

Autonomous: [yes/no]

Does this look right? (yes / adjust / start over)
```

For multiple plans, show each plan with its tasks.

Wait for confirmation. If "adjust": revise. If "start over": return to gather_phase_context.
</if>
</step>

<step name="write_phase_prompt">
Use template from `./.claude/get-shit-done/templates/phase-prompt.md`.

**Single plan:** Write to `.planning/phases/XX-name/{phase}-01-PLAN.md`

**Multiple plans:** Write separate files ({phase}-01-PLAN.md, {phase}-02-PLAN.md, etc.)

Each plan follows template structure with:
- Frontmatter (phase, plan, type, domain)
- Objective (plan-specific goal, purpose, output)
- Execution context (execute-phase.md, summary template, checkpoints.md if needed)
- Context (@references to PROJECT, ROADMAP, STATE, codebase docs, RESEARCH/DISCOVERY/CONTEXT if exist, prior summaries, source files, prior decisions, deferred issues, concerns)
- Tasks (XML format with types)
- Verification, Success criteria, Output specification

**Context section population from frontmatter analysis:**

Inject automatically-assembled context package from read_project_history step:

```markdown
<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

# Auto-selected based on dependency graph (from frontmatter):
@.planning/phases/XX-name/YY-ZZ-SUMMARY.md
@.planning/phases/AA-name/BB-CC-SUMMARY.md

# Key files from frontmatter (relevant to this phase):
@path/to/important/file.ts
@path/to/another/file.ts

**Tech stack available:** [extracted from frontmatter tech-stack.added]
**Established patterns:** [extracted from frontmatter patterns-established]
**Constraining decisions:**
- [Phase X]: [decision from frontmatter]
- [Phase Y]: [decision from frontmatter]

**Issues being addressed:** [If any from ISSUES.md]
</context>
```

This ensures every PLAN.md gets optimal context automatically assembled via dependency graph, making execution as informed as possible.

For multi-plan phases: each plan has focused scope, references previous plan summaries (via frontmatter selection), last plan's success criteria includes "Phase X complete".
</step>

<step name="git_commit">
Commit phase plan(s):

```bash
# Stage all PLAN.md files for this phase
git add .planning/phases/${PHASE}-*/${PHASE}-*-PLAN.md

# Also stage DISCOVERY.md if it was created during mandatory_discovery
git add .planning/phases/${PHASE}-*/DISCOVERY.md 2>/dev/null

git commit -m "$(cat <<'EOF'
docs(${PHASE}): create phase plan

Phase ${PHASE}: ${PHASE_NAME}
- [N] plan(s) created
- [X] total tasks defined
- Ready for execution
EOF
)"
```

Confirm: "Committed: docs(${PHASE}): create phase plan"
</step>

<step name="offer_next">
```
Phase plan created: .planning/phases/XX-name/{phase}-01-PLAN.md
[X] tasks defined.

---

## Next Up

**{phase}-01: [Plan Name]** - [objective summary]

`/gsd:execute-plan .planning/phases/XX-name/{phase}-01-PLAN.md`

<sub>`/clear` first - fresh context window</sub>

---

**Also available:**
- Review/adjust tasks before executing
[If multiple plans: - View all plans: `ls .planning/phases/XX-name/*-PLAN.md`]

---
```
</step>

</process>

<task_quality>
**Good tasks:** Specific files, actions, verification
- "Add User model to Prisma schema with email, passwordHash, createdAt"
- "Create POST /api/auth/login endpoint with bcrypt validation"

**Bad tasks:** Vague, not actionable
- "Set up authentication" / "Make it secure" / "Handle edge cases"

If you can't specify Files + Action + Verify + Done, the task is too vague.

**TDD candidates get dedicated plans.** If "Create price calculator with discount rules" warrants TDD, create a TDD plan for it. See `./.claude/get-shit-done/references/tdd.md` for TDD plan structure.
</task_quality>

<anti_patterns>
- No story points or hour estimates
- No team assignments
- No acceptance criteria committees
- No sub-sub-sub tasks
Tasks are instructions for Claude, not Jira tickets.
</anti_patterns>

<success_criteria>
Phase planning complete when:
- [ ] STATE.md read, project history absorbed
- [ ] Mandatory discovery completed (Level 0-3)
- [ ] Prior decisions, issues, concerns synthesized
- [ ] PLAN file(s) exist with XML structure
- [ ] Each plan: Objective, context, tasks, verification, success criteria, output
- [ ] @context references included (STATE, RESEARCH/DISCOVERY if exist, relevant summaries)
- [ ] Each plan: 2-3 tasks (~50% context)
- [ ] Each task: Type, Files (if auto), Action, Verify, Done
- [ ] Checkpoints properly structured
- [ ] If RESEARCH.md exists: "don't hand-roll" items NOT being custom-built
- [ ] PLAN file(s) committed to git
- [ ] User knows next steps
</success_criteria>
