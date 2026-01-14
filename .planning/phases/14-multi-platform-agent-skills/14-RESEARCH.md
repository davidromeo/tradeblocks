# Phase 14: Multi-Platform Agent Skills - Research

**Researched:** 2026-01-14
**Domain:** Agent Skills open standard for Claude Code, OpenAI Codex, Gemini CLI
**Confidence:** HIGH

<research_summary>
## Summary

Researched how to create multi-platform agent skills for Claude Code, OpenAI Codex, and Gemini CLI. The key finding is that **all three platforms have adopted the same open standard**: Agent Skills (agentskills.io), launched by Anthropic in December 2025.

This means we can create skills once using the SKILL.md format and they work across all three platforms with zero adaptation needed. The standard uses YAML frontmatter + Markdown instructions in a directory structure. Progressive disclosure keeps token usage efficient.

For guided conversational workflows, the pattern is: structured process steps in the SKILL.md body that guide the agent through gathering context before running analysis.

**Primary recommendation:** Create Agent Skills using the agentskills.io standard. One skill per workflow (health-check, wfa-analysis, etc.). Skills wrap the 18 MCP tools with domain context and conversational guidance.

</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library/Standard | Version | Purpose | Why Standard |
|------------------|---------|---------|--------------|
| Agent Skills | 1.0 (Dec 2025) | Skill format specification | Adopted by Claude, OpenAI, Gemini, Cursor, VS Code |
| SKILL.md | N/A | Skill definition file | Required file for all skills |

### Supporting
| Component | Purpose | When to Use |
|-----------|---------|-------------|
| `scripts/` directory | Executable code (Python, bash) | When skill needs deterministic operations |
| `references/` directory | Additional documentation | Large domain knowledge that loads on-demand |
| `assets/` directory | Static resources | Templates, schemas, lookup tables |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Agent Skills | Platform-specific APIs | Would need 3 separate implementations; skills are portable |
| OpenAI Assistants API | Responses API | Assistants deprecated Aug 2026; Responses API is the future |
| Gemini function declarations | Interactions API | Function calling works but skills give better agent guidance |

**Installation:**
Skills are directories — no package installation. Place in:
- Claude Code: `.claude/skills/` or `~/.claude/skills/`
- OpenAI Codex: `.codex/skills/` or `$CODEX_HOME/skills`
- Gemini CLI: `.gemini/skills/` or `~/.gemini/skills/`

</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```
packages/agent-skills/
├── tradeblocks-health-check/
│   ├── SKILL.md           # Strategy health check workflow
│   └── references/
│       └── metrics.md     # Explanation of metrics (Sharpe, Sortino, etc.)
├── tradeblocks-wfa/
│   ├── SKILL.md           # Walk-forward analysis workflow
│   └── references/
│       └── wfa-guide.md   # What is WFA, how to interpret
├── tradeblocks-risk/
│   ├── SKILL.md           # Risk assessment workflow
│   └── references/
│       └── kelly-guide.md # Kelly criterion explanation
├── tradeblocks-compare/
│   ├── SKILL.md           # Performance comparison workflow
│   └── references/
│       └── scaling.md     # Backtest vs actual scaling modes
├── tradeblocks-optimize/
│   ├── SKILL.md           # Backtest optimization workflow
│   └── references/
│       └── optimization.md
└── tradeblocks-portfolio/
    ├── SKILL.md           # Portfolio addition decision workflow
    └── references/
        └── correlation.md # Correlation and diversification
```

### Pattern 1: SKILL.md Format
**What:** YAML frontmatter + Markdown instructions
**When to use:** Every skill
**Example:**
```yaml
---
name: tradeblocks-health-check
description: Comprehensive strategy health check for trading backtests. Use when user wants to evaluate a strategy's robustness, review performance metrics, or check if a strategy is worth trading. Works with TradeBlocks MCP server.
---

# Strategy Health Check

## Prerequisites
- TradeBlocks MCP server running
- At least one block loaded with trade data

## Process

### Step 1: Identify the target
Ask the user which strategy/block to analyze. Use `list_backtests` to show available options.

### Step 2: Gather basic stats
Run `get_statistics` to get portfolio metrics (Sharpe, Sortino, max drawdown).

### Step 3: Run diagnostics
Based on initial metrics, run targeted analysis:
- If Sharpe < 1.0: Check `run_monte_carlo` for worst-case scenarios
- If drawdown > 30%: Check `get_tail_risk` for tail exposure
- Always check `calculate_position_sizing` for Kelly recommendations

### Step 4: Summarize findings
Present a clear summary with:
- Overall health: Healthy / Concerns / Avoid
- Key metrics with interpretation
- Specific recommendations

## Interpretation Guide
[See references/metrics.md for detailed metric explanations]
```

### Pattern 2: Conversational Workflow (Guided Dialogue)
**What:** Skills that gather context before running analysis
**When to use:** Complex workflows where user intent varies
**Example:**
```markdown
## Process

### Step 1: Understand the goal
Present options to the user:
- "What would you like to know about your strategy?"
  - Overall health assessment
  - Risk analysis
  - Performance over time
  - Comparison with another strategy

### Step 2: Gather context
Based on selection, ask follow-up:
- For health: "Any particular concerns? (drawdown, consistency, risk)"
- For comparison: "Which strategies to compare?"

### Step 3: Execute analysis
Run the appropriate MCP tools based on gathered context.

### Step 4: Present results
Format results with:
- Key findings (2-3 bullet points)
- Detailed data (expandable)
- Next steps / recommendations
```

### Pattern 3: Progressive Disclosure
**What:** Keep SKILL.md under 500 lines, reference larger docs
**When to use:** When domain knowledge is extensive
**Example:**
```markdown
## Metrics Reference

For detailed explanations of each metric, see:
- [references/sharpe-ratio.md](references/sharpe-ratio.md)
- [references/sortino-ratio.md](references/sortino-ratio.md)
- [references/max-drawdown.md](references/max-drawdown.md)
```

### Anti-Patterns to Avoid
- **Massive SKILL.md files:** Keep under 500 lines; split into references
- **Platform-specific code:** Use the standard, not platform APIs
- **Hardcoded tool names:** Reference MCP tools by function, not implementation
- **Technical jargon without explanation:** Skills should educate, not assume knowledge

</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Skill format | Custom YAML/JSON | Agent Skills standard | Portable across Claude, OpenAI, Gemini |
| Platform adapters | Per-platform code | SKILL.md | One format works everywhere |
| MCP tool wrappers | Custom CLI tools | Skills calling MCP directly | Skills have MCP access built-in |
| Conversation state | Custom state machine | Step-based SKILL.md process | Agent handles state naturally |
| User prompting | Custom prompt templates | Inline in SKILL.md | Skills are the prompt |

**Key insight:** The Agent Skills standard eliminates the need for platform-specific code. A skill written for Claude Code works identically on OpenAI Codex and Gemini CLI. Don't build adapters — just build skills.

</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Skill Names Don't Match Directory
**What goes wrong:** Skill won't load
**Why it happens:** `name` field must exactly match parent directory name
**How to avoid:** Always use `name: tradeblocks-health-check` when directory is `tradeblocks-health-check/`
**Warning signs:** "Skill not found" errors

### Pitfall 2: Poor Description = Never Triggered
**What goes wrong:** Agent doesn't use the skill when it should
**Why it happens:** Description doesn't contain keywords the agent matches
**How to avoid:** Include specific phrases: "trading backtest", "strategy analysis", "walk-forward"
**Warning signs:** User explicitly requests analysis but skill doesn't activate

### Pitfall 3: Context Window Explosion
**What goes wrong:** Skill loads but runs out of context
**Why it happens:** SKILL.md too large, or references load unnecessary content
**How to avoid:** Keep SKILL.md under 500 lines; use progressive disclosure
**Warning signs:** Truncated responses, "context limit" errors

### Pitfall 4: Assuming MCP Is Connected
**What goes wrong:** Skill fails because MCP server not running
**Why it happens:** Skill doesn't check prerequisites
**How to avoid:** First step should verify MCP connection with `list_backtests`
**Warning signs:** "Tool not found" or connection errors

### Pitfall 5: No Interpretation Guidance
**What goes wrong:** User gets data but doesn't understand it
**Why it happens:** Skill outputs raw numbers without context
**How to avoid:** Always include interpretation: "Sharpe of 1.5 is good (>1.0 generally tradeable)"
**Warning signs:** User asks "what does this mean?"

</common_pitfalls>

<code_examples>
## Code Examples

### Basic SKILL.md Structure
```yaml
---
name: tradeblocks-health-check
description: Comprehensive strategy health check for trading backtests. Analyzes performance metrics, runs Monte Carlo simulations, and provides risk assessment. Use when evaluating if a strategy is robust enough to trade live.
---

# Strategy Health Check

Evaluate a trading strategy's health and robustness.

## Prerequisites
- TradeBlocks MCP server must be running
- At least one block with trade data

## Process

### Step 1: Select strategy
List available blocks with `list_backtests` and help user select.

### Step 2: Basic metrics
Run `get_statistics` for the selected block.
Present key metrics:
- Sharpe Ratio (>1.0 = acceptable, >2.0 = excellent)
- Max Drawdown (<20% = low risk, >40% = high risk)
- Win Rate and Profit Factor

### Step 3: Stress testing
Run `run_monte_carlo` with default settings.
Focus on:
- 5th percentile outcome (worst realistic case)
- Probability of ruin

### Step 4: Risk assessment
Run `get_tail_risk` to check for fat tails.
Run `calculate_position_sizing` for Kelly recommendations.

### Step 5: Summary
Provide overall assessment:
- HEALTHY: Sharpe >1.5, drawdown <25%, Kelly suggests reasonable position
- CONCERNS: Sharpe 0.5-1.5, or drawdown 25-40%
- AVOID: Sharpe <0.5, or drawdown >40%, or Kelly suggests tiny position

## Next Steps
After health check, user may want:
- `/tradeblocks-wfa` for walk-forward validation
- `/tradeblocks-compare` to compare with other strategies
```

### Walk-Forward Analysis Skill
```yaml
---
name: tradeblocks-wfa
description: Walk-forward analysis for trading strategies. Validates optimization robustness by testing parameters on out-of-sample data. Use when user wants to check if optimized parameters will work in the future.
---

# Walk-Forward Analysis

Validate strategy parameters haven't been overfit to historical data.

## What is Walk-Forward Analysis?

Walk-forward analysis divides your data into segments:
1. Optimize parameters on in-sample data
2. Test those parameters on out-of-sample data
3. Repeat across the entire history

If out-of-sample performance matches in-sample, the strategy is robust.

## Process

### Step 1: Select strategy
Use `list_backtests` to show available blocks.

### Step 2: Explain the analysis
Ask user about their goals:
- Validate existing parameters?
- Find optimal window sizes?
- Check for regime changes?

### Step 3: Run analysis
Call `run_walk_forward` with appropriate parameters:
- Default: 4 windows, 25% out-of-sample
- Adjust based on data length

### Step 4: Interpret results
Key metrics to explain:
- Walk-Forward Efficiency (>50% = parameters transfer well)
- Out-of-sample profit vs in-sample (should be similar)
- Consistency across windows (watch for degradation)

## Interpretation Guide

| WF Efficiency | Meaning | Action |
|---------------|---------|--------|
| >75% | Excellent | Parameters are robust |
| 50-75% | Good | Consider averaging parameters |
| 25-50% | Marginal | Re-evaluate optimization |
| <25% | Poor | Likely overfit, don't trade |
```

### Risk Assessment Skill
```yaml
---
name: tradeblocks-risk
description: Risk assessment for trading strategies including Kelly criterion, tail risk analysis, and Monte Carlo simulation. Use when evaluating position sizing or checking worst-case scenarios.
---

# Risk Assessment

Evaluate how much risk a strategy carries and how to size positions.

## Process

### Step 1: Gather context
Ask what the user wants to understand:
- How much capital to allocate?
- What's the worst-case scenario?
- Is this strategy too risky?

### Step 2: Run appropriate analysis

**For position sizing:**
Call `calculate_position_sizing` to get Kelly recommendations.
Present with caveats:
- Full Kelly is aggressive; half-Kelly is common practice
- Never risk more than you can afford to lose

**For worst-case:**
Call `run_monte_carlo` with worst-case pool injection.
Focus on:
- 5th percentile drawdown
- Probability of losing >50% of capital

**For tail risk:**
Call `get_tail_risk` to check distribution properties.
Explain:
- Fat tails = unexpected large losses more likely
- Skewness = asymmetric risk

### Step 3: Provide recommendations
Based on analysis:
- Suggested position size (% of portfolio)
- Risk warnings (if any)
- Comparison to typical guidelines (e.g., "risking 2% per trade")
```

</code_examples>

<sota_updates>
## State of the Art (2025-2026)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Platform-specific integrations | Agent Skills standard | Dec 2025 | One skill works across all platforms |
| OpenAI Assistants API | Responses API + Agents SDK | Jan 2026 | Assistants deprecated Aug 2026 |
| Claude Code slash commands | Agent Skills + Skill tool | Oct-Dec 2025 | Unified invocation mechanism |
| Gemini function declarations | Gemini CLI skills | Dec 2025 | Skills preferred for complex workflows |

**New tools/patterns to consider:**
- **Agent Skills 1.0 standard:** Write once, use everywhere (Claude, OpenAI, Gemini, Cursor, VS Code)
- **Progressive disclosure:** Metadata → instructions → resources, loaded on-demand
- **Conversational workflow pattern:** Structured steps that gather context before executing

**Deprecated/outdated:**
- **OpenAI Assistants API:** Sunset Aug 2026; use Responses API for new projects
- **Platform-specific skill formats:** Now converged on agentskills.io standard
- **Monolithic skills:** Split into focused skills with references for better token efficiency

</sota_updates>

<open_questions>
## Open Questions

1. **Skill distribution mechanism**
   - What we know: Skills can be installed from GitHub, placed in local directories
   - What's unclear: Best way to distribute TradeBlocks skills to users
   - Recommendation: Start with `.claude/skills/` in repo; document manual install for other platforms

2. **MCP server discovery**
   - What we know: Skills can call MCP tools; MCP server must be running
   - What's unclear: How to ensure MCP server is discovered across platforms
   - Recommendation: First step in each skill should verify MCP connection

3. **Skill updates**
   - What we know: Skills are filesystem-based
   - What's unclear: How to handle skill version updates for installed skills
   - Recommendation: Include version in metadata; document update process

</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- [Agent Skills Specification](https://agentskills.io/specification) - Complete SKILL.md format
- [Claude Platform Agent Skills Docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) - Architecture and loading
- [OpenAI Codex Skills](https://developers.openai.com/codex/skills/) - OpenAI adoption of standard
- [Gemini CLI Skills](https://geminicli.com/docs/cli/skills/) - Gemini adoption of standard
- [Google Cloud Vertex AI Function Calling](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/function-calling) - Gemini function declaration format

### Secondary (MEDIUM confidence)
- [Anthropic Opens Agent Skills Standard](https://www.unite.ai/anthropic-opens-agent-skills-standard-continuing-its-pattern-of-building-industry-infrastructure/) - Industry context
- [OpenAI for Developers 2025](https://developers.openai.com/blog/openai-for-developers-2025/) - Assistants deprecation, Responses API
- [GitHub anthropics/skills](https://github.com/anthropics/skills/blob/main/spec/agent-skills-spec.md) - Redirect to specification

### Tertiary (LOW confidence - needs validation)
- None - all findings verified with primary sources

</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Agent Skills open standard (agentskills.io)
- Ecosystem: Claude Code, OpenAI Codex, Gemini CLI
- Patterns: SKILL.md format, conversational workflows, progressive disclosure
- Pitfalls: Naming, description quality, context limits, MCP prerequisites

**Confidence breakdown:**
- Standard stack: HIGH - verified with official docs from all three platforms
- Architecture: HIGH - based on specification and existing skill examples
- Pitfalls: HIGH - derived from specification constraints
- Code examples: MEDIUM - synthesized from standard, not tested in production

**Research date:** 2026-01-14
**Valid until:** 2026-02-14 (30 days - standard is new but stable)

</metadata>

---

*Phase: 14-multi-platform-agent-skills*
*Research completed: 2026-01-14*
*Ready for planning: yes*
