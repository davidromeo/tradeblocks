/**
 * IndexedDB Database Service for TradeBlocks
 *
 * Manages the client-side database for storing blocks, trades, and daily logs.
 * Uses a versioned schema with migration support.
 */

// Types imported for reference (commented out to avoid unused warnings)
// import { ProcessedBlock } from '../models/block'
// import { Trade } from '../models/trade'
// import { DailyLogEntry } from '../models/daily-log'
// import { PortfolioStats, StrategyStats, PerformanceMetrics } from '../models/portfolio-stats'

// Database configuration
export const DB_NAME = 'TradeBlocksDB'
export const DB_VERSION = 1

// Object store names
export const STORES = {
  BLOCKS: 'blocks',
  TRADES: 'trades',
  DAILY_LOGS: 'dailyLogs',
  CALCULATIONS: 'calculations',
} as const

// Index names
export const INDEXES = {
  TRADES_BY_BLOCK: 'blockId',
  TRADES_BY_DATE: 'dateOpened',
  TRADES_BY_STRATEGY: 'strategy',
  DAILY_LOGS_BY_BLOCK: 'blockId',
  DAILY_LOGS_BY_DATE: 'date',
  CALCULATIONS_BY_BLOCK: 'blockId',
} as const

/**
 * Database instance singleton
 */
let dbInstance: IDBDatabase | null = null

/**
 * Initialize the IndexedDB database
 */
export async function initializeDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance)
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      reject(new Error(`Failed to open database: ${request.error?.message}`))
    }

    request.onsuccess = () => {
      dbInstance = request.result
      resolve(dbInstance)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      const transaction = (event.target as IDBOpenDBRequest).transaction!

      // Create blocks store
      if (!db.objectStoreNames.contains(STORES.BLOCKS)) {
        const blocksStore = db.createObjectStore(STORES.BLOCKS, { keyPath: 'id' })
        blocksStore.createIndex('name', 'name', { unique: false })
        blocksStore.createIndex('isActive', 'isActive', { unique: false })
        blocksStore.createIndex('created', 'created', { unique: false })
        blocksStore.createIndex('lastModified', 'lastModified', { unique: false })
      }

      // Create trades store
      if (!db.objectStoreNames.contains(STORES.TRADES)) {
        const tradesStore = db.createObjectStore(STORES.TRADES, { autoIncrement: true })
        tradesStore.createIndex(INDEXES.TRADES_BY_BLOCK, 'blockId', { unique: false })
        tradesStore.createIndex(INDEXES.TRADES_BY_DATE, 'dateOpened', { unique: false })
        tradesStore.createIndex(INDEXES.TRADES_BY_STRATEGY, 'strategy', { unique: false })
        tradesStore.createIndex('pl', 'pl', { unique: false })
        tradesStore.createIndex('composite_block_date', ['blockId', 'dateOpened'], { unique: false })
      }

      // Create daily logs store
      if (!db.objectStoreNames.contains(STORES.DAILY_LOGS)) {
        const dailyLogsStore = db.createObjectStore(STORES.DAILY_LOGS, { autoIncrement: true })
        dailyLogsStore.createIndex(INDEXES.DAILY_LOGS_BY_BLOCK, 'blockId', { unique: false })
        dailyLogsStore.createIndex(INDEXES.DAILY_LOGS_BY_DATE, 'date', { unique: false })
        dailyLogsStore.createIndex('composite_block_date', ['blockId', 'date'], { unique: false })
      }

      // Create calculations store (for cached computations)
      if (!db.objectStoreNames.contains(STORES.CALCULATIONS)) {
        const calculationsStore = db.createObjectStore(STORES.CALCULATIONS, { keyPath: 'id' })
        calculationsStore.createIndex(INDEXES.CALCULATIONS_BY_BLOCK, 'blockId', { unique: false })
        calculationsStore.createIndex('calculationType', 'calculationType', { unique: false })
        calculationsStore.createIndex('calculatedAt', 'calculatedAt', { unique: false })
      }

      transaction.oncomplete = () => {
        dbInstance = db
        resolve(db)
      }
    }
  })
}

/**
 * Get database instance (initialize if needed)
 */
export async function getDatabase(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance
  }
  return initializeDatabase()
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
}

/**
 * Delete the entire database (for testing/reset)
 */
export async function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    closeDatabase()

    const deleteRequest = indexedDB.deleteDatabase(DB_NAME)

    deleteRequest.onsuccess = () => resolve()
    deleteRequest.onerror = () => reject(new Error('Failed to delete database'))
    deleteRequest.onblocked = () => reject(new Error('Database deletion blocked'))
  })
}

/**
 * Transaction helper for read operations
 */
export async function withReadTransaction<T>(
  stores: string | string[],
  callback: (transaction: IDBTransaction) => Promise<T>
): Promise<T> {
  const db = await getDatabase()
  const storeNames = Array.isArray(stores) ? stores : [stores]
  const transaction = db.transaction(storeNames, 'readonly')

  return callback(transaction)
}

/**
 * Transaction helper for write operations
 */
export async function withWriteTransaction<T>(
  stores: string | string[],
  callback: (transaction: IDBTransaction) => Promise<T>
): Promise<T> {
  const db = await getDatabase()
  const storeNames = Array.isArray(stores) ? stores : [stores]
  const transaction = db.transaction(storeNames, 'readwrite')

  return callback(transaction)
}

/**
 * Generic helper for promisifying IDBRequest
 */
export function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Storage quota management
 */
export interface StorageInfo {
  quota: number
  usage: number
  available: number
  persistent: boolean
}

/**
 * Get storage quota information
 */
export async function getStorageInfo(): Promise<StorageInfo> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate()
    const persistent = await navigator.storage.persisted()

    return {
      quota: estimate.quota || 0,
      usage: estimate.usage || 0,
      available: (estimate.quota || 0) - (estimate.usage || 0),
      persistent,
    }
  }

  // Fallback for browsers without storage API
  return {
    quota: 0,
    usage: 0,
    available: 0,
    persistent: false,
  }
}

/**
 * Request persistent storage
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if ('storage' in navigator && 'persist' in navigator.storage) {
    return navigator.storage.persist()
  }
  return false
}

/**
 * Database error types
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly store?: string,
    public readonly cause?: Error
  ) {
    super(message)
    this.name = 'DatabaseError'
  }
}

export class QuotaExceededError extends DatabaseError {
  constructor(operation: string, store?: string) {
    super('Storage quota exceeded', operation, store)
    this.name = 'QuotaExceededError'
  }
}

export class TransactionError extends DatabaseError {
  constructor(message: string, operation: string, store?: string, cause?: Error) {
    super(message, operation, store, cause)
    this.name = 'TransactionError'
  }
}

// Re-export functions from individual stores
export { createBlock, getBlock, getAllBlocks, updateBlock, deleteBlock, getActiveBlock, updateBlockStats } from './blocks-store'
export { addTrades, getTradesByBlock, getTradeCountByBlock, deleteTradesByBlock } from './trades-store'
export { addDailyLogEntries, getDailyLogsByBlock, getDailyLogCountByBlock, deleteDailyLogsByBlock } from './daily-logs-store'