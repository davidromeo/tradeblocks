# TradeBlocks Skills Installation Guide

This guide covers installation of TradeBlocks skills for all supported AI agent platforms.

## Prerequisites

Before installing skills, ensure you have:

1. **Node.js 18+** installed
2. **TradeBlocks MCP server** built and configured
3. **At least one block directory** with trade data

### Verify MCP Server

```bash
# Build the MCP server (if not already done)
cd packages/mcp-server
npm install
npm run build

# Set blocks directory environment variable
export TRADEBLOCKS_BLOCKS_DIR=/path/to/your/blocks
```

## Claude Code Installation

Claude Code supports skills in two locations:

### Option A: Personal Installation (Recommended)

Skills in `~/.claude/skills/` are available in all projects:

```bash
# Create skills directory if it doesn't exist
mkdir -p ~/.claude/skills

# Symlink all TradeBlocks skills
ln -s /path/to/tradeblocks/packages/agent-skills/tradeblocks-* ~/.claude/skills/
```

Or use the installation script:

```bash
cd /path/to/tradeblocks/packages/agent-skills
./install.sh claude
```

### Option B: Project Installation

Skills in `.claude/skills/` (project root) are shared with your team via git:

```bash
# From your project root
mkdir -p .claude/skills
ln -s /path/to/tradeblocks/packages/agent-skills/tradeblocks-* .claude/skills/
```

### Verification

Ask Claude: "What skills are available?"

Or check directly:

```bash
ls -la ~/.claude/skills/
```

You should see symlinks for all 6 TradeBlocks skills.

### Debug Mode

If skills aren't loading, run Claude with debug output:

```bash
claude --debug
```

Look for skill loading messages in the output.

## Codex CLI Installation

Codex CLI uses a similar skills directory structure:

```bash
# Create skills directory
mkdir -p ~/.codex/skills

# Symlink all TradeBlocks skills
ln -s /path/to/tradeblocks/packages/agent-skills/tradeblocks-* ~/.codex/skills/
```

Or use the installation script:

```bash
./install.sh codex
```

**Note:** Codex may use different syntax to invoke skills. Consult Codex documentation for the current activation method.

## Gemini CLI Installation

Gemini CLI follows the same pattern:

```bash
# Create skills directory
mkdir -p ~/.gemini/skills

# Symlink all TradeBlocks skills
ln -s /path/to/tradeblocks/packages/agent-skills/tradeblocks-* ~/.gemini/skills/
```

Or use the installation script:

```bash
./install.sh gemini
```

**Note:** Gemini may use different syntax to invoke skills. Consult Gemini documentation for the current activation method.

## All Platforms at Once

To install to all platforms:

```bash
./install.sh all
```

## Troubleshooting

### "Skill not found"

1. Verify the skill directory exists:
   ```bash
   ls ~/.claude/skills/tradeblocks-health-check/SKILL.md
   ```

2. Check that SKILL.md has valid YAML frontmatter (must start on line 1):
   ```yaml
   ---
   name: tradeblocks-health-check
   description: ...
   ---
   ```

3. Ensure no tabs in YAML (use spaces only)

### "Tool not found" during skill execution

The skill invokes MCP tools but the server isn't available:

1. Verify MCP server is built:
   ```bash
   ls packages/mcp-server/dist/index.js
   ```

2. Check MCP server configuration in your agent settings

3. Verify `TRADEBLOCKS_BLOCKS_DIR` is set correctly

### YAML Parsing Errors

- Frontmatter must start on line 1 (no blank lines before `---`)
- Use spaces, not tabs
- Ensure closing `---` is present

### Symlink Issues (macOS/Linux)

If symlinks aren't working:

```bash
# Remove existing broken symlink
rm ~/.claude/skills/tradeblocks-health-check

# Recreate with absolute path
ln -s /absolute/path/to/tradeblocks/packages/agent-skills/tradeblocks-health-check ~/.claude/skills/
```

### Windows Installation

Windows doesn't support Unix symlinks. Copy the skill folders instead:

```powershell
# Create skills directory
mkdir $env:USERPROFILE\.claude\skills

# Copy all TradeBlocks skills
Copy-Item -Recurse C:\path\to\tradeblocks\packages\agent-skills\tradeblocks-* $env:USERPROFILE\.claude\skills\
```

**Note:** When updating skills on Windows, you'll need to re-copy the folders (unlike macOS/Linux where symlinks auto-update).

### Permission Denied

Ensure the install script is executable:

```bash
chmod +x install.sh
```

## Updating Skills

### If Using Symlinks (Recommended)

Simply pull the latest code:

```bash
cd /path/to/tradeblocks
git pull
```

Skills update automatically since symlinks point to the source.

### If You Copied Files

Re-copy after updates:

```bash
# Remove old skills
rm -rf ~/.claude/skills/tradeblocks-*

# Re-copy
cp -r /path/to/tradeblocks/packages/agent-skills/tradeblocks-* ~/.claude/skills/
```

## Uninstalling

Remove the symlinks:

```bash
rm ~/.claude/skills/tradeblocks-*
rm ~/.codex/skills/tradeblocks-*
rm ~/.gemini/skills/tradeblocks-*
```
