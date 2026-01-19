/**
 * @tradeblocks/lib - Shared library for TradeBlocks
 *
 * This package contains all shared business logic, models, and utilities
 * used across the TradeBlocks monorepo.
 */

// Core calculations
export * from './calculations'

// Data models
export * from './models'

// CSV processing pipeline
export * from './processing'

// IndexedDB database layer
export * from './db'

// Zustand stores (UI state management)
export * from './stores'

// Utility functions
export * from './utils'

// Static data (treasury rates, etc.)
export * from './data'

// Services (calendar data, performance snapshots)
export * from './services'

// Metrics (trade efficiency, etc.)
export * from './metrics'

// Type definitions
export * from './types'
