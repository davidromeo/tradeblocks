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
    // Bundle ALL deps for standalone MCPB distribution
    // http-server.ts is dynamically imported - built separately below
    noExternal: [/.*/],
    external: ['./http-server.js'],
  },
  // Skill installer module (library, no shebang) - stays in dist/
  {
    entry: ['src/skill-installer.ts'],
    outDir: 'dist',
    format: ['esm'],
    target: 'node18',
    dts: true,
    sourcemap: true,
    // Bundle workspace package content
    noExternal: [/^@tradeblocks\//],
  },
  // Test exports module - bundle utilities for testing
  {
    entry: ['src/test-exports.ts'],
    outDir: 'dist',
    format: ['esm'],
    target: 'node18',
    dts: false,  // Skip DTS for test exports
    sourcemap: true,
    // Bundle workspace package content
    noExternal: [/^@tradeblocks\//],
  }
]);
