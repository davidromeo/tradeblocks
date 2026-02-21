import {
  isTatFormat,
  convertTatRowToReportingTrade,
  buildTatLegsString,
} from '../../packages/lib/processing/tat-adapter'

// Sample TAT CSV row (from real export)
const SAMPLE_TAT_ROW: Record<string, string> = {
  Account: 'IB:U***1234',
  Date: '1/30/2026',
  TimeOpened: '10:04 AM',
  TimeClosed: '3:51 PM',
  TradeType: 'DoubleCalendar',
  StopType: 'Vertical',
  StopMultiple: '0',
  PriceOpen: '-53.1',
  PriceClose: '57.05',
  PriceStopTarget: '',
  TotalPremium: '-26550',
  Qty: '5',
  Commission: '45.65',
  ProfitLoss: '1929.35',
  Status: 'Manual Closed',
  ShortPut: '6945',
  LongPut: '6945',
  ShortCall: '6945',
  LongCall: '6945',
  BuyingPower: '26550',
  StopMultipleResult: '0',
  Slippage: '0',
  StopTrigger: 'Single Bid',
  PutDelta: '-0.504191198',
  CallDelta: '0.495787545',
  Template: 'MEDC 3/7',
  Strategy: 'DC',
  PriceLong: '113.872',
  PriceShort: '60.772',
  OpenDate: '2026-01-30',
  OpenTime: '10:04:13',
  CloseDate: '2026-01-30',
  CloseTime: '15:51:13',
  TradeID: '15780',
  ParentTaskID: '0',
  ContractCount: '20',
  UnderlyingSymbol: 'SPX',
  CustomLeg1: '',
  CustomLeg2: '',
  CustomLeg3: '',
  CustomLeg4: '',
}

// TAT headers (from real export)
const TAT_HEADERS = [
  'Account', 'Date', 'TimeOpened', 'TimeClosed', 'TradeType', 'StopType',
  'StopMultiple', 'PriceOpen', 'PriceClose', 'PriceStopTarget', 'TotalPremium',
  'Qty', 'Commission', 'ProfitLoss', 'Status', 'ShortPut', 'LongPut',
  'ShortCall', 'LongCall', 'BuyingPower', 'StopMultipleResult', 'Slippage',
  'StopTrigger', 'PutDelta', 'CallDelta', 'Template', 'Strategy', 'PriceLong',
  'PriceShort', 'OpenDate', 'OpenTime', 'CloseDate', 'CloseTime', 'TradeID',
  'ParentTaskID', 'ContractCount', 'UnderlyingSymbol',
]

// OO reporting headers
const OO_HEADERS = [
  'Date Opened', 'Time Opened', 'Opening Price', 'Legs', 'Premium',
  'Closing Price', 'Date Closed', 'Time Closed', 'P/L', 'Strategy',
  'No. of Contracts',
]

describe('TAT Adapter', () => {
  describe('isTatFormat', () => {
    it('detects TAT format from headers', () => {
      expect(isTatFormat(TAT_HEADERS)).toBe(true)
    })

    it('rejects OO format headers', () => {
      expect(isTatFormat(OO_HEADERS)).toBe(false)
    })

    it('rejects empty headers', () => {
      expect(isTatFormat([])).toBe(false)
    })

    it('is case-insensitive', () => {
      expect(isTatFormat(TAT_HEADERS.map(h => h.toLowerCase()))).toBe(true)
    })
  })

  describe('buildTatLegsString', () => {
    it('builds legs from all four strikes (MEDC-style same strikes)', () => {
      const legs = buildTatLegsString({
        ShortPut: '6945', LongPut: '6945',
        ShortCall: '6945', LongCall: '6945',
        UnderlyingSymbol: 'SPX', TradeType: 'DoubleCalendar',
      })
      expect(legs).toContain('6945')
      expect(legs).toContain('SPX')
    })

    it('builds legs from different strikes (wide DC)', () => {
      const legs = buildTatLegsString({
        ShortPut: '6905', LongPut: '6905',
        ShortCall: '7125', LongCall: '7125',
        UnderlyingSymbol: 'SPX', TradeType: 'DoubleCalendar',
      })
      expect(legs).toContain('6905')
      expect(legs).toContain('7125')
      expect(legs).toContain('SPX')
    })

    it('handles missing strikes gracefully', () => {
      const legs = buildTatLegsString({
        ShortPut: '6945', LongPut: '6945',
        ShortCall: '', LongCall: '',
        UnderlyingSymbol: 'SPX', TradeType: 'PutCalendar',
      })
      expect(legs).toContain('6945')
      expect(legs).not.toContain('undefined')
    })

    it('handles zero strikes as missing', () => {
      const legs = buildTatLegsString({
        ShortPut: '0', LongPut: '0',
        ShortCall: '6945', LongCall: '6945',
        UnderlyingSymbol: 'SPX', TradeType: 'CallCalendar',
      })
      expect(legs).toContain('6945')
    })

    it('handles missing UnderlyingSymbol', () => {
      const legs = buildTatLegsString({
        ShortPut: '6945', LongPut: '6945',
        ShortCall: '6945', LongCall: '6945',
        UnderlyingSymbol: '', TradeType: 'DoubleCalendar',
      })
      expect(legs).toContain('6945')
      expect(legs.length).toBeGreaterThan(0)
    })
  })

  describe('convertTatRowToReportingTrade', () => {
    it('converts a complete TAT row to ReportingTrade', () => {
      const trade = convertTatRowToReportingTrade(SAMPLE_TAT_ROW)

      expect(trade).not.toBeNull()
      expect(trade!.strategy).toBe('DC')
      expect(trade!.pl).toBe(1929.35)
      expect(trade!.numContracts).toBe(5) // Qty, NOT ContractCount
      expect(trade!.initialPremium).toBe(-26550)
      expect(trade!.reasonForClose).toBe('Manual Closed')
    })

    it('uses OpenDate for dateOpened (precise format)', () => {
      const trade = convertTatRowToReportingTrade(SAMPLE_TAT_ROW)
      expect(trade!.dateOpened.getFullYear()).toBe(2026)
      expect(trade!.dateOpened.getMonth()).toBe(0)
      expect(trade!.dateOpened.getDate()).toBe(30)
    })

    it('falls back to Date field when OpenDate is missing', () => {
      const row = { ...SAMPLE_TAT_ROW, OpenDate: '' }
      const trade = convertTatRowToReportingTrade(row)
      expect(trade!.dateOpened.getFullYear()).toBe(2026)
      expect(trade!.dateOpened.getMonth()).toBe(0)
      expect(trade!.dateOpened.getDate()).toBe(30)
    })

    it('formats timeOpened from OpenTime (HH:MM:SS -> H:MM AM/PM)', () => {
      const trade = convertTatRowToReportingTrade(SAMPLE_TAT_ROW)
      expect(trade!.timeOpened).toBe('10:04 AM')
    })

    it('falls back to TimeOpened field when OpenTime is missing', () => {
      const row = { ...SAMPLE_TAT_ROW, OpenTime: '' }
      const trade = convertTatRowToReportingTrade(row)
      expect(trade!.timeOpened).toBe('10:04 AM')
    })

    it('uses Qty for numContracts (spreads), not ContractCount (legs)', () => {
      const trade = convertTatRowToReportingTrade(SAMPLE_TAT_ROW)
      expect(trade!.numContracts).toBe(5)
    })

    it('uses abs(PriceOpen) for openingPrice', () => {
      const trade = convertTatRowToReportingTrade(SAMPLE_TAT_ROW)
      expect(trade!.openingPrice).toBe(53.1)
    })

    it('maps PriceClose to closingPrice', () => {
      const trade = convertTatRowToReportingTrade(SAMPLE_TAT_ROW)
      expect(trade!.closingPrice).toBe(57.05)
    })

    it('maps CloseDate to dateClosed', () => {
      const trade = convertTatRowToReportingTrade(SAMPLE_TAT_ROW)
      expect(trade!.dateClosed).toBeDefined()
      expect(trade!.dateClosed!.getFullYear()).toBe(2026)
      expect(trade!.dateClosed!.getMonth()).toBe(0)
      expect(trade!.dateClosed!.getDate()).toBe(30)
    })

    it('formats timeClosed from CloseTime', () => {
      const trade = convertTatRowToReportingTrade(SAMPLE_TAT_ROW)
      expect(trade!.timeClosed).toBe('3:51 PM')
    })

    it('constructs legs string from strike columns', () => {
      const trade = convertTatRowToReportingTrade(SAMPLE_TAT_ROW)
      expect(trade!.legs).toBeTruthy()
      expect(trade!.legs.length).toBeGreaterThan(0)
      expect(trade!.legs).toContain('6945')
    })

    it('returns null for rows missing ProfitLoss', () => {
      const row = { ...SAMPLE_TAT_ROW, ProfitLoss: '' }
      const trade = convertTatRowToReportingTrade(row)
      expect(trade).toBeNull()
    })

    it('returns null for rows missing Date/OpenDate', () => {
      const row = { ...SAMPLE_TAT_ROW, OpenDate: '', Date: '' }
      const trade = convertTatRowToReportingTrade(row)
      expect(trade).toBeNull()
    })

    it('handles PM times after noon correctly', () => {
      const row = { ...SAMPLE_TAT_ROW, OpenTime: '15:11:02' }
      const trade = convertTatRowToReportingTrade(row)
      expect(trade!.timeOpened).toBe('3:11 PM')
    })

    it('handles midnight (00:xx) correctly', () => {
      const row = { ...SAMPLE_TAT_ROW, OpenTime: '00:30:00' }
      const trade = convertTatRowToReportingTrade(row)
      expect(trade!.timeOpened).toBe('12:30 AM')
    })

    it('handles noon (12:xx) correctly', () => {
      const row = { ...SAMPLE_TAT_ROW, OpenTime: '12:38:19' }
      const trade = convertTatRowToReportingTrade(row)
      expect(trade!.timeOpened).toBe('12:38 PM')
    })
  })
})
