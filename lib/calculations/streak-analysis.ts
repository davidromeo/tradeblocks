import { Trade } from '@/lib/models/trade'

export interface StreakData {
  type: 'win' | 'loss'
  length: number
  totalPl: number
  trades: Trade[]
}

export interface StreakDistribution {
  streaks: StreakData[]
  winDistribution: Record<number, number>
  lossDistribution: Record<number, number>
  statistics: {
    maxWinStreak: number
    maxLossStreak: number
    avgWinStreak: number
    avgLossStreak: number
    totalWinStreaks: number
    totalLossStreaks: number
  }
}

/**
 * Calculate comprehensive win/loss streak analysis.
 * Based on legacy/app/calculations/performance.py::calculate_streak_distributions
 */
export function calculateStreakDistributions(trades: Trade[]): StreakDistribution {
  if (!trades || trades.length === 0) {
    return {
      streaks: [],
      winDistribution: {},
      lossDistribution: {},
      statistics: {
        maxWinStreak: 0,
        maxLossStreak: 0,
        avgWinStreak: 0,
        avgLossStreak: 0,
        totalWinStreaks: 0,
        totalLossStreaks: 0,
      },
    }
  }

  // Sort trades chronologically
  const sortedTrades = [...trades].sort((a, b) => {
    const dateCompare = a.dateOpened.getTime() - b.dateOpened.getTime()
    if (dateCompare !== 0) return dateCompare
    return (a.timeOpened || '').localeCompare(b.timeOpened || '')
  })

  // Identify all streaks
  const streaks: StreakData[] = []
  let currentStreak: StreakData | null = null

  for (const trade of sortedTrades) {
    const isWin = trade.pl > 0
    const streakType: 'win' | 'loss' = isWin ? 'win' : 'loss'

    if (currentStreak && currentStreak.type === streakType) {
      // Continue current streak
      currentStreak.length += 1
      currentStreak.totalPl += trade.pl
      currentStreak.trades.push(trade)
    } else {
      // End current streak and start new one
      if (currentStreak) {
        streaks.push(currentStreak)
      }

      currentStreak = {
        type: streakType,
        length: 1,
        totalPl: trade.pl,
        trades: [trade],
      }
    }
  }

  // Don't forget the last streak
  if (currentStreak) {
    streaks.push(currentStreak)
  }

  // Calculate streak distribution
  const winStreaks = streaks.filter(s => s.type === 'win').map(s => s.length)
  const lossStreaks = streaks.filter(s => s.type === 'loss').map(s => s.length)

  // Count occurrences of each streak length
  const winDistribution: Record<number, number> = {}
  const lossDistribution: Record<number, number> = {}

  winStreaks.forEach(length => {
    winDistribution[length] = (winDistribution[length] || 0) + 1
  })

  lossStreaks.forEach(length => {
    lossDistribution[length] = (lossDistribution[length] || 0) + 1
  })

  // Calculate statistics
  const statistics = {
    maxWinStreak: winStreaks.length > 0 ? Math.max(...winStreaks) : 0,
    maxLossStreak: lossStreaks.length > 0 ? Math.max(...lossStreaks) : 0,
    avgWinStreak: winStreaks.length > 0 ? winStreaks.reduce((a, b) => a + b, 0) / winStreaks.length : 0,
    avgLossStreak: lossStreaks.length > 0 ? lossStreaks.reduce((a, b) => a + b, 0) / lossStreaks.length : 0,
    totalWinStreaks: winStreaks.length,
    totalLossStreaks: lossStreaks.length,
  }

  return {
    streaks,
    winDistribution,
    lossDistribution,
    statistics,
  }
}
