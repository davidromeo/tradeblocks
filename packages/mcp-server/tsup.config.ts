import { defineConfig } from 'tsup';
import path from 'path';

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
    noExternal: [/.*/],
    esbuildOptions(options) {
      options.alias = {
        '@lib': path.resolve(__dirname, '../../lib'),
        '@': path.resolve(__dirname, '../..'),
      };
    },
  },
  // Skill installer module (library, no shebang) - stays in dist/
  {
    entry: ['src/skill-installer.ts'],
    outDir: 'dist',
    format: ['esm'],
    target: 'node18',
    dts: true,
    sourcemap: true,
    noExternal: [/^@lib\//, /^@\//],
    esbuildOptions(options) {
      options.alias = {
        '@lib': path.resolve(__dirname, '../../lib'),
        '@': path.resolve(__dirname, '../..'),
      };
    },
  },
  // Test exports module - bundle utilities for testing
  {
    entry: ['src/test-exports.ts'],
    outDir: 'dist',
    format: ['esm'],
    target: 'node18',
    dts: false,  // Skip DTS for test exports
    sourcemap: true,
    noExternal: [/^@lib\//, /^@\//],
    esbuildOptions(options) {
      options.alias = {
        '@lib': path.resolve(__dirname, '../../lib'),
        '@': path.resolve(__dirname, '../..'),
      };
    },
  }
]);
