# GPT Context Files

This folder contains files for the TradeBlocks ChatGPT companion.

## Files

- **system-prompt.md** - The system prompt for the custom GPT (manually maintained)
- **codebase-context.md** - Auto-generated codebase context for GPT knowledge base

## Usage

Generate/update the codebase context:

```bash
npm run gpt:context
```

Then manually upload `codebase-context.md` to the ChatGPT knowledge base.
