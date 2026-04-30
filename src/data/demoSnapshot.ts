import { calculateSoftLandingPace, enrichPositionWithPaceMath } from "../domain/softLanding";
import {
  TRADING_DESK_SNAPSHOT_CONTRACT_VERSION,
  type TradingDeskSnapshot,
  type TradingPosition,
  type WatchlistItem,
  type WatchlistSummary,
} from "../domain/tradingDesk";

const portfolio = {
  currentPV: 2658.42,
  equity: 2658.42,
  startingPV: 2373,
  baselineDate: "2026-02-16",
  dailyPnL: 28.4,
  unrealizedPnL: 41.62,
  marginUsed: 412,
  availableBalance: 2246.42,
  exposureStatus: "SAFE" as const,
};

const pace = calculateSoftLandingPace(portfolio.currentPV);

const activePosition: TradingPosition = enrichPositionWithPaceMath(
  {
    symbol: "SOL-PERP",
    direction: "LONG",
    entryPrice: 145.2,
    currentPrice: 147.86,
    size: 15.65,
    leverage: 3,
    margin: 758.02,
    liquidationPrice: 101.18,
    unrealizedPnL: 41.62,
    tp1: 151.4,
    stop: 143.1,
    extendedTarget: 156.8,
  },
  portfolio.currentPV,
  pace,
);

const watchlist: WatchlistItem[] = [
  { symbol: "BTC-PERP", status: "WATCHLIST", direction: "LONG", note: "Needs range reclaim before it matters." },
  { symbol: "ETH-PERP", status: "CONDITIONAL", direction: "LONG", note: "Accept only on retest, not extension." },
  { symbol: "WIF-PERP", status: "TOO LATE", direction: "LONG", note: "Move already consumed. No chase." },
];

export function summarizeWatchlist(items: WatchlistItem[]): WatchlistSummary {
  const ready = items.filter((item) => item.status === "READY").length;
  const conditional = items.filter((item) => item.status === "WATCHLIST" || item.status === "CONDITIONAL").length;
  const blocked = items.filter((item) => item.status === "EXTENDED" || item.status === "TOO LATE" || item.status === "SKIP").length;
  return {
    total: items.length,
    ready,
    conditional,
    blocked,
    summary: `${ready} ready, ${conditional} conditional, ${blocked} blocked. Watchlist stays secondary to active trade management.`,
  };
}

export const demoTradingDeskSnapshot: TradingDeskSnapshot = {
  contractVersion: TRADING_DESK_SNAPSHOT_CONTRACT_VERSION,
  timestamp: new Date().toISOString(),
  mode: "demo_mode",
  systemStatus: "WATCHING",
  portfolio,
  riskState: {
    exposureStatus: portfolio.exposureStatus,
    summary: "Exposure is controlled; no backend/live broker authority is connected.",
  },
  softLandingPace: pace,
  openPositions: [activePosition],
  activePositionFocus: activePosition,
  edwardVerdict: {
    action: "HOLD BUT DO NOT ADD",
    confidence: "HIGH",
    movementClassification: "HEALTHY PULLBACK",
    summary: "The trade is still behaving. Price is above entry structure and TP1 remains realistic.",
    whatIWouldDo: "Hold the current size and let the trade prove itself into TP1.",
    addGuidance: "No add until a clean retest holds with BTC neutral or supportive.",
    riskCommentary: "Exposure is controlled. Do not convert a green trade into a larger risk event.",
  },
  tradeObjective: {
    moonTargetPct: 0.6,
    sunTargetPct: 0.8,
    moonTargetDollars: pace.moonDailyTargetDollars,
    sunTargetDollars: pace.sunDailyTargetDollars,
    tp1ContributionToMoonPct: activePosition.tp1ContributionToMoonDailyTargetPct,
    tp1ContributionToSunPct: activePosition.tp1ContributionToSunDailyTargetPct,
    worthContinuing: true,
    summary: "TP1 meaningfully contributes to today's target without needing extra size.",
  },
  marketMovement: {
    fifteenMinute: "Pulling back but still above entry structure.",
    oneHour: "Continuation remains intact while higher lows hold.",
    fourHour: "Trade remains inside a valid THORP management range.",
    btcContext: "Neutral/supportive. No BTC breakdown pressure yet.",
  },
  wrongBehavior: {
    message: "Do not add just because the candle is green.",
  },
  recheckTrigger: {
    condition: "Recheck if 15m closes below 145.80 or price tags TP1 and stalls.",
    priceLevel: 145.8,
    timeframe: "15m",
  },
  watchlistSummary: summarizeWatchlist(watchlist),
  watchlist,
};

export const emptyDeskSnapshot: TradingDeskSnapshot = {
  ...demoTradingDeskSnapshot,
  systemStatus: "NO_OPEN_POSITION",
  openPositions: [],
  activePositionFocus: null,
  riskState: {
    exposureStatus: "SAFE",
    summary: "No active trade is open. Portfolio risk is quiet; opportunity scanning is secondary.",
  },
  edwardVerdict: {
    action: "WAIT / NO ACTION",
    confidence: "MEDIUM",
    movementClassification: "CHOPPING",
    summary: "No open position is active. Edward is standing by.",
    whatIWouldDo: "Preserve attention and wait for THORP to produce a valid opportunity.",
    addGuidance: "No position means no add decision.",
    riskCommentary: "Portfolio risk is low while no trade is active.",
  },
};
