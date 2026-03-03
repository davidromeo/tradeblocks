# TradeBlocks Agent Skills

Conversational workflows for options trading analysis. These skills guide AI agents through structured analysis processes using the TradeBlocks MCP server.

**Compatible with:** Claude Code, Codex CLI, Gemini CLI

## What Are Skills?

Skills are markdown files that teach AI agents how to perform specific tasks. They:

- Guide conversation through structured analytical workflows
- Ask clarifying questions to understand context
- Use MCP tools to gather data and run analyses
- Present results with educational context

Skills do not execute code directly - they require the TradeBlocks MCP server for actual data access and calculations.

## Available Skills

| Skill | Purpose | Key MCP Tools Used |
|-------|---------|-------------------|
| `tradeblocks-health-check` | Strategy health evaluation - metrics, stress tests, risk indicators | `get_statistics`, `run_monte_carlo`, `get_tail_risk` |
| `tradeblocks-wfa` | Walk-forward analysis - test parameter robustness on unseen data | `run_walk_forward` |
| `tradeblocks-risk` | Risk assessment and position sizing | `calculate_position_sizing`, `get_tail_risk` |
| `tradeblocks-compare` | Performance comparison - backtest vs actual, strategy correlations | `compare_backtest_to_actual`, `get_correlation_matrix` |
| `tradeblocks-portfolio` | Portfolio addition decisions - should I add this strategy? | `get_correlation_matrix`, `get_statistics` |
| `tradeblocks-optimize` | Parameter optimization with overfitting awareness | `run_sql`, `describe_database` |

## Prerequisites

Before using these skills, you need:

1. **TradeBlocks MCP server** configured and accessible
2. **At least one block directory** containing your trade data (tradelog.csv required)
3. **An AI agent** that supports skills (Claude Code, Codex CLI, or Gemini CLI)

See [MCP Server Setup](../mcp-server/README.md) for server configuration.

## Quick Start (Claude Code)

```bash
# Personal installation (available in all projects)
ln -s /path/to/tradeblocks/packages/agent-skills/tradeblocks-* ~/.claude/skills/

# Or project installation (shared via git)
ln -s /path/to/tradeblocks/packages/agent-skills/tradeblocks-* .claude/skills/
```

Then invoke a skill by name:

```
/tradeblocks-health-check
```

## Usage Pattern

Skills are conversational - they ask clarifying questions before diving into analysis:

1. **Step 1**: Skill verifies MCP server connection
2. **Step 2**: User selects what to analyze (block, strategy, etc.)
3. **Step 3**: Skill gathers data and runs appropriate analyses
4. **Step 4**: Results presented with educational context
5. **Step 5**: Related skills suggested for further exploration

Example conversation:
```
User: /tradeblocks-health-check

Agent: Let me check which backtests are available...
       [lists available blocks]
       Which backtest would you like to analyze?

User: SPX-Iron-Condor

Agent: [runs get_statistics, run_monte_carlo, get_tail_risk]
       Here's the health check for SPX-Iron-Condor:
       ...
```

## Installation Script

For convenience, use the installation script:

```bash
cd packages/agent-skills
./install.sh claude    # Install to Claude Code
./install.sh codex     # Install to Codex CLI
./install.sh gemini    # Install to Gemini CLI
./install.sh all       # Install to all platforms
```

## See Also

- [Detailed Installation Guide](INSTALL.md) - Instructions for all platforms
- [MCP Server for Claude Desktop](../mcp-server/README.md) - Desktop Extension installation

## Skill Development

Each skill follows this structure:

```
tradeblocks-{name}/
  SKILL.md           # Main skill definition (YAML frontmatter + markdown)
  references/        # Supporting educational materials
    {topic}.md
```

The `SKILL.md` file contains:
- YAML frontmatter with `name` and `description`
- Prerequisites section
- Step-by-step process
- Interpretation guidance
- Related skills

Reference files provide deeper educational content that agents can consult when users need more explanation.
