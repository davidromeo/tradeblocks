#!/usr/bin/env bash
# Install TradeBlocks skills for Claude Code, Codex CLI, or Gemini CLI

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS=(tradeblocks-health-check tradeblocks-wfa tradeblocks-risk tradeblocks-compare tradeblocks-portfolio tradeblocks-optimize)

usage() {
  echo "Usage: $0 <platform>"
  echo ""
  echo "Platforms:"
  echo "  claude    Install to ~/.claude/skills/"
  echo "  codex     Install to ~/.codex/skills/"
  echo "  gemini    Install to ~/.gemini/skills/"
  echo "  all       Install to all platforms"
  echo ""
  echo "Example:"
  echo "  $0 claude"
  exit 1
}

install_skills() {
  local platform=$1
  local target_dir="$HOME/.${platform}/skills"

  echo "Installing skills to $target_dir..."
  mkdir -p "$target_dir"

  for skill in "${SKILLS[@]}"; do
    local source="$SCRIPT_DIR/$skill"
    local target="$target_dir/$skill"

    if [ -L "$target" ]; then
      echo "  Updating: $skill"
      rm "$target"
    elif [ -d "$target" ]; then
      echo "  Skipping: $skill (directory exists, remove manually to update)"
      continue
    else
      echo "  Installing: $skill"
    fi

    ln -s "$source" "$target"
  done

  echo ""
  echo "Done! Verify with: ls -la $target_dir"
}

case "${1:-}" in
  claude|codex|gemini)
    install_skills "$1"
    ;;
  all)
    install_skills "claude"
    install_skills "codex"
    install_skills "gemini"
    ;;
  *)
    usage
    ;;
esac
