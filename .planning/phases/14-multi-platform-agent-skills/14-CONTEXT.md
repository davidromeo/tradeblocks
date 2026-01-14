# Phase 14: Multi-Platform Agent Skills - Context

**Gathered:** 2026-01-14
**Status:** Ready for research

<vision>
## How This Should Work

Skills for Claude Code, OpenAI Agents, and Gemini Agents that provide the same capabilities across all three platforms. Use whichever AI you prefer — the experience should be equivalent.

The skills aren't just thin wrappers around MCP tools. They provide the necessary context to the model about what the tools do and guide the user through analysis workflows conversationally. The skill teaches the model what walk-forward analysis means, when to use it, and walks the user through the process step by step.

Conversational flow: skills ask questions, gather context about what the user is trying to understand, and then run the appropriate analysis. Like a guided interview that leads to insights — not just command execution.

</vision>

<essential>
## What Must Be Nailed

- **Multi-platform parity** — Same skills available for Claude Code, OpenAI, and Gemini
- **Guided workflows** — Skills that walk users through analysis scenarios:
  - Strategy health check (drawdown, Sharpe, tail risk, Monte Carlo)
  - Performance comparison (backtest vs actual, strategy vs strategy, period vs period)
  - Risk assessment (Kelly sizing, correlation, worst-case scenarios)
  - Walk-forward analysis (validating optimization robustness)
  - Single backtest optimization (finding best parameters)
  - Portfolio addition decision (should this strategy be added?)
- **Context for models** — Skills provide enough background that the AI understands *why* and *when* to use each tool, not just *how*

</essential>

<boundaries>
## What's Out of Scope

- New MCP tools — work with the existing 18 tools only
- UI integration — skills are CLI/chat only, no web app changes
- Building new calculation or analysis capabilities

</boundaries>

<specifics>
## Specific Ideas

- Conversational flow pattern — skills ask questions to gather context before running analysis
- Each platform (Claude, OpenAI, Gemini) gets equivalent skills, adapted to that platform's skill/function format
- Skills teach the model about trading concepts (what is walk-forward analysis, what is Sharpe ratio, etc.)

</specifics>

<notes>
## Additional Context

The user primarily works in Claude Code but wants flexibility to use other AI platforms. The emphasis is on guided workflows rather than raw tool access — the skills should help users who don't know which analysis to run.

Existing MCP server has 18 tools:
- 6 core (block management, trade queries)
- 5 analysis (WFA, Monte Carlo, correlation, tail risk, position sizing)
- 3 performance (charts, period returns, backtest vs actual)
- 4 report builder (field listing, filtered queries, statistics, aggregation)

</notes>

---

*Phase: 14-multi-platform-agent-skills*
*Context gathered: 2026-01-14*
