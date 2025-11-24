# Block Operations - Combine Multiple Blocks

## Summary
Implement functionality to combine multiple trading blocks into a unified portfolio block for aggregate analysis.

## Context
Users need to analyze multiple strategies together that were uploaded as separate blocks. This feature allows non-destructive combination while preserving original data.

## Requirements

### Core Functionality
- Select multiple blocks from the block list
- Merge trades preserving all original data
- Maintain/prefix strategy labels appropriately
- Combine daily logs chronologically (when present)
- Recalculate portfolio statistics for combined dataset

### Database Schema Extension
```typescript
interface BlockRelationship {
  id: string;
  type: 'combined';
  parentBlockIds: string[];  // Original blocks
  childBlockId: string;       // Result block
  createdAt: Date;
  metadata: {
    operationType: 'combine';
    strategyMapping?: Record<string, string>;
  };
}

// Extension to ProcessedBlock
interface ProcessedBlock {
  // existing fields...
  derivedFrom?: {
    type: 'combined';
    sourceBlockIds: string[];
    relationshipId: string;
  };
}
```

### UI Requirements
**Block List Page**:
- Multi-select mode with checkboxes
- "Combine Selected" button (appears when 2+ blocks selected)
- Visual indicator for derived blocks

**Combine Dialog**:
- List selected blocks with trade counts
- New block name input
- Strategy naming options:
  - Keep original names
  - Prefix with block name
  - Custom mapping
- Daily log combination option

### Files to Create
```
lib/services/block-operations.ts
components/blocks/block-combiner.tsx
```

## Acceptance Criteria
- [ ] Can select and combine 2+ blocks
- [ ] Combined block shows correct aggregate statistics
- [ ] No data loss during combination
- [ ] Original blocks remain unchanged
- [ ] Strategy labels properly maintained/prefixed
- [ ] Daily logs combined correctly (if present)
- [ ] Can delete combined block without affecting originals
- [ ] Combine operation completes in < 5 seconds for 10,000 trades

## Edge Cases
- Overlapping date ranges (warn user)
- Different account currencies (warn user)
- Missing strategy fields (use block name as strategy)
- Incompatible daily logs (fall back to trade-based calculations)

## Dependencies
- Existing block store and database operations
- Portfolio stats calculator

## Testing
- Unit tests for combine logic
- Integration tests with IndexedDB
- Edge case validation