# External Integrations

**Analysis Date:** 2026-01-11

## APIs & External Services

**None Detected**

TradeBlocks is a **100% client-side application with zero external service dependencies**.

## Data Storage

**Databases:**
- IndexedDB (browser-native) - Primary data store
  - Connection: Browser API, no external connection
  - Client: Custom wrapper in `lib/db/index.ts`
  - Database: `TradeBlocksDB` v4
  - Object stores: blocks, trades, dailyLogs, calculations, reportingLogs, walkForwardAnalyses, staticDatasets, staticDatasetRows

**File Storage:**
- Not applicable - All data stored in browser IndexedDB
- CSV files uploaded and processed client-side

**Caching:**
- IndexedDB-based caching for calculated results
- Stores: `performance-snapshot-cache.ts`, `combined-trades-cache.ts`

## Authentication & Identity

**Auth Provider:**
- None - Application runs entirely client-side with no user accounts

**OAuth Integrations:**
- None

## Monitoring & Observability

**Error Tracking:**
- None - Console logging only

**Analytics:**
- None - No telemetry or tracking

**Logs:**
- Console.log for development
- No production logging infrastructure

## CI/CD & Deployment

**Hosting:**
- Deployable to any static host (Vercel, Netlify, GitHub Pages)
- No backend required

**CI Pipeline:**
- GitHub Actions (`.github/workflows/ci.yml`)
  - Workflows: lint → build
  - Node.js 20 on Ubuntu
  - No deployment step configured

## Environment Configuration

**Development:**
- Required env vars: None
- Secrets: None required
- Mock services: fake-indexeddb for testing

**Staging:**
- Not applicable - No external services to configure

**Production:**
- No secrets management needed
- Pure static deployment
- All data stays in user's browser

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Data Flow Summary

```
User Upload CSV Files
         ↓
Browser IndexedDB (client-side storage)
         ↓
In-Memory Calculations (mathjs library)
         ↓
UI Rendering (React + Plotly)
         ↓
Browser Download CSV Export (optional)
```

## Explicitly Not Integrated

The following services were searched for and NOT found:

- **Authentication**: No Auth0, Firebase Auth, NextAuth.js, Supabase Auth
- **Databases**: No Supabase, Firebase, MongoDB, PostgreSQL
- **APIs**: No Stripe, Twilio, SendGrid, external APIs
- **Analytics**: No Google Analytics, Mixpanel, Segment, Sentry
- **Cloud Storage**: No AWS S3, Google Cloud Storage
- **Real-time**: No WebSocket, Socket.io, Pusher
- **HTTP Clients**: No axios (uses native fetch only for internal operations)

## Security Implications

- No external API keys or secrets required
- No authentication mechanisms
- All data processing local to browser
- Data never transmitted to external servers
- GDPR/privacy compliant by design (zero data collection)
- No third-party cookies or tracking

## Internal Data Processing

The application performs internal calculations (not external integrations):

- **CSV Parsing**: `lib/processing/csv-parser.ts`
- **Trade Processing**: `lib/processing/trade-processor.ts`
- **Portfolio Statistics**: `lib/calculations/portfolio-stats.ts`
- **Risk Analysis**: `lib/calculations/monte-carlo.ts`, `lib/calculations/kelly.ts`
- **Walk-Forward Analysis**: `lib/calculations/walk-forward-analyzer.ts`

---

*Integration audit: 2026-01-11*
*Update when adding/removing external services*
