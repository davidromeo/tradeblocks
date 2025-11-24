# Calendar View - Trade Visualization and Daily Activity

## Summary
Implement a calendar-based visualization for trades that shows daily trading activity, P&L, and basic metrics in a familiar calendar grid layout.

## Context
Traders need a visual way to understand their trading patterns over time, similar to platforms like TradeZella. This issue covers the base calendar implementation without the advanced utilization analytics (separate issue).

## Requirements

### Core Calendar Features
- Monthly calendar grid with navigation
- Visual indicators for each trading day:
  - P&L amount (color-coded green/red)
  - Trade count badge
  - Mini sparkline for intraday equity curve (optional enhancement)
- View modes: Month, Quarter, Year
- Color schemes: P&L, Trade Count, Win Rate

### Daily Detail Modal
Click any day to see:
- List of all trades (opened/closed)
- Total P&L breakdown
- Trade timing timeline
- Reconciliation with daily logs (if available)
- Links to view individual trades

### UI Layout
```
┌─────────────────────────────────────────────┐
│ Trade Calendar - [Block Name]               │
├─────────────────────────────────────────────┤
│ [◀] November 2024 [▶]   View: [Month ▼]    │
├─────────────────────────────────────────────┤
│ Sun   Mon   Tue   Wed   Thu   Fri   Sat    │
│       1     2     3     4     5     6       │
│      +450  -200  +800   0   +1200          │
│       (3)   (2)   (4)  (0)   (5)           │
└─────────────────────────────────────────────┘
```

### Files to Create
```
app/(platform)/calendar/page.tsx
components/calendar/trade-calendar.tsx
components/calendar/day-detail-modal.tsx
lib/services/calendar-data-service.ts
lib/stores/calendar-store.ts
```

## Acceptance Criteria
- [ ] Calendar displays all trading days correctly
- [ ] P&L amounts match trade calculations
- [ ] Trade counts are accurate
- [ ] Navigation between months/quarters/years works
- [ ] Daily detail modal shows complete information
- [ ] Reconciliation with daily logs when available
- [ ] Responsive design for mobile/tablet
- [ ] Print-friendly layout
- [ ] Calendar loads in < 2 seconds for 1 year of data

## UI/UX Requirements
- Follow existing TradeBlocks design patterns
- Use shadcn/ui calendar components as base
- Support dark/light mode
- Clear visual hierarchy
- Intuitive navigation

## Dependencies
- Existing trade and daily log data
- Performance snapshot service for data aggregation
- shadcn/ui calendar component

## Testing
- Unit tests for date aggregation logic
- Visual regression tests for calendar rendering
- Integration tests with trade data
- Mobile responsiveness tests