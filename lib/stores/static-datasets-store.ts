/**
 * Static Datasets Store
 *
 * Zustand store for managing static datasets UI state and coordinating
 * with IndexedDB storage.
 */

import { create } from 'zustand'
import type { StaticDataset, StaticDatasetRow, MatchStrategy } from '../models/static-dataset'
import {
  getAllStaticDatasets,
  createStaticDataset,
  updateStaticDatasetMatchStrategy,
  updateStaticDatasetName,
  isDatasetNameTaken,
} from '../db/static-datasets-store'
import {
  addStaticDatasetRows,
  getStaticDatasetRows,
  deleteStaticDatasetWithRows,
} from '../db/static-dataset-rows-store'
import {
  processStaticDatasetFile,
  validateDatasetName,
} from '../processing/static-dataset-processor'
import type { ParseProgress } from '../processing/csv-parser'

interface StaticDatasetsState {
  // State
  datasets: StaticDataset[]
  isLoading: boolean
  isInitialized: boolean
  error: string | null

  // Cached rows for preview (loaded on demand)
  cachedRows: Map<string, StaticDatasetRow[]>

  // Actions
  loadDatasets: () => Promise<void>
  uploadDataset: (
    file: File,
    name: string,
    onProgress?: (progress: ParseProgress) => void
  ) => Promise<{ success: boolean; error?: string; dataset?: StaticDataset }>
  deleteDataset: (id: string) => Promise<void>
  updateMatchStrategy: (id: string, strategy: MatchStrategy) => Promise<void>
  renameDataset: (id: string, newName: string) => Promise<{ success: boolean; error?: string }>
  getDatasetRows: (id: string) => Promise<StaticDatasetRow[]>
  clearCachedRows: (id?: string) => void
  validateName: (name: string, excludeId?: string) => Promise<{ valid: boolean; error?: string }>
}

export const useStaticDatasetsStore = create<StaticDatasetsState>((set, get) => ({
  // Initial state
  datasets: [],
  isLoading: false,
  isInitialized: false,
  error: null,
  cachedRows: new Map(),

  // Load all datasets from IndexedDB
  loadDatasets: async () => {
    const state = get()

    // Prevent multiple concurrent loads
    if (state.isLoading) {
      return
    }

    set({ isLoading: true, error: null })

    try {
      const datasets = await getAllStaticDatasets()
      set({ datasets, isLoading: false, isInitialized: true })
    } catch (error) {
      console.error('Failed to load static datasets:', error)
      set({
        error: error instanceof Error ? error.message : 'Failed to load datasets',
        isLoading: false,
        isInitialized: true,
      })
    }
  },

  // Upload a new dataset
  uploadDataset: async (file, name, onProgress) => {
    // Validate name format
    const nameValidation = validateDatasetName(name)
    if (!nameValidation.valid) {
      return { success: false, error: nameValidation.error }
    }

    // Check if name is taken
    const nameTaken = await isDatasetNameTaken(name)
    if (nameTaken) {
      return { success: false, error: `A dataset named "${name}" already exists` }
    }

    try {
      // Process the CSV file
      const result = await processStaticDatasetFile(file, {
        name,
        fileName: file.name,
        progressCallback: onProgress,
      })

      // Check for errors
      if (result.errors.length > 0) {
        return { success: false, error: result.errors.join('; ') }
      }

      if (result.rows.length === 0) {
        return { success: false, error: 'No valid data rows found in file' }
      }

      // Save to IndexedDB
      await createStaticDataset(result.dataset)
      await addStaticDatasetRows(result.dataset.id, result.rows)

      // Update state
      set((state) => ({
        datasets: [result.dataset, ...state.datasets],
      }))

      return { success: true, dataset: result.dataset }
    } catch (error) {
      console.error('Failed to upload dataset:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload dataset',
      }
    }
  },

  // Delete a dataset
  deleteDataset: async (id) => {
    try {
      await deleteStaticDatasetWithRows(id)

      set((state) => {
        // Remove from cached rows
        const newCachedRows = new Map(state.cachedRows)
        newCachedRows.delete(id)

        return {
          datasets: state.datasets.filter((d) => d.id !== id),
          cachedRows: newCachedRows,
        }
      })
    } catch (error) {
      console.error('Failed to delete dataset:', error)
      set({
        error: error instanceof Error ? error.message : 'Failed to delete dataset',
      })
    }
  },

  // Update match strategy
  updateMatchStrategy: async (id, strategy) => {
    try {
      await updateStaticDatasetMatchStrategy(id, strategy)

      set((state) => ({
        datasets: state.datasets.map((d) =>
          d.id === id ? { ...d, matchStrategy: strategy } : d
        ),
      }))
    } catch (error) {
      console.error('Failed to update match strategy:', error)
      set({
        error: error instanceof Error ? error.message : 'Failed to update match strategy',
      })
    }
  },

  // Rename a dataset
  renameDataset: async (id, newName) => {
    // Validate name format
    const nameValidation = validateDatasetName(newName)
    if (!nameValidation.valid) {
      return { success: false, error: nameValidation.error }
    }

    // Check if name is taken (excluding current dataset)
    const nameTaken = await isDatasetNameTaken(newName, id)
    if (nameTaken) {
      return { success: false, error: `A dataset named "${newName}" already exists` }
    }

    try {
      await updateStaticDatasetName(id, newName)

      set((state) => ({
        datasets: state.datasets.map((d) =>
          d.id === id ? { ...d, name: newName } : d
        ),
      }))

      return { success: true }
    } catch (error) {
      console.error('Failed to rename dataset:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to rename dataset',
      }
    }
  },

  // Get rows for a dataset (with caching)
  getDatasetRows: async (id) => {
    const state = get()

    // Return cached rows if available
    const cached = state.cachedRows.get(id)
    if (cached) {
      return cached
    }

    // Load from IndexedDB
    const rows = await getStaticDatasetRows(id)

    // Cache the rows
    set((state) => {
      const newCachedRows = new Map(state.cachedRows)
      newCachedRows.set(id, rows)
      return { cachedRows: newCachedRows }
    })

    return rows
  },

  // Clear cached rows (all or for specific dataset)
  clearCachedRows: (id) => {
    set((state) => {
      if (id) {
        const newCachedRows = new Map(state.cachedRows)
        newCachedRows.delete(id)
        return { cachedRows: newCachedRows }
      }
      return { cachedRows: new Map() }
    })
  },

  // Validate a dataset name
  validateName: async (name, excludeId) => {
    // Validate format
    const formatValidation = validateDatasetName(name)
    if (!formatValidation.valid) {
      return formatValidation
    }

    // Check uniqueness
    const nameTaken = await isDatasetNameTaken(name, excludeId)
    if (nameTaken) {
      return { valid: false, error: `A dataset named "${name}" already exists` }
    }

    return { valid: true }
  },
}))

/**
 * Hook to get a specific dataset by ID
 */
export function useStaticDataset(id: string): StaticDataset | undefined {
  return useStaticDatasetsStore((state) =>
    state.datasets.find((d) => d.id === id)
  )
}

/**
 * Hook to get all datasets
 */
export function useAllStaticDatasets(): StaticDataset[] {
  return useStaticDatasetsStore((state) => state.datasets)
}

/**
 * Hook to check if datasets are loaded
 */
export function useStaticDatasetsInitialized(): boolean {
  return useStaticDatasetsStore((state) => state.isInitialized)
}
