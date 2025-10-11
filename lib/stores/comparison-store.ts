import { create } from 'zustand'
import { StrategyAlignment } from '@/lib/models/strategy-alignment'
import {
  ReconciliationPayload,
  buildTradeReconciliation,
} from '@/lib/services/trade-reconciliation'

interface ComparisonStoreState {
  isLoading: boolean
  error: string | null
  data: ReconciliationPayload | null
  lastBlockId: string | null
  refresh: (blockId: string, alignments: StrategyAlignment[]) => Promise<void>
  reset: () => void
}

export const useComparisonStore = create<ComparisonStoreState>((set) => ({
  isLoading: false,
  error: null,
  data: null,
  lastBlockId: null,

  refresh: async (blockId, alignments) => {
    set({ isLoading: true, error: null, lastBlockId: blockId })

    try {
      const payload = await buildTradeReconciliation(blockId, alignments)
      set({ data: payload, isLoading: false })
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to build reconciliation',
        isLoading: false,
      })
    }
  },

  reset: () => {
    set({ isLoading: false, error: null, data: null, lastBlockId: null })
  },
}))

export type { AlignedTradeSet } from '@/lib/services/trade-reconciliation'
