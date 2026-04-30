# Edward Trading Desk Snapshot Contract

This document defines the JSON contract future Edward must emit for the standalone Edward Trading Desk app.

## Endpoint

- **Path:** `/api/trading-desk/snapshot`
- **Method:** `GET`
- **Content-Type:** `application/json`
- **Contract version:** `trading-desk-snapshot.v1`
- **Consumer:** `src/data/tradingDeskAdapter.ts`
- **Runtime validation:** zod schema in `src/data/tradingDeskAdapter.ts`

The endpoint is not connected yet. This contract is the adapter boundary for the future live Edward integration.

## Freshness rules

- `timestamp` must be an ISO-8601 datetime string.
- A live snapshot is fresh when `now - timestamp <= 300 seconds`.
- Stale threshold: **5 minutes / 300 seconds**.
- If `systemStatus === "STALE"`, the UI resolves the data mode to `live_stale` even if the timestamp is recent.
- If `systemStatus === "OFFLINE"`, the UI resolves the data mode to `live_unavailable`.
- If JSON validation fails, the UI resolves to `validation_error` and shows fallback data plus validation issues.

## Data modes

The UI supports these modes:

| Mode | Meaning |
| --- | --- |
| `live_available` | Live Edward snapshot validated and timestamp is fresh. |
| `live_stale` | Snapshot validated but is stale by timestamp or explicit `systemStatus: "STALE"`. |
| `live_unavailable` | Edward is unreachable or returned a valid unavailable/offline state. |
| `demo_mode` | Local demo/visual testing only. Future Edward should not emit this for live data. |
| `validation_error` | Incoming payload failed runtime validation. Future Edward should not emit this; the adapter sets it. |

## Required top-level fields

```ts
{
  contractVersion: "trading-desk-snapshot.v1";
  timestamp: string;
  systemStatus: "WATCHING" | "OFFLINE" | "STALE" | "NO_OPEN_POSITION";
  portfolio: PortfolioSnapshot;
  riskState: RiskState;
  softLandingPace: SoftLandingPace;
  openPositions: TradingPosition[];
  edwardVerdict: EdwardVerdict;
  wrongBehavior: WrongBehavior;
  recheckTrigger: RecheckTrigger;
  watchlistSummary: WatchlistSummary;
  watchlist: WatchlistItem[];
}
```

`mode` is accepted but optional. The adapter resolves the effective UI data mode from source, timestamp, and `systemStatus`.

## Nullable / optional fields

- `activePositionFocus?: TradingPosition | null`
  - Use `null` when there is no active trade.
- `tradeObjective?: TradeObjective`
- `marketMovement?: MarketMovement`
- Position numeric management fields are optional when unavailable:
  - `size`
  - `leverage`
  - `margin`
  - `liquidationPrice`
  - `unrealizedPnL`
  - `tp1`
  - `stop`
  - `extendedTarget`
  - distance/contribution math fields
- `recheckTrigger.priceLevel?: number`
- `recheckTrigger.timeframe?: "15m" | "1H" | "4H" | "BTC" | "portfolio"`
- `watchlistItem.direction?: "LONG" | "SHORT"`
- `watchlistItem.note?: string`

## Required nested fields

### PortfolioSnapshot

```ts
{
  currentPV: number;
  equity: number;
  startingPV: number;
  baselineDate: string;
  exposureStatus: "SAFE" | "ELEVATED" | "OVEREXPOSED" | "CRITICAL";
}
```

Optional portfolio fields: `dailyPnL`, `unrealizedPnL`, `marginUsed`, `availableBalance`.

### RiskState

```ts
{
  exposureStatus: "SAFE" | "ELEVATED" | "OVEREXPOSED" | "CRITICAL";
  summary: string;
}
```

### SoftLandingPace

```ts
{
  baselinePV: number;
  baselineDate: string;
  daysSinceBaseline: number;
  currentPV: number;
  moonDailyRate: 0.006;
  sunDailyRate: 0.008;
  moonTargetPVToday: number;
  sunTargetPVToday: number;
  moonGapDollars: number;
  sunGapDollars: number;
  moonGapPct: number;
  sunGapPct: number;
  moonDailyTargetDollars: number;
  sunDailyTargetDollars: number;
  moonStatus: "AHEAD" | "BEHIND";
  sunStatus: "AHEAD" | "BEHIND";
}
```

### TradingPosition

Required: `symbol`, `direction`, `entryPrice`, `currentPrice`.

Optional: `size`, `leverage`, `margin`, `liquidationPrice`, `unrealizedPnL`, `tp1`, `stop`, `extendedTarget`, `distanceToTP1Pct`, `distanceToStopPct`, `estimatedProfitAtTP1`, `estimatedLossAtStop`, `portfolioGainAtTP1Pct`, `portfolioLossAtStopPct`, `tp1ContributionToMoonDailyTargetPct`, `tp1ContributionToSunDailyTargetPct`, `tp1ContributionToMoonGapPct`, `tp1ContributionToSunGapPct`.

### EdwardVerdict

Required: `action`, `confidence`, `movementClassification`, `summary`, `whatIWouldDo`, `addGuidance`, `riskCommentary`.

Allowed `action` values:

- `HOLD`
- `HOLD BUT DO NOT ADD`
- `ADD ONLY ON RETEST`
- `ADD NOW`
- `TAKE PARTIAL`
- `MOVE STOP / PROTECT`
- `REDUCE`
- `EXIT`
- `WAIT / NO ACTION`

Allowed confidence values: `LOW`, `MEDIUM`, `HIGH`.

Allowed movement classifications: `CLEAN MOVE`, `HEALTHY PULLBACK`, `STALLING`, `CHOPPING`, `REJECTING`, `THESIS WEAKENING`, `THESIS FAILED`.

### WrongBehavior

```ts
{ message: string }
```

This is required. Trading systems should not hide operator drift warnings.

### RecheckTrigger

```ts
{
  condition: string;
  priceLevel?: number;
  timeframe?: "15m" | "1H" | "4H" | "BTC" | "portfolio";
}
```

### WatchlistSummary

```ts
{
  total: number;
  ready: number;
  conditional: number;
  blocked: number;
  summary: string;
}
```

### WatchlistItem

```ts
{
  symbol: string;
  status: "READY" | "WATCHLIST" | "CONDITIONAL" | "EXTENDED" | "TOO LATE" | "SKIP";
  direction?: "LONG" | "SHORT";
  note?: string;
}
```

## Validation behavior

1. Adapter fetches `/api/trading-desk/snapshot`.
2. Non-2xx HTTP response becomes `live_unavailable`.
3. 2xx JSON response is validated with zod.
4. Invalid JSON shape becomes `validation_error`.
5. Valid snapshot is resolved to one of:
   - `live_available`
   - `live_stale`
   - `live_unavailable`
6. UI displays a prominent data-state banner. Stale, unavailable, and validation failure are intentionally loud.

## Example valid response

Canonical exported fixture: `src/data/exampleSnapshots.ts#liveAvailableExample`.

```json
{
  "contractVersion": "trading-desk-snapshot.v1",
  "timestamp": "2026-04-30T14:58:30.000Z",
  "mode": "live_available",
  "systemStatus": "WATCHING",
  "portfolio": {
    "currentPV": 2658.42,
    "equity": 2658.42,
    "startingPV": 2373,
    "baselineDate": "2026-02-16",
    "dailyPnL": 28.4,
    "unrealizedPnL": 41.62,
    "marginUsed": 412,
    "availableBalance": 2246.42,
    "exposureStatus": "SAFE"
  },
  "riskState": {
    "exposureStatus": "SAFE",
    "summary": "Exposure is controlled; no backend/live broker authority is connected."
  },
  "softLandingPace": {
    "baselinePV": 2373,
    "baselineDate": "2026-02-16",
    "daysSinceBaseline": 73,
    "currentPV": 2658.42,
    "moonDailyRate": 0.006,
    "sunDailyRate": 0.008,
    "moonTargetPVToday": 3672.4,
    "sunTargetPVToday": 4245.38,
    "moonGapDollars": -1013.98,
    "sunGapDollars": -1586.96,
    "moonGapPct": -0.276,
    "sunGapPct": -0.374,
    "moonDailyTargetDollars": 15.95,
    "sunDailyTargetDollars": 21.27,
    "moonStatus": "BEHIND",
    "sunStatus": "BEHIND"
  },
  "openPositions": [
    {
      "symbol": "SOL-PERP",
      "direction": "LONG",
      "entryPrice": 145.2,
      "currentPrice": 147.86
    }
  ],
  "activePositionFocus": {
    "symbol": "SOL-PERP",
    "direction": "LONG",
    "entryPrice": 145.2,
    "currentPrice": 147.86
  },
  "edwardVerdict": {
    "action": "HOLD BUT DO NOT ADD",
    "confidence": "HIGH",
    "movementClassification": "HEALTHY PULLBACK",
    "summary": "The trade is still behaving.",
    "whatIWouldDo": "Hold the current size and let the trade prove itself into TP1.",
    "addGuidance": "No add until a clean retest holds.",
    "riskCommentary": "Exposure is controlled."
  },
  "wrongBehavior": { "message": "Do not add just because the candle is green." },
  "recheckTrigger": {
    "condition": "Recheck if 15m closes below 145.80 or price tags TP1 and stalls.",
    "priceLevel": 145.8,
    "timeframe": "15m"
  },
  "watchlistSummary": {
    "total": 3,
    "ready": 0,
    "conditional": 2,
    "blocked": 1,
    "summary": "0 ready, 2 conditional, 1 blocked. Watchlist stays secondary to active trade management."
  },
  "watchlist": [
    { "symbol": "BTC-PERP", "status": "WATCHLIST", "direction": "LONG" }
  ]
}
```

## Example no-active-trade response

Canonical exported fixture: `src/data/exampleSnapshots.ts#noActiveTradeExample`.

Key differences:

```json
{
  "contractVersion": "trading-desk-snapshot.v1",
  "systemStatus": "NO_OPEN_POSITION",
  "openPositions": [],
  "activePositionFocus": null,
  "edwardVerdict": {
    "action": "WAIT / NO ACTION",
    "confidence": "MEDIUM",
    "movementClassification": "CHOPPING",
    "summary": "No open position is active. Edward is standing by.",
    "whatIWouldDo": "Preserve attention and wait for THORP to produce a valid opportunity.",
    "addGuidance": "No position means no add decision.",
    "riskCommentary": "Portfolio risk is low while no trade is active."
  }
}
```

## Example stale handling

Canonical exported fixture: `src/data/exampleSnapshots.ts#liveStaleExample`.

A valid stale response can either:

- set `systemStatus: "STALE"`, or
- emit a `timestamp` older than 300 seconds.

The adapter resolves either case to `live_stale`.

## Example unavailable handling

Canonical exported fixture: `src/data/exampleSnapshots.ts#liveUnavailableExample`.

A valid unavailable response should use:

```json
{
  "contractVersion": "trading-desk-snapshot.v1",
  "systemStatus": "OFFLINE",
  "mode": "live_unavailable",
  "riskState": {
    "exposureStatus": "CRITICAL",
    "summary": "Edward snapshot source is unavailable."
  }
}
```

Non-2xx HTTP responses are also treated as unavailable by the adapter.

## Invalid example

Canonical exported fixture: `src/data/exampleSnapshots.ts#validationErrorExampleInput`.

That fixture intentionally omits `contractVersion` and `portfolio.currentPV`; validation must fail.
