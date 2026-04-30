import { demoTradingDeskSnapshot, emptyDeskSnapshot } from "./demoSnapshot";
import type { TradingDeskSnapshot } from "../domain/tradingDesk";
import { enrichPositionWithPaceMath } from "../domain/softLanding";

function clone(snapshot: TradingDeskSnapshot): TradingDeskSnapshot {
  return structuredClone(snapshot);
}

export const liveAvailableExample: TradingDeskSnapshot = {
  ...clone(demoTradingDeskSnapshot),
  mode: "live_available",
  timestamp: "2026-04-30T14:58:30.000Z",
  systemStatus: "WATCHING",
};

export const liveStaleExample: TradingDeskSnapshot = {
  ...clone(demoTradingDeskSnapshot),
  mode: "live_stale",
  timestamp: "2026-04-30T14:40:00.000Z",
  systemStatus: "STALE",
  riskState: {
    exposureStatus: "ELEVATED",
    summary: "Snapshot is older than the stale threshold. Do not treat this as current Edward state.",
  },
  wrongBehavior: {
    message: "Do not act on stale Edward data.",
  },
  recheckTrigger: {
    condition: "Request a fresh Edward snapshot before any trade decision.",
    timeframe: "portfolio",
  },
};

export const liveUnavailableExample: TradingDeskSnapshot = {
  ...clone(emptyDeskSnapshot),
  mode: "live_unavailable",
  timestamp: "2026-04-30T14:58:30.000Z",
  systemStatus: "OFFLINE",
  riskState: {
    exposureStatus: "CRITICAL",
    summary: "Edward snapshot source is unavailable. This response is a valid unavailable-state contract, not live market truth.",
  },
  edwardVerdict: {
    action: "WAIT / NO ACTION",
    confidence: "LOW",
    movementClassification: "CHOPPING",
    summary: "Edward is unavailable.",
    whatIWouldDo: "Do not trade from this screen until Edward data is fresh.",
    addGuidance: "No add. Data source unavailable.",
    riskCommentary: "Unavailable data is operational risk.",
  },
};

export const noActiveTradeExample: TradingDeskSnapshot = {
  ...clone(emptyDeskSnapshot),
  mode: "live_available",
  timestamp: "2026-04-30T14:58:30.000Z",
  systemStatus: "NO_OPEN_POSITION",
  openPositions: [],
  activePositionFocus: null,
};

const pressureSnapshot = clone(demoTradingDeskSnapshot);
const pressurePosition = pressureSnapshot.activePositionFocus
  ? enrichPositionWithPaceMath(
      { ...pressureSnapshot.activePositionFocus, currentPrice: 144.2, unrealizedPnL: -15.65 },
      pressureSnapshot.portfolio.currentPV,
      pressureSnapshot.softLandingPace,
    )
  : null;

export const activeTradeUnderPressureExample: TradingDeskSnapshot = {
  ...pressureSnapshot,
  mode: "live_available",
  timestamp: "2026-04-30T14:58:30.000Z",
  portfolio: {
    ...pressureSnapshot.portfolio,
    exposureStatus: "ELEVATED",
    unrealizedPnL: -15.65,
  },
  riskState: {
    exposureStatus: "ELEVATED",
    summary: "Active trade is under pressure. Protect decision quality and do not add.",
  },
  activePositionFocus: pressurePosition,
  openPositions: pressurePosition ? [pressurePosition] : [],
  edwardVerdict: {
    action: "MOVE STOP / PROTECT",
    confidence: "MEDIUM",
    movementClassification: "STALLING",
    summary: "Trade remains open but no longer clean. Management is defensive until structure improves.",
    whatIWouldDo: "Hold only while stop structure remains intact; reduce if next close confirms weakness.",
    addGuidance: "No add while pressure is unresolved.",
    riskCommentary: "Elevated risk. Do not widen the stop.",
  },
  wrongBehavior: {
    message: "Do not average down into pressure.",
  },
  recheckTrigger: {
    condition: "Recheck on next 15m close or if price loses the stop band.",
    timeframe: "15m",
  },
};

export const validationErrorExampleInput = {
  timestamp: "2026-04-30T14:58:30.000Z",
  systemStatus: "WATCHING",
  portfolio: {
    equity: 2658.42,
    exposureStatus: "SAFE",
  },
  softLandingPace: liveAvailableExample.softLandingPace,
  openPositions: [],
  activePositionFocus: null,
  edwardVerdict: liveAvailableExample.edwardVerdict,
  riskState: liveAvailableExample.riskState,
  wrongBehavior: liveAvailableExample.wrongBehavior,
  recheckTrigger: liveAvailableExample.recheckTrigger,
  watchlistSummary: liveAvailableExample.watchlistSummary,
  watchlist: liveAvailableExample.watchlist,
};
