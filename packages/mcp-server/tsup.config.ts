import { defineConfig } from 'tsup';

export default defineConfig([
  // Main MCP server entry (executable)
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    target: 'node18',
    clean: true,
    dts: true,
    sourcemap: true,
    banner: {
      js: '#!/usr/bin/env node'
    },
    // Bundle lib/ imports into dist
    noExternal: [/^@lib\//]
  },
  // Skill installer module (library, no shebang)
  {
    entry: ['src/skill-installer.ts'],
    format: ['esm'],
    target: 'node18',
    dts: true,
    sourcemap: true,
    noExternal: [/^@lib\//]
  }
]);
