/**
 * Calendar Sensitivity Analysis Tests
 */

import { describe, it, expect } from '@jest/globals'
import { analyzeCalendarSensitivity, matchTradesToCalendarEvents } from '@/lib/calculations/calendar-sensitivity'
import { generateFOMCMeetings, generateUSHolidays, generateShortWeeks } from '@/lib/services/calendar-event-generator'
import type { Trade } from '@/lib/models/trade'
import type { CalendarEvent } from '@/lib/models/calendar-event'

describe('Calendar Sensitivity Analysis', () => {
  // Helper to create a test trade
  function createTrade(id: string, dateOpened: string, pl: number): Trade {
    return {
      id,
      dateOpened,
      timeOpened: '09:30:00',
      dateClosed: dateOpened,
      timeClosed: '16:00:00',
      pl,
      strategy: 'Test Strategy',
      underlying: 'SPX',
      openingCommissionsFees: 1,
      closingCommissionsFees: 1,
      openingQuantity: 1,
      closingQuantity: 0,
    } as Trade
  }

  describe('matchTradesToCalendarEvents', () => {
    it('should match trades to events on the same day', () => {
      const trades = [
        createTrade('1', '2024-01-31', 100),
        createTrade('2', '2024-02-01', -50),
      ]

      const events: CalendarEvent[] = [
        {
          id: 'fomc-1',
          type: 'fomc_meeting',
          name: 'FOMC Meeting',
          date: new Date('2024-01-31'),
          impact: 'high',
        },
      ]

      const matches = matchTradesToCalendarEvents(trades, events)

      expect(matches.size).toBe(1)
      expect(matches.has('1')).toBe(true)
      expect(matches.has('2')).toBe(false)
      
      const trade1Matches = matches.get('1')!
      expect(trade1Matches.length).toBe(1)
      expect(trade1Matches[0].event.type).toBe('fomc_meeting')
    })

    it('should match trades within event periods', () => {
      const trades = [
        createTrade('1', '2024-01-08', 100),
        createTrade('2', '2024-01-09', 50),
        createTrade('3', '2024-01-15', -50),
      ]

      const events: CalendarEvent[] = [
        {
          id: 'shortweek-1',
          type: 'short_week',
          name: 'Short Week',
          date: new Date('2024-01-08'),
          endDate: new Date('2024-01-12'),
          impact: 'high',
        },
      ]

      const matches = matchTradesToCalendarEvents(trades, events)

      expect(matches.size).toBe(2) // Trades 1 and 2 should match
      expect(matches.has('1')).toBe(true)
      expect(matches.has('2')).toBe(true)
      expect(matches.has('3')).toBe(false)
    })

    it('should handle trades with no matching events', () => {
      const trades = [
        createTrade('1', '2024-01-15', 100),
      ]

      const events: CalendarEvent[] = [
        {
          id: 'fomc-1',
          type: 'fomc_meeting',
          name: 'FOMC Meeting',
          date: new Date('2024-01-31'),
          impact: 'high',
        },
      ]

      const matches = matchTradesToCalendarEvents(trades, events)

      expect(matches.size).toBe(0)
    })
  })

  describe('analyzeCalendarSensitivity', () => {
    it('should calculate correct statistics for event vs normal days', () => {
      const trades = [
        createTrade('1', '2024-01-31', 100),  // FOMC day - winner
        createTrade('2', '2024-02-01', 50),   // Normal day - winner
        createTrade('3', '2024-02-02', -30),  // Normal day - loser
        createTrade('4', '2024-03-20', -50),  // FOMC day - loser
      ]

      const events: CalendarEvent[] = [
        {
          id: 'fomc-1',
          type: 'fomc_meeting',
          name: 'FOMC Jan',
          date: new Date('2024-01-31'),
          impact: 'high',
        },
        {
          id: 'fomc-2',
          type: 'fomc_meeting',
          name: 'FOMC Mar',
          date: new Date('2024-03-20'),
          impact: 'high',
        },
      ]

      const analysis = analyzeCalendarSensitivity(trades, events)

      expect(analysis.overall.totalTrades).toBe(4)
      expect(analysis.overall.avgPl).toBe(17.5) // (100 + 50 - 30 - 50) / 4

      const fomcStats = analysis.byEventType.get('fomc_meeting')!
      expect(fomcStats.tradesOnEventDays).toBe(2)
      expect(fomcStats.tradesOnNormalDays).toBe(2)
      expect(fomcStats.avgPlEventDays).toBe(25) // (100 - 50) / 2
      expect(fomcStats.avgPlNormalDays).toBe(10) // (50 - 30) / 2
      expect(fomcStats.winRateEventDays).toBe(50) // 1 winner out of 2
      expect(fomcStats.winRateNormalDays).toBe(50) // 1 winner out of 2

      expect(analysis.normalDays.tradeCount).toBe(2)
      expect(analysis.normalDays.avgPl).toBe(10)
      expect(analysis.normalDays.winRate).toBe(50)
    })

    it('should handle empty trades array', () => {
      const trades: Trade[] = []
      const events = generateFOMCMeetings(2024)

      const analysis = analyzeCalendarSensitivity(trades, events)

      expect(analysis.overall.totalTrades).toBe(0)
      expect(analysis.overall.avgPl).toBe(0)
      expect(analysis.overall.winRate).toBe(0)
    })

    it('should handle empty events array', () => {
      const trades = [
        createTrade('1', '2024-01-15', 100),
        createTrade('2', '2024-02-15', -50),
      ]
      const events: CalendarEvent[] = []

      const analysis = analyzeCalendarSensitivity(trades, events)

      expect(analysis.overall.totalTrades).toBe(2)
      expect(analysis.byEventType.size).toBe(0)
      expect(analysis.normalDays.tradeCount).toBe(2)
      expect(analysis.normalDays.avgPl).toBe(25) // (100 - 50) / 2
    })
  })

  describe('Calendar Event Generator', () => {
    it('should generate FOMC meetings for a year', () => {
      const meetings = generateFOMCMeetings(2024)
      
      expect(meetings.length).toBe(8) // 8 FOMC meetings per year
      expect(meetings[0].type).toBe('fomc_meeting')
      expect(meetings[0].impact).toBe('high')
    })

    it('should generate US holidays for a year', () => {
      const holidays = generateUSHolidays(2024)
      
      expect(holidays.length).toBeGreaterThanOrEqual(10)
      expect(holidays.some(h => h.name.includes('New Year'))).toBe(true)
      expect(holidays.some(h => h.name.includes('Independence Day'))).toBe(true)
      expect(holidays.some(h => h.name.includes('Thanksgiving'))).toBe(true)
      expect(holidays.some(h => h.name.includes('Christmas'))).toBe(true)
    })

    it('should generate short weeks based on holidays', () => {
      const shortWeeks = generateShortWeeks(2024)
      
      expect(shortWeeks.length).toBeGreaterThan(0)
      expect(shortWeeks[0].type).toBe('short_week')
      expect(shortWeeks[0].endDate).toBeDefined()
    })
  })
})
