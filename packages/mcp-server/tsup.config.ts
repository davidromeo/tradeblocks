import { defineConfig } from 'tsup';

export default defineConfig([
  // Main MCP server entry (executable) - outputs to server/ for MCPB
  {
    entry: ['src/index.ts'],
    outDir: 'server',
    format: ['esm'],
    target: 'node18',
    clean: true,
    dts: true,
    sourcemap: true,
    banner: {
      js: '#!/usr/bin/env node'
    },
    // Bundle ALL dependencies for standalone MCPB distribution
    noExternal: [/.*/]
  },
  // Skill installer module (library, no shebang) - stays in dist/
  {
    entry: ['src/skill-installer.ts'],
    outDir: 'dist',
    format: ['esm'],
    target: 'node18',
    dts: true,
    sourcemap: true,
    noExternal: [/^@lib\//]
  }
]);
