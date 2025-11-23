/**
 * Equity Curves Store - CRUD operations for equity curve entries
 */

import { EquityCurveEntry } from '../models/equity-curve'
import {
  STORES,
  INDEXES,
  withReadTransaction,
  withWriteTransaction,
  promisifyRequest,
  DatabaseError,
} from './index'

/**
 * Equity curve entry with blockId for storage
 */
export interface StoredEquityCurveEntry extends EquityCurveEntry {
  blockId: string
}

/**
 * Add equity curve entries for a block
 */
export async function addEquityCurveEntries(
  blockId: string,
  entries: EquityCurveEntry[]
): Promise<void> {
  if (entries.length === 0) return

  await withWriteTransaction(STORES.EQUITY_CURVES, async (transaction) => {
    const store = transaction.objectStore(STORES.EQUITY_CURVES)

    for (const entry of entries) {
      const storedEntry: StoredEquityCurveEntry = {
        ...entry,
        blockId,
      }
      await promisifyRequest(store.add(storedEntry))
    }
  })
}

/**
 * Get all equity curve entries for a block
 */
export async function getEquityCurvesByBlock(blockId: string): Promise<EquityCurveEntry[]> {
  return withReadTransaction(STORES.EQUITY_CURVES, async (transaction) => {
    const store = transaction.objectStore(STORES.EQUITY_CURVES)
    const index = store.index(INDEXES.EQUITY_CURVES_BY_BLOCK)
    const entries = await promisifyRequest(index.getAll(blockId))

    // Remove blockId before returning (not part of EquityCurveEntry interface)
    return entries.map(({ blockId: _blockId, ...entry }) => entry as EquityCurveEntry)
  })
}

/**
 * Get equity curve entries for a specific strategy in a block
 */
export async function getEquityCurvesByBlockAndStrategy(
  blockId: string,
  strategyName: string
): Promise<EquityCurveEntry[]> {
  return withReadTransaction(STORES.EQUITY_CURVES, async (transaction) => {
    const store = transaction.objectStore(STORES.EQUITY_CURVES)
    const index = store.index('composite_block_strategy')
    const entries = await promisifyRequest(index.getAll([blockId, strategyName]))

    return entries.map(({ blockId: _blockId, ...entry }) => entry as EquityCurveEntry)
  })
}

/**
 * Get count of equity curve entries for a block
 */
export async function getEquityCurveCountByBlock(blockId: string): Promise<number> {
  return withReadTransaction(STORES.EQUITY_CURVES, async (transaction) => {
    const store = transaction.objectStore(STORES.EQUITY_CURVES)
    const index = store.index(INDEXES.EQUITY_CURVES_BY_BLOCK)
    return promisifyRequest(index.count(blockId))
  })
}

/**
 * Get unique strategy names for a block's equity curves
 */
export async function getEquityCurveStrategiesByBlock(blockId: string): Promise<string[]> {
  return withReadTransaction(STORES.EQUITY_CURVES, async (transaction) => {
    const store = transaction.objectStore(STORES.EQUITY_CURVES)
    const index = store.index(INDEXES.EQUITY_CURVES_BY_BLOCK)
    const entries: StoredEquityCurveEntry[] = await promisifyRequest(index.getAll(blockId))

    // Extract unique strategy names
    const strategies = new Set(entries.map((entry) => entry.strategyName))
    return Array.from(strategies).sort()
  })
}

/**
 * Update equity curve entries for a block (replaces all existing entries)
 */
export async function updateEquityCurvesForBlock(
  blockId: string,
  entries: EquityCurveEntry[]
): Promise<void> {
  await withWriteTransaction(STORES.EQUITY_CURVES, async (transaction) => {
    const store = transaction.objectStore(STORES.EQUITY_CURVES)
    const index = store.index(INDEXES.EQUITY_CURVES_BY_BLOCK)

    // Delete existing entries
    const deleteRequest = index.openCursor(IDBKeyRange.only(blockId))
    await new Promise<void>((resolve, reject) => {
      deleteRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        } else {
          resolve()
        }
      }
      deleteRequest.onerror = () => reject(deleteRequest.error)
    })

    // Add new entries
    for (const entry of entries) {
      const storedEntry: StoredEquityCurveEntry = {
        ...entry,
        blockId,
      }
      await promisifyRequest(store.add(storedEntry))
    }
  })
}

/**
 * Delete all equity curve entries for a block
 */
export async function deleteEquityCurvesByBlock(blockId: string): Promise<void> {
  await withWriteTransaction(STORES.EQUITY_CURVES, async (transaction) => {
    const store = transaction.objectStore(STORES.EQUITY_CURVES)
    const index = store.index(INDEXES.EQUITY_CURVES_BY_BLOCK)

    const deleteRequest = index.openCursor(IDBKeyRange.only(blockId))
    await new Promise<void>((resolve, reject) => {
      deleteRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        } else {
          resolve()
        }
      }
      deleteRequest.onerror = () => reject(deleteRequest.error)
    })
  })
}

/**
 * Delete equity curve entries for a specific strategy in a block
 */
export async function deleteEquityCurvesByBlockAndStrategy(
  blockId: string,
  strategyName: string
): Promise<void> {
  await withWriteTransaction(STORES.EQUITY_CURVES, async (transaction) => {
    const store = transaction.objectStore(STORES.EQUITY_CURVES)
    const index = store.index('composite_block_strategy')

    const deleteRequest = index.openCursor(IDBKeyRange.only([blockId, strategyName]))
    await new Promise<void>((resolve, reject) => {
      deleteRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        } else {
          resolve()
        }
      }
      deleteRequest.onerror = () => reject(deleteRequest.error)
    })
  })
}

/**
 * Get date range for equity curves in a block
 */
export async function getEquityCurveDateRange(blockId: string): Promise<{
  start: Date | null
  end: Date | null
}> {
  return withReadTransaction(STORES.EQUITY_CURVES, async (transaction) => {
    const store = transaction.objectStore(STORES.EQUITY_CURVES)
    const index = store.index(INDEXES.EQUITY_CURVES_BY_BLOCK)
    const entries: StoredEquityCurveEntry[] = await promisifyRequest(index.getAll(blockId))

    if (entries.length === 0) {
      return { start: null, end: null }
    }

    const dates = entries.map((entry) => entry.date.getTime())
    return {
      start: new Date(Math.min(...dates)),
      end: new Date(Math.max(...dates)),
    }
  })
}
