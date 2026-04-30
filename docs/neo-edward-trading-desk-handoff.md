# Neo Handoff: Edward Trading Desk Snapshot Contract

Edward Trading Desk is a standalone position-management command center. THORP remains the opportunity engine. Edward owns open-position management. Edwin remains final command authority.

## Endpoint

Future read-only endpoint:

`GET /api/trading-desk/snapshot`

The app currently loads demo fixture data through `src/data/tradingDeskAdapter.ts`. The adapter boundary is intentionally separate from demo data so Edward can replace the source without rewriting the UI.

## Data Mode Rules

- `demo`: fixture or manually mocked data. Must be visually marked.
- `live`: Edward produced a fresh snapshot from approved read-only sources.
- `stale`: last valid snapshot is older than Edward's freshness threshold.
- `unavailable`: no valid snapshot can be served.

Never include exchange secrets, write credentials, or execution authority in this payload.

## Required JSON Shape

```ts
type TradingDeskSnapshot = {
  timestamp: string;
  mode: "live" | "demo" | "stale" | "unavailable";
  systemStatus: "WATCHING" | "OFFLINE" | "STALE" | "NO_OPEN_POSITION";
  portfolio: PortfolioSnapshot;
  softLandingPace: SoftLandingPace;
  openPositions: TradingPosition[];
  activePositionFocus?: TradingPosition;
  edwardVerdict?: EdwardVerdict;
  tradeObjective?: TradeObjective;
  marketMovement?: MarketMovement;
  wrongBehavior?: WrongBehavior;
  recheckTrigger?: RecheckTrigger;
  watchlist: WatchlistItem[];
};
```

## Required Portfolio Fields

`currentPV`, `startingPV`, `baselineDate`, and `exposureStatus` are required. Include `dailyPnL`, `unrealizedPnL`, `marginUsed`, and `availableBalance` when available.

Allowed exposure states: `SAFE`, `ELEVATED`, `OVEREXPOSED`, `CRITICAL`.

## Moon/Sun Calculations

Constants:

- Baseline PV: `2373`
- Baseline date: `2026-02-16`
- Moon daily rate: `0.006`
- Sun daily rate: `0.008`

Daily target:

- Moon daily dollars = `currentPV * 0.006`
- Sun daily dollars = `currentPV * 0.008`

Pace curve:

- `daysSinceBaseline = days between today and 2026-02-16`
- Moon target PV today = `2373 * (1.006 ^ daysSinceBaseline)`
- Sun target PV today = `2373 * (1.008 ^ daysSinceBaseline)`
- Moon/Sun gaps = `currentPV - targetPVToday`
- Status is `AHEAD` when gap is zero or positive, otherwise `BEHIND`.

## Required Open Position Fields

For each open position, Edward should provide symbol, direction, entry price, current price, TP1, stop, estimated profit at TP1, estimated loss at stop, and portfolio impact. Include size, leverage, margin, and liquidation price when available.

If a position is active, set `activePositionFocus` to the position Edward wants Edwin managing first.

## Verdict Values

Allowed actions:

- `HOLD`
- `HOLD BUT DO NOT ADD`
- `ADD ONLY ON RETEST`
- `ADD NOW`
- `TAKE PARTIAL`
- `MOVE STOP / PROTECT`
- `REDUCE`
- `EXIT`
- `WAIT / NO ACTION`

Confidence: `LOW`, `MEDIUM`, `HIGH`.

Movement classification:

- `CLEAN MOVE`
- `HEALTHY PULLBACK`
- `STALLING`
- `CHOPPING`
- `REJECTING`
- `THESIS WEAKENING`
- `THESIS FAILED`

Edward must include `summary`, `whatIWouldDo`, `addGuidance`, and `riskCommentary`.

## Required Command Lines

Every usable snapshot should include one wrong behavior warning and one recheck trigger.

Examples:

- Wrong behavior: `Do not add just because the candle is green.`
- Recheck trigger: `Recheck if 15m closes below 445.`

## Watchlist

Watchlist is secondary. If a position is open, Edward Trading Desk must prioritize position management over new opportunities.
