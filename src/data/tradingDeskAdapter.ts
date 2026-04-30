import { z } from "zod";
import { demoTradingDeskSnapshot, emptyDeskSnapshot, summarizeWatchlist } from "./demoSnapshot";
import { TRADING_DESK_SNAPSHOT_CONTRACT_VERSION } from "../domain/tradingDesk";
import type {
  DataMode,
  SnapshotSource,
  TradingDeskLoadResult,
  TradingDeskSnapshot,
  TradingPosition,
} from "../domain/tradingDesk";
import { enrichPositionWithPaceMath } from "../domain/softLanding";

export type TradingDeskSource = SnapshotSource;
export type DemoScenario =
  | "normal_demo"
  | "stale_data"
  | "unavailable_edward"
  | "invalid_snapshot"
  | "no_active_trade"
  | "active_trade_under_pressure"
  | "active_trade_healthy";

export type TradingDeskLoadOptions = {
  source?: TradingDeskSource;
  scenario?: DemoScenario;
};

export const EDWARD_SNAPSHOT_ENDPOINT = "/api/trading-desk/snapshot";
export const LIVE_STALE_AFTER_MS = 5 * 60 * 1000;
export const LIVE_STALE_AFTER_SECONDS = LIVE_STALE_AFTER_MS / 1000;

const exposureStatusSchema = z.enum(["SAFE", "ELEVATED", "OVEREXPOSED", "CRITICAL"]);
const directionSchema = z.enum(["LONG", "SHORT"]);
const paceStatusSchema = z.enum(["AHEAD", "BEHIND"]);
const dataModeSchema = z.enum(["live_available", "live_stale", "live_unavailable", "demo_mode", "validation_error"]);

const portfolioSchema = z.object({
  currentPV: z.number().finite(),
  equity: z.number().finite(),
  startingPV: z.number().finite(),
  baselineDate: z.string().min(1),
  dailyPnL: z.number().finite().optional(),
  unrealizedPnL: z.number().finite().optional(),
  marginUsed: z.number().finite().optional(),
  availableBalance: z.number().finite().optional(),
  exposureStatus: exposureStatusSchema,
});

const riskStateSchema = z.object({
  exposureStatus: exposureStatusSchema,
  summary: z.string().min(1),
});

const softLandingPaceSchema = z.object({
  baselinePV: z.number().finite(),
  baselineDate: z.string().min(1),
  daysSinceBaseline: z.number().int().nonnegative(),
  currentPV: z.number().finite(),
  moonDailyRate: z.literal(0.006),
  sunDailyRate: z.literal(0.008),
  moonTargetPVToday: z.number().finite(),
  sunTargetPVToday: z.number().finite(),
  moonGapDollars: z.number().finite(),
  sunGapDollars: z.number().finite(),
  moonGapPct: z.number().finite(),
  sunGapPct: z.number().finite(),
  moonDailyTargetDollars: z.number().finite(),
  sunDailyTargetDollars: z.number().finite(),
  moonStatus: paceStatusSchema,
  sunStatus: paceStatusSchema,
});

const tradingPositionSchema = z.object({
  symbol: z.string().min(1),
  direction: directionSchema,
  entryPrice: z.number().finite(),
  currentPrice: z.number().finite(),
  size: z.number().finite().optional(),
  leverage: z.number().finite().optional(),
  margin: z.number().finite().optional(),
  liquidationPrice: z.number().finite().optional(),
  unrealizedPnL: z.number().finite().optional(),
  tp1: z.number().finite().optional(),
  stop: z.number().finite().optional(),
  extendedTarget: z.number().finite().optional(),
  distanceToTP1Pct: z.number().finite().optional(),
  distanceToStopPct: z.number().finite().optional(),
  estimatedProfitAtTP1: z.number().finite().optional(),
  estimatedLossAtStop: z.number().finite().optional(),
  portfolioGainAtTP1Pct: z.number().finite().optional(),
  portfolioLossAtStopPct: z.number().finite().optional(),
  tp1ContributionToMoonDailyTargetPct: z.number().finite().optional(),
  tp1ContributionToSunDailyTargetPct: z.number().finite().optional(),
  tp1ContributionToMoonGapPct: z.number().finite().optional(),
  tp1ContributionToSunGapPct: z.number().finite().optional(),
});

const edwardVerdictSchema = z.object({
  action: z.enum([
    "HOLD",
    "HOLD BUT DO NOT ADD",
    "ADD ONLY ON RETEST",
    "ADD NOW",
    "TAKE PARTIAL",
    "MOVE STOP / PROTECT",
    "REDUCE",
    "EXIT",
    "WAIT / NO ACTION",
  ]),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
  movementClassification: z.enum([
    "CLEAN MOVE",
    "HEALTHY PULLBACK",
    "STALLING",
    "CHOPPING",
    "REJECTING",
    "THESIS WEAKENING",
    "THESIS FAILED",
  ]),
  summary: z.string().min(1),
  whatIWouldDo: z.string().min(1),
  addGuidance: z.string().min(1),
  riskCommentary: z.string().min(1),
});

const marketMovementSchema = z.object({
  fifteenMinute: z.string().min(1),
  oneHour: z.string().min(1),
  fourHour: z.string().min(1),
  btcContext: z.string().min(1),
});

const tradeObjectiveSchema = z.object({
  moonTargetPct: z.literal(0.6),
  sunTargetPct: z.literal(0.8),
  moonTargetDollars: z.number().finite(),
  sunTargetDollars: z.number().finite(),
  tp1ContributionToMoonPct: z.number().finite().optional(),
  tp1ContributionToSunPct: z.number().finite().optional(),
  worthContinuing: z.boolean().optional(),
  summary: z.string().min(1),
});

const wrongBehaviorSchema = z.object({ message: z.string().min(1) });
const recheckTriggerSchema = z.object({
  condition: z.string().min(1),
  priceLevel: z.number().finite().optional(),
  timeframe: z.enum(["15m", "1H", "4H", "BTC", "portfolio"]).optional(),
});
const watchlistItemSchema = z.object({
  symbol: z.string().min(1),
  status: z.enum(["READY", "WATCHLIST", "CONDITIONAL", "EXTENDED", "TOO LATE", "SKIP"]),
  direction: directionSchema.optional(),
  note: z.string().optional(),
});
const watchlistSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  ready: z.number().int().nonnegative(),
  conditional: z.number().int().nonnegative(),
  blocked: z.number().int().nonnegative(),
  summary: z.string().min(1),
});

const tradingDeskSnapshotSchema = z.object({
  contractVersion: z.literal(TRADING_DESK_SNAPSHOT_CONTRACT_VERSION),
  timestamp: z.string().datetime(),
  mode: dataModeSchema.optional(),
  systemStatus: z.enum(["WATCHING", "OFFLINE", "STALE", "NO_OPEN_POSITION"]),
  portfolio: portfolioSchema,
  riskState: riskStateSchema,
  softLandingPace: softLandingPaceSchema,
  openPositions: z.array(tradingPositionSchema),
  activePositionFocus: tradingPositionSchema.nullish(),
  edwardVerdict: edwardVerdictSchema,
  tradeObjective: tradeObjectiveSchema.optional(),
  marketMovement: marketMovementSchema.optional(),
  wrongBehavior: wrongBehaviorSchema,
  recheckTrigger: recheckTriggerSchema,
  watchlistSummary: watchlistSummarySchema,
  watchlist: z.array(watchlistItemSchema),
});

export type SnapshotValidationResult =
  | { ok: true; snapshot: TradingDeskSnapshot; issues: [] }
  | { ok: false; issues: string[] };

export function validateTradingDeskSnapshot(raw: unknown): SnapshotValidationResult {
  const result = tradingDeskSnapshotSchema.safeParse(raw);
  if (result.success) {
    return { ok: true, snapshot: result.data, issues: [] };
  }

  return {
    ok: false,
    issues: result.error.issues.map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "snapshot";
      return `${path}: ${issue.message}`;
    }),
  };
}

export function resolveDataMode({
  source,
  snapshot,
  now = new Date(),
}: {
  source: TradingDeskSource;
  snapshot: TradingDeskSnapshot;
  now?: Date;
}): DataMode {
  if (source === "demo") return "demo_mode";
  if (snapshot.systemStatus === "OFFLINE") return "live_unavailable";
  if (snapshot.systemStatus === "STALE") return "live_stale";

  const timestampMs = new Date(snapshot.timestamp).getTime();
  if (!Number.isFinite(timestampMs) || now.getTime() - timestampMs > LIVE_STALE_AFTER_MS) return "live_stale";
  return "live_available";
}

export async function loadTradingDeskSnapshot(options: TradingDeskLoadOptions | TradingDeskSource = "demo"): Promise<TradingDeskLoadResult> {
  const normalized = typeof options === "string" ? { source: options } : options;
  const source = normalized.source ?? "demo";

  if (source === "demo") {
    return buildDemoSnapshot(normalized.scenario ?? "normal_demo");
  }

  try {
    const response = await fetch(EDWARD_SNAPSHOT_ENDPOINT, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return unavailableResult(`Edward snapshot unavailable: HTTP ${response.status}`);
    }

    const raw = await response.json();
    const validation = validateTradingDeskSnapshot(raw);
    if (!validation.ok) {
      return validationErrorResult(validation.issues);
    }

    const dataMode = resolveDataMode({ source, snapshot: validation.snapshot });
    return {
      snapshot: { ...validation.snapshot, mode: dataMode },
      dataMode,
      source,
      validationIssues: [],
      loadedAt: new Date().toISOString(),
    };
  } catch (error) {
    return unavailableResult(error instanceof Error ? error.message : "Edward snapshot unavailable");
  }
}

export function buildDemoSnapshot(scenario: DemoScenario): TradingDeskLoadResult {
  if (scenario === "invalid_snapshot") {
    return validationErrorResult(["Demo invalid snapshot: portfolio.currentPV is missing"], scenario, "demo");
  }

  if (scenario === "unavailable_edward") {
    return unavailableResult("Demo unavailable Edward state", scenario, "demo");
  }

  let snapshot = cloneSnapshot(demoTradingDeskSnapshot);
  let dataMode: DataMode = "demo_mode";

  if (scenario === "stale_data") {
    snapshot.timestamp = new Date(Date.now() - 11 * 60 * 1000).toISOString();
    snapshot.systemStatus = "STALE";
    dataMode = "live_stale";
  }

  if (scenario === "no_active_trade") {
    snapshot = cloneSnapshot(emptyDeskSnapshot);
  }

  if (scenario === "active_trade_under_pressure") {
    snapshot.portfolio.exposureStatus = "ELEVATED";
    snapshot.riskState = {
      exposureStatus: "ELEVATED",
      summary: "Trade is still alive, but pressure is visible. Do not add; protect decision quality.",
    };
    snapshot.edwardVerdict = {
      action: "MOVE STOP / PROTECT",
      confidence: "MEDIUM",
      movementClassification: "STALLING",
      summary: "Price is no longer clean. The position is not failed, but the management question is now defensive.",
      whatIWouldDo: "Hold only if structure reclaims. Prepare to reduce if the next close confirms weakness.",
      addGuidance: "No add while pressure is unresolved.",
      riskCommentary: "Elevated risk. Respect the stop and do not widen it.",
    };
    snapshot.wrongBehavior = { message: "Do not average down into pressure. Let Edward recheck first." };
    snapshot.recheckTrigger = { condition: "Recheck on next 15m close or if price loses the stop band.", timeframe: "15m" };
    snapshot.activePositionFocus = adjustActivePosition(snapshot.activePositionFocus, {
      currentPrice: 144.2,
      unrealizedPnL: -15.65,
    });
  }

  if (scenario === "active_trade_healthy") {
    snapshot.edwardVerdict = {
      action: "HOLD",
      confidence: "HIGH",
      movementClassification: "CLEAN MOVE",
      summary: "The active trade is behaving cleanly and still has room before TP1.",
      whatIWouldDo: "Hold. No need to interfere with a working position.",
      addGuidance: "Still no add unless Edward gets a clean retest signal.",
      riskCommentary: "Risk remains contained; the trade does not need more size.",
    };
    snapshot.riskState = { exposureStatus: "SAFE", summary: "Healthy trade behavior with controlled exposure." };
    snapshot.wrongBehavior = { message: "Do not take early profit just to feel productive." };
    snapshot.recheckTrigger = { condition: "Recheck only at TP1, stop band, or new Edward snapshot.", timeframe: "15m" };
  }

  snapshot.mode = dataMode;
  return {
    snapshot,
    dataMode,
    source: "demo",
    scenario,
    validationIssues: [],
    loadedAt: new Date().toISOString(),
  };
}

function validationErrorResult(issues: string[], scenario?: DemoScenario, source: TradingDeskSource = "edward-api"): TradingDeskLoadResult {
  const snapshot = cloneSnapshot(demoTradingDeskSnapshot);
  snapshot.mode = "validation_error";
  snapshot.systemStatus = "OFFLINE";
  snapshot.riskState = {
    exposureStatus: "CRITICAL",
    summary: "Snapshot validation failed. UI is showing safe fallback demo data, not trusted Edward data.",
  };
  snapshot.edwardVerdict = {
    action: "WAIT / NO ACTION",
    confidence: "LOW",
    movementClassification: "THESIS FAILED",
    summary: "The incoming Edward snapshot did not match the required trading desk contract.",
    whatIWouldDo: "Ignore the snapshot and keep trading decisions outside this UI until the adapter is fixed.",
    addGuidance: "No add. Validation failure is a hard stop.",
    riskCommentary: "Unknown data is risk. Treat this as unavailable for trading decisions.",
  };
  snapshot.wrongBehavior = { message: "Do not trade from a malformed snapshot." };
  snapshot.recheckTrigger = { condition: "Fix the snapshot contract and reload the desk.", timeframe: "portfolio" };

  return {
    snapshot,
    dataMode: "validation_error",
    source,
    scenario,
    validationIssues: issues,
    loadedAt: new Date().toISOString(),
  };
}

function unavailableResult(message: string, scenario?: DemoScenario, source: TradingDeskSource = "edward-api"): TradingDeskLoadResult {
  const snapshot = cloneSnapshot(emptyDeskSnapshot);
  snapshot.mode = "live_unavailable";
  snapshot.systemStatus = "OFFLINE";
  snapshot.riskState = {
    exposureStatus: "CRITICAL",
    summary: "Edward snapshot is unavailable. This screen is a safe fallback, not live trading data.",
  };
  snapshot.edwardVerdict = {
    action: "WAIT / NO ACTION",
    confidence: "LOW",
    movementClassification: "CHOPPING",
    summary: message,
    whatIWouldDo: "Do not act from this screen until fresh Edward data is available.",
    addGuidance: "No add. Edward is unavailable.",
    riskCommentary: "Unavailable data is operational risk.",
  };
  snapshot.wrongBehavior = { message: "Do not infer a trade state from missing Edward data." };
  snapshot.recheckTrigger = { condition: "Reconnect Edward snapshot source and reload.", timeframe: "portfolio" };
  return {
    snapshot,
    dataMode: "live_unavailable",
    source,
    scenario,
    validationIssues: [],
    loadedAt: new Date().toISOString(),
  };
}

function cloneSnapshot(snapshot: TradingDeskSnapshot): TradingDeskSnapshot {
  return structuredClone(snapshot);
}

function adjustActivePosition(position: TradingPosition | null | undefined, patch: Partial<TradingPosition>) {
  if (!position) return position;
  return enrichPositionWithPaceMath({ ...position, ...patch }, demoTradingDeskSnapshot.portfolio.currentPV, demoTradingDeskSnapshot.softLandingPace);
}

export { summarizeWatchlist };
