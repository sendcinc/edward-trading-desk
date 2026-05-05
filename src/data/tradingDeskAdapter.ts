import { z } from "zod";
import { demoTradingDeskSnapshot, emptyDeskSnapshot, summarizeWatchlist } from "./demoSnapshot";
import { TRADING_DESK_SNAPSHOT_CONTRACT_VERSION } from "../domain/tradingDesk";
import type {
  DataMode,
  AlertIntakeResult,
  SnapshotSource,
  TradingDeskHealth,
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

export const EDWARD_SNAPSHOT_ENDPOINT = "/trading-desk/data/latest.json";
export const EDWARD_HEALTH_ENDPOINT = "/trading-desk/data/health.json";
export const EDWARD_ALERT_INTAKE_ENDPOINT = "/trading-desk/data/latest-alert.json";
export const LIVE_STALE_AFTER_MS = 5 * 60 * 1000;
export const LIVE_STALE_AFTER_SECONDS = LIVE_STALE_AFTER_MS / 1000;

const exposureStatusSchema = z.enum(["SAFE", "ELEVATED", "OVEREXPOSED", "CRITICAL"]);
const directionSchema = z.enum(["LONG", "SHORT"]);
const paceStatusSchema = z.enum(["AHEAD", "BEHIND"]);
const dataModeSchema = z.enum(["live_available", "live_stale", "live_unavailable", "demo_mode", "validation_error"]);
const confidenceSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
const technicalThesisSchema = z.object({
  state: z.enum(["VALID", "WEAKENING", "FAILED", "UNKNOWN"]),
  confidence: confidenceSchema,
  reasons: z.array(z.string().min(1)),
});
const managementStateSchema = z.object({
  riskState: exposureStatusSchema,
  dataConfidence: confidenceSchema,
  addPermission: z.enum(["ALLOWED", "RETEST_ONLY", "BLOCKED", "UNKNOWN"]),
  reasons: z.array(z.string().min(1)),
});
const managementAddPermissionSchema = z.enum(["ALLOWED", "RETEST_ONLY", "BLOCKED", "UNKNOWN"]);
const tradeManagementPlanSchema = z.object({
  recommendation: z.enum([
    "HOLD",
    "HOLD_WITH_PROTECTIVE_TRAIL",
    "REDUCE_PARTIAL",
    "REDUCE_PARTIAL_AND_TRAIL",
    "EXIT",
    "TAKE_PROFIT",
    "WAIT_NO_ACTION",
  ]),
  confidence: confidenceSchema,
  summary: z.string().min(1),
  primaryReason: z.string().min(1),
  doNotDo: z.array(z.string().min(1)),
  addPermission: managementAddPermissionSchema,
  exitPressure: z.enum(["LOW", "MEDIUM", "HIGH"]),
  recheckTrigger: z.string().min(1),
  technicalThesisState: z.enum(["VALID", "WEAKENING", "FAILED", "UNKNOWN"]).optional(),
  protectionPlan: z.object({
    preferredMethod: z.enum(["NONE", "HARD_STOP", "TRAIL_STOP", "PARTIAL_REDUCE_AND_TRAIL"]),
    suggestedProtectiveStop: z.number().finite().optional(),
    warningLevel: z.number().finite().optional(),
    hardInvalidation: z.number().finite().optional(),
    trailReason: z.string().min(1),
  }),
  profitMath: z.object({
    unrealizedNow: z.number().finite().optional(),
    profitIfCloseNow: z.number().finite().optional(),
    estimatedProfitAtTP1: z.number().finite().optional(),
    estimatedProfitAtTP2: z.number().finite().optional(),
    estimatedProfitAtTP3: z.number().finite().optional(),
    additionalProfitToTP1: z.number().finite().optional(),
    givebackToProtectiveStop: z.number().finite().optional(),
    lossAtHardInvalidation: z.number().finite().optional(),
  }),
  softLandingImpact: z.object({
    moonStatus: paceStatusSchema,
    sunStatus: paceStatusSchema,
    moonDailyTargetDollars: z.number().finite(),
    sunDailyTargetDollars: z.number().finite(),
    closeNowMoonContributionPct: z.number().finite().optional(),
    closeNowSunContributionPct: z.number().finite().optional(),
    tp1MoonContributionPct: z.number().finite().optional(),
    tp1SunContributionPct: z.number().finite().optional(),
    summary: z.string().min(1),
  }),
});

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
  currentDailyPVPct: z.number().finite(),
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

const ladderEntrySchema = z.object({
  label: z.string().optional(),
  price: z.number().finite().optional(),
  size: z.number().finite().optional(),
  status: z.enum(["FILLED", "PLANNED", "WAITING", "CANCELLED"]).optional(),
});


const thorpLevelsSchema = z.object({
  scout: z.number().finite().optional(),
  a1: z.number().finite().optional(),
  a2: z.number().finite().optional(),
  hardInvalidation: z.number().finite().optional(),
  t1: z.number().finite().optional(),
  t2: z.number().finite().optional(),
  t3: z.number().finite().optional(),
});

const activePlanEntryLevelSchema = z.object({
  level: z.string().min(1),
  price: z.number().finite(),
  status: z.string().min(1),
});

const matchedEntryLevelSchema = z.enum(["scout", "a1", "a2", "unknown"]).nullable().optional();

const activeThorpPlanSchema = z.object({
  contractVersion: z.literal("active-thorp-trade-plan.v1"),
  symbol: z.string().min(1),
  direction: directionSchema,
  status: z.string().min(1),
  source: z.string().min(1).optional(),
  createdAt: z.string().datetime().optional(),
  auto_execution: z.literal(false),
  executionIntent: z.literal("none"),
  matchedEntryLevel: matchedEntryLevelSchema,
  entryLevels: z.array(activePlanEntryLevelSchema).optional(),
  levels: thorpLevelsSchema.optional(),
});

const brokerProtectionSchema = z.object({
  stopLossPresent: z.boolean(),
  stopLossPrice: z.number().finite().nullable().optional(),
  takeProfitPrices: z.array(z.number().finite()),
  openAddPrices: z.array(z.number().finite()),
  riskProtectionState: z.enum(["UNPROTECTED", "PROTECTED", "UNKNOWN"]),
});

const riskVisibilitySchema = z.object({
  unprotectedRisk: z.boolean().optional(),
  stopProtectionStatus: z.enum(["MISSING", "PRESENT", "UNKNOWN"]).optional(),
  tpCoverageStatus: z.enum(["NONE", "PARTIAL", "FULL", "UNKNOWN"]).optional(),
  openAddContradiction: z.boolean().optional(),
  activePlanLinked: z.boolean().optional(),
  matchedEntryLevel: matchedEntryLevelSchema,
  entryLevels: z.array(activePlanEntryLevelSchema).optional(),
  planBrokerMismatch: z.boolean().optional(),
  manualAttentionRequired: z.boolean().optional(),
  reasons: z.array(z.string().min(1)).optional(),
});

const brokerOrderSchema = z.object({
  symbol: z.string().min(1).optional(),
  side: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  price: z.number().finite().optional(),
  stopPrice: z.number().finite().optional(),
  size: z.number().finite().optional(),
  reduceOnly: z.boolean().nullable().optional(),
  source: z.literal("broker").optional(),
}).strict();

const brokerOrderTruthSchema = z.object({
  contractVersion: z.literal("broker-order-truth.v1"),
  generatedAt: z.string().datetime(),
  source: z.literal("phemex_private_read_only"),
  auto_execution: z.literal(false),
  symbols: z.array(z.object({
    symbol: z.string().min(1),
    positionStatus: z.enum(["OPEN", "FLAT"]),
    positionSide: directionSchema.optional(),
    positionSize: z.number().finite().nullable().optional(),
    averageEntryPrice: z.number().finite().nullable().optional(),
    currentPrice: z.number().finite().nullable().optional(),
    unrealizedPnL: z.number().finite().nullable().optional(),
    orders: z.object({
      stopLoss: brokerOrderSchema.nullable(),
      takeProfits: z.array(brokerOrderSchema),
      openAdds: z.array(brokerOrderSchema),
      other: z.array(brokerOrderSchema),
    }),
    coverage: riskVisibilitySchema.extend({
      brokerStopPresent: z.boolean(),
      brokerStopPrice: z.number().finite().nullable().optional(),
      tpPrices: z.array(z.number().finite()),
      openAddPrices: z.array(z.number().finite()),
      missingExpectedTpPrices: z.array(z.number().finite()),
    }),
  })),
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
  tp2: z.number().finite().optional(),
  tp3: z.number().finite().optional(),
  stop: z.number().finite().optional(),
  stopSource: z.string().optional(),
  thorpLevels: thorpLevelsSchema.optional(),
  brokerProtection: brokerProtectionSchema.optional(),
  riskVisibility: riskVisibilitySchema.optional(),
  activePlanLinked: z.boolean().optional(),
  activeThorpPlan: activeThorpPlanSchema.optional(),
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
  filledLadderEntries: z.array(ladderEntrySchema).optional(),
  remainingLadderEntries: z.array(ladderEntrySchema).optional(),
  plannedSizeSplit: z.string().optional(),
  nextAddLevel: z.number().finite().optional(),
  averageEntryAfterFills: z.number().finite().optional(),
  addPermission: z.enum(["ALLOWED_NOW", "ONLY_ON_RETEST", "NOT_ALLOWED", "UNAVAILABLE"]).optional(),
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
  confidence: confidenceSchema,
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
  technicalThesis: technicalThesisSchema.optional(),
  managementState: managementStateSchema.optional(),
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

const liveTradeStateItemSchema = z.object({
  symbol: z.string().min(1),
  position_status: z.enum(["OPEN", "FLAT"]),
  entry_state: z.enum(["MANAGING_OPEN_TRADE", "SCANNER_WAKEUP", "NONE"]),
  trade_lifecycle: z.enum(["ACTIVE_MANAGEMENT", "FRESH_CONTEXT_REQUIRED", "NO_ACTIVE_TRADE"]),
  thesis_state: z.enum(["VALID", "WEAKENING", "FAILED", "UNKNOWN"]),
  risk_state: exposureStatusSchema,
  data_confidence: confidenceSchema,
  management_bias: z.enum(["HOLD_PROTECT", "DEFENSIVE_HOLD", "REDUCE_RISK_NO_ADD", "EXIT_OR_REDUCE", "REVIEW_FRESH_CONTEXT", "WAIT_NO_ACTION"]),
  last_updated: z.string().datetime(),
  recent_state_events: z.array(z.string().min(1)),
  auto_execution: z.literal(false),
  direction: directionSchema.optional(),
  current_price: z.number().finite().optional(),
  trade_management_recommendation: z.string().min(1).optional(),
});

const liveTradeStateSchema = z.object({
  contractVersion: z.literal("edward-live-trade-state.v1"),
  generatedAt: z.string().datetime(),
  trades: z.array(liveTradeStateItemSchema),
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
  normalizedSymbol: z.string().min(1).optional(),
  phemexSymbol: z.string().min(1).optional(),
  latestLegacyScannerWakeupAt: z.string().datetime().nullable().optional(),
  latestRichScannerAt: z.string().datetime().nullable().optional(),
  latestHudHeartbeatAt: z.string().datetime().nullable().optional(),
  latestLaneType: z.string().nullable().optional(),
  freshnessStatus: z.string().optional(),
  missingEvidenceStatus: z.string().optional(),
  missingEvidence: z.array(z.string()).optional(),
  duplicateStaleNoActionStatus: z.array(z.string()).optional(),
  autoExecution: z.literal(false).optional(),
  executionIntent: z.literal("none").optional(),
});
const tradeJournalEntrySchema = z.object({
  tradeId: z.string().optional(),
  symbol: z.string().min(1),
  side: z.enum(["long", "short"]),
  status: z.string().min(1),
  entryTime: z.string().optional(),
  exitTime: z.string().optional(),
  entryPrice: z.number().finite().optional(),
  exitPrice: z.number().finite().optional(),
  realizedPnl: z.number().finite().optional(),
  fees: z.number().finite().nullable().optional(),
  funding: z.number().finite().nullable().optional(),
  size: z.number().finite().nullable().optional(),
  framework: z.string().optional(),
  closeReason: z.string().optional(),
  confidence: z.string().optional(),
});
const watchlistSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  ready: z.number().int().nonnegative(),
  conditional: z.number().int().nonnegative(),
  blocked: z.number().int().nonnegative(),
  summary: z.string().min(1),
});


const healthSourceStatusSchema = z.enum(["fresh", "stale", "unavailable", "missing", "error", "unknown"]);
const healthSourceSchema = z.object({
  status: healthSourceStatusSchema,
  lastUpdatedAt: z.string().datetime().nullable().optional(),
  ageSeconds: z.number().finite().nullable().optional(),
  lastError: z.string().nullable().optional(),
  provenance: z.string().nullable().optional(),
  detail: z.string().nullable().optional(),
});
const tradingDeskHealthSchema = z.object({
  contractVersion: z.literal("edward-trading-desk-health.v1"),
  generatedAt: z.string().datetime(),
  producerStatus: z.enum(["healthy", "degraded", "offline"]),
  lastSnapshotAt: z.string().datetime().nullable().optional(),
  snapshotAgeSeconds: z.number().finite().nullable().optional(),
  latestJsonValid: z.boolean(),
  validationIssues: z.array(z.string()),
  lastSuccessfulUpdate: z.string().datetime().nullable().optional(),
  lastError: z.string().nullable().optional(),
  sources: z.object({
    phemex: healthSourceSchema,
    thorpHud15m: healthSourceSchema,
    thorpHud1h: healthSourceSchema,
    thorpHud4h: healthSourceSchema,
    activePlan: healthSourceSchema,
    brokerTruth: healthSourceSchema,
    tradingDeskSnapshot: healthSourceSchema,
  }),
  sourceBreakdown: z.object({
    fresh: z.array(z.string()).optional(),
    stale: z.array(z.string()).optional(),
    unavailable: z.array(z.string()).optional(),
    missing: z.array(z.string()).optional(),
    error: z.array(z.string()).optional(),
    technicalThesisState: z.enum(["VALID", "WEAKENING", "FAILED", "UNKNOWN"]).optional(),
  }).optional(),
});

const nullableNumberSchema = z.number().finite().nullable().optional();
const nullableStringSchema = z.string().nullable().optional();

const thorpRichScannerPayloadSchema = z.object({
  type: z.literal("THORP_SCORE_READY"),
  schemaVersion: z.literal("thorp-rich-scanner.v1"),
  lane: z.literal("scanner"),
  system: z.string().min(1).optional(),
  symbol: z.string().min(1).optional(),
  tickerid: z.string().min(1).optional(),
  exchange: z.string().min(1).optional(),
  timeframe: z.string().min(1).optional(),
  bar_time: nullableNumberSchema,
  direction: nullableStringSchema,
  decision: nullableStringSchema,
  score: nullableNumberSchema,
  bias_zone: nullableStringSchema,
  battlefield: nullableStringSchema,
  battlefield_pct: nullableNumberSchema,
  trigger: nullableStringSchema,
  action: nullableStringSchema,
  setup_state: nullableStringSchema,
  price_at_alert: nullableNumberSchema,
  current_price: nullableNumberSchema,
  mark_price: nullableNumberSchema,
  markPrice: nullableNumberSchema,
  live_mark_price: nullableNumberSchema,
  entries: z.object({ scout: nullableNumberSchema, a1: nullableNumberSchema, a2: nullableNumberSchema }).strict(),
  risk: z.object({ warning: nullableNumberSchema, hard: nullableNumberSchema, invalidation: nullableNumberSchema, hardInvalidation: nullableNumberSchema }).strict(),
  targets: z.object({ t1: nullableNumberSchema, t2: nullableNumberSchema, t3: nullableNumberSchema }).strict(),
  range: z.object({ high: nullableNumberSchema, mid: nullableNumberSchema, low: nullableNumberSchema }).strict(),
  rotation: nullableStringSchema,
  body_pct: nullableNumberSchema,
  auto_execution: z.literal(false),
  executionIntent: z.literal("none"),
  copy: z.string().optional(),
}).strict();
const thorpScannerRecommendationSchema = z.enum(["REVIEW_NOW", "WAIT_FOR_RETEST", "SKIP_STALE", "SKIP_STRETCHED", "DUPLICATE_NO_ACTION", "CONTEXT_INCOMPLETE"]);
const entryTacticsSchema = z.object({
  contractVersion: z.literal("entry-tactics-brain.v1"),
  entryTactic: z.enum(["TAKE_SCOUT", "SCOUT_SMALL_ONLY", "A1_A2_RETEST_ONLY", "A2_SNIPER_ONLY", "WAIT_FOR_RETEST", "SKIP_CHASE", "NO_ACTION_STALE"]),
  positionSplit: z.string().min(1),
  nextActionSentence: z.string().min(1),
  riskReason: z.string().min(1),
  inputs: z.record(z.string(), z.unknown()).optional(),
  autoExecution: z.literal(false),
  executionIntent: z.literal("none"),
}).strict();
const freshAlertReviewTimeframeSchema = z.object({
  status: z.enum(["fresh", "stale", "missing", "unavailable", "failed"]),
  source: z.literal("tradingview_read"),
  decision: z.string().min(1).nullable(),
  score: z.number().finite().nullable(),
  biasZone: z.string().nullable(),
  battlefield: z.string().nullable(),
  trigger: z.string().nullable(),
  action: z.string().nullable(),
  scout: z.number().finite().nullable(),
  a1: z.number().finite().nullable(),
  a2: z.number().finite().nullable(),
  warning: z.number().finite().nullable(),
  hardInvalidation: z.number().finite().nullable(),
  t1: z.number().finite().nullable(),
  t2: z.number().finite().nullable(),
  t3: z.number().finite().nullable(),
  extractedAt: z.string().datetime().nullable(),
  rawRowsHash: z.string().min(1).nullable().optional(),
}).strict();
const setupRankingImpactSchema = z.object({
  autoExecution: z.literal(false),
  executionIntent: z.literal("none"),
}).passthrough();
const freshAlertReviewSchema = z.object({
  contractVersion: z.literal("fresh-alert-3tf-review.v1"),
  symbol: z.string().min(1),
  normalizedSymbol: z.string().min(1),
  tradingViewReadAttempted: z.literal(true),
  tradingViewRefreshAttempted: z.literal(false),
  tradingViewMutationAttempted: z.literal(false),
  alertReceivedAt: z.string().datetime().nullable().optional(),
  reviewStartedAt: z.string().datetime().nullable().optional(),
  reviewCompletedAt: z.string().datetime().nullable().optional(),
  alertAgeSeconds: z.number().finite().nullable().optional(),
  originalChartContextCaptured: z.boolean(),
  originalChartContextRestored: z.boolean(),
  timeframes: z.object({
    "15m": freshAlertReviewTimeframeSchema,
    "1H": freshAlertReviewTimeframeSchema,
    "4H": freshAlertReviewTimeframeSchema,
  }).strict(),
  livePrice: z.object({
    status: z.enum(["available", "unavailable", "failed"]),
    price: z.number().finite().nullable(),
    timestamp: z.string().datetime().nullable(),
  }).strict(),
  entryTactics: entryTacticsSchema.optional(),
  setupRankingImpact: setupRankingImpactSchema.optional(),
  finalRecommendation: z.string().min(1),
  nextActionSentence: z.string().min(1),
  riskReason: z.string().min(1),
  confidence: z.enum(["high", "medium", "low"]),
  guardrails: z.object({
    readOnly: z.literal(true),
    autoExecution: z.literal(false),
    executionIntent: z.literal("none"),
  }).strict(),
}).strict();
const setupRankingCandidateSchema = z.object({
  rank: z.number().int().positive(),
  symbol: z.string().min(1),
  direction: z.string().min(1),
  score: z.number().finite().optional(),
  setupGrade: z.string().min(1),
  recommendedFocus: z.string().min(1),
  entryTactic: z.string().min(1),
  positionSplit: z.string().min(1).optional(),
  freshnessStatus: z.string().min(1).optional(),
  mtfAlignment: z.string().min(1).optional(),
  rrQuality: z.string().min(1).optional(),
  chaseRisk: z.string().min(1).optional(),
  riskReason: z.string().min(1).optional(),
  nextActionSentence: z.string().min(1).optional(),
  openPositionState: z.string().min(1).optional(),
  autoExecution: z.literal(false),
  executionIntent: z.literal("none"),
}).strict();
const setupRankingSchema = z.object({
  contractVersion: z.literal("setup-ranking-brain.v1"),
  bestSetup: z.record(z.string(), z.unknown()),
  rankingSummary: z.string().min(1),
  bestActionSentence: z.string().min(1),
  candidates: z.array(setupRankingCandidateSchema),
  autoExecution: z.literal(false),
  executionIntent: z.literal("none"),
}).strict();
const RICH_THORP_SCANNER_CLASSIFICATION = "thorp_score_ready_rich_scanner_alert";

const latestAlertSchema = z.object({
  receivedAt: z.string().datetime(),
  alertType: z.string().min(1),
  symbol: z.string().min(1).optional(),
  normalizedSymbol: z.string().min(1).optional(),
  timeframe: z.string().min(1).optional(),
  side: z.string().min(1).optional(),
  status: z.enum(["fresh", "stale", "duplicate", "invalid", "context_only", "accepted"]),
  payloadHash: z.string().min(1),
  triggeredReview: z.boolean(),
  reviewStatus: z.string().min(1),
  reason: z.string().nullable().optional(),
  classification: z.string().min(1).optional(),
  payloadCompleteness: z.string().nullable().optional(),
  scannerRecommendation: thorpScannerRecommendationSchema.optional(),
  richScannerPayload: thorpRichScannerPayloadSchema.optional(),
  entryTactics: entryTacticsSchema.optional(),
  freshAlertReview: freshAlertReviewSchema.optional(),
  autoExecution: z.literal(false),
  executionIntent: z.literal("none"),
}).superRefine((alert, ctx) => {
  const hasRichClassification = alert.classification === RICH_THORP_SCANNER_CLASSIFICATION;
  const hasRichCompleteness = alert.payloadCompleteness === "rich_scanner";
  const hasRichRecommendation = alert.scannerRecommendation !== undefined;
  const hasRichPayload = alert.richScannerPayload !== undefined;
  const hasAnyRichScannerSignal = hasRichClassification || hasRichCompleteness || hasRichRecommendation || hasRichPayload;

  if (!hasAnyRichScannerSignal) return;

  if (alert.alertType !== "THORP_SCORE_READY") {
    ctx.addIssue({
      code: "custom",
      path: ["alertType"],
      message: "rich THORP scanner alert must use alertType THORP_SCORE_READY",
    });
  }
  if (!hasRichClassification) {
    ctx.addIssue({
      code: "custom",
      path: ["classification"],
      message: "rich THORP scanner alert requires classification thorp_score_ready_rich_scanner_alert",
    });
  }
  if (!hasRichCompleteness) {
    ctx.addIssue({
      code: "custom",
      path: ["payloadCompleteness"],
      message: "rich THORP scanner alert requires payloadCompleteness rich_scanner",
    });
  }
  if (!hasRichRecommendation) {
    ctx.addIssue({
      code: "custom",
      path: ["scannerRecommendation"],
      message: "rich THORP scanner alert requires scannerRecommendation",
    });
  }
  if (!hasRichPayload) {
    ctx.addIssue({
      code: "custom",
      path: ["richScannerPayload"],
      message: "rich THORP scanner alert requires richScannerPayload",
    });
  }
});

const alertIntakeSchema = z.object({
  contractVersion: z.literal("edward-alert-intake.v1"),
  generatedAt: z.string().datetime(),
  webhookStatus: z.string().min(1),
  latestAlert: latestAlertSchema.nullable(),
  latestBySymbol: z.record(z.string(), latestAlertSchema),
  latestBySymbolTimeframe: z.record(z.string(), z.record(z.string(), latestAlertSchema)),
  recentAlerts: z.array(latestAlertSchema),
  lastAlertAt: z.string().datetime().nullable().optional(),
  lastValidAlertAt: z.string().datetime().nullable().optional(),
  lastInvalidAlertAt: z.string().datetime().nullable().optional(),
  queueDepth: z.number().int().nonnegative(),
  lastReviewTriggeredAt: z.string().datetime().nullable().optional(),
  activeBasketCoverage: z.unknown().optional(),
  setupRanking: setupRankingSchema.optional(),
  freshAlertReview: freshAlertReviewSchema.optional(),
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
  brokerOrderTruth: brokerOrderTruthSchema.optional(),
  activePositionFocus: tradingPositionSchema.nullish(),
  edwardVerdict: edwardVerdictSchema,
  tradeManagementPlan: tradeManagementPlanSchema.optional(),
  liveTradeState: liveTradeStateSchema.optional(),
  tradeObjective: tradeObjectiveSchema.optional(),
  marketMovement: marketMovementSchema.optional(),
  wrongBehavior: wrongBehaviorSchema,
  recheckTrigger: recheckTriggerSchema,
  watchlistSummary: watchlistSummarySchema,
  watchlist: z.array(watchlistItemSchema),
  tradeJournal: z.array(tradeJournalEntrySchema).optional(),
});

function normalizeLegacySnapshot(raw: unknown): unknown {
  if (!isRecord(raw) || !isRecord(raw.softLandingPace)) return raw;
  const pace = raw.softLandingPace;
  if (typeof pace.currentDailyPVPct === "number") return raw;
  const currentPV = typeof pace.currentPV === "number" ? pace.currentPV : undefined;
  const baselinePV = typeof pace.baselinePV === "number" ? pace.baselinePV : undefined;
  const daysSinceBaseline = typeof pace.daysSinceBaseline === "number" ? pace.daysSinceBaseline : undefined;
  if (currentPV === undefined || baselinePV === undefined || daysSinceBaseline === undefined) return raw;

  return {
    ...raw,
    softLandingPace: {
      ...pace,
      currentDailyPVPct: deriveCurrentDailyPVPct(currentPV, baselinePV, daysSinceBaseline),
    },
  };
}

function deriveCurrentDailyPVPct(currentPV: number, baselinePV: number, daysSinceBaseline: number): number {
  if (baselinePV <= 0 || daysSinceBaseline <= 0) return 0;
  return Math.pow(currentPV / baselinePV, 1 / daysSinceBaseline) - 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type SnapshotValidationResult =
  | { ok: true; snapshot: TradingDeskSnapshot; issues: [] }
  | { ok: false; issues: string[] };

export type HealthValidationResult =
  | { ok: true; health: TradingDeskHealth; issues: [] }
  | { ok: false; issues: string[] };

export type AlertIntakeValidationResult =
  | { ok: true; alertIntake: AlertIntakeResult; issues: [] }
  | { ok: false; issues: string[] };

export function validateTradingDeskHealth(raw: unknown): HealthValidationResult {
  const result = tradingDeskHealthSchema.safeParse(raw);
  if (result.success) return { ok: true, health: result.data, issues: [] };
  return {
    ok: false,
    issues: result.error.issues.map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "health";
      return `${path}: ${issue.message}`;
    }),
  };
}

export function validateAlertIntake(raw: unknown): AlertIntakeValidationResult {
  const result = alertIntakeSchema.safeParse(raw);
  if (result.success) return { ok: true, alertIntake: result.data as AlertIntakeResult, issues: [] };
  return {
    ok: false,
    issues: result.error.issues.map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "alertIntake";
      return `${path}: ${issue.message}`;
    }),
  };
}

export function safeDegradedHealth(message: string): TradingDeskHealth {
  const unknown = { status: "unknown" as const, lastError: message, provenance: "health.json" };
  return {
    contractVersion: "edward-trading-desk-health.v1",
    generatedAt: new Date().toISOString(),
    producerStatus: "degraded",
    lastSnapshotAt: null,
    snapshotAgeSeconds: null,
    latestJsonValid: false,
    validationIssues: [],
    lastSuccessfulUpdate: null,
    lastError: message,
    sources: {
      phemex: unknown,
      thorpHud15m: unknown,
      thorpHud1h: unknown,
      thorpHud4h: unknown,
      activePlan: unknown,
      brokerTruth: unknown,
      tradingDeskSnapshot: unknown,
    },
    sourceBreakdown: { fresh: [], stale: [], unavailable: [], missing: [], error: [], technicalThesisState: "UNKNOWN" },
  };
}

export function safeUnavailableAlertIntake(message: string): AlertIntakeResult {
  return {
    contractVersion: "edward-alert-intake.v1",
    generatedAt: new Date().toISOString(),
    webhookStatus: "unavailable",
    latestAlert: null,
    latestBySymbol: {},
    latestBySymbolTimeframe: {},
    recentAlerts: [],
    lastAlertAt: null,
    lastValidAlertAt: null,
    lastInvalidAlertAt: null,
    queueDepth: 0,
    lastReviewTriggeredAt: null,
    validationIssues: [message],
  };
}

export function validateTradingDeskSnapshot(raw: unknown): SnapshotValidationResult {
  const result = tradingDeskSnapshotSchema.safeParse(normalizeLegacySnapshot(raw));
  if (result.success) {
    return { ok: true, snapshot: result.data as TradingDeskSnapshot, issues: [] };
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

export async function loadTradingDeskHealth(): Promise<TradingDeskHealth> {
  try {
    const response = await fetch(EDWARD_HEALTH_ENDPOINT, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return safeDegradedHealth(`health.json unavailable: HTTP ${response.status}`);
    const raw = await response.json();
    const validation = validateTradingDeskHealth(raw);
    if (!validation.ok) return safeDegradedHealth(`health.json validation failed: ${validation.issues.join("; ")}`);
    return validation.health;
  } catch (error) {
    return safeDegradedHealth(error instanceof Error ? error.message : "health.json unavailable");
  }
}

export async function loadAlertIntake(): Promise<AlertIntakeResult> {
  try {
    const response = await fetch(EDWARD_ALERT_INTAKE_ENDPOINT, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return safeUnavailableAlertIntake(`latest-alert.json unavailable: HTTP ${response.status}`);
    const raw = await response.json();
    const validation = validateAlertIntake(raw);
    if (!validation.ok) return safeUnavailableAlertIntake(`latest-alert.json validation failed: ${validation.issues.join("; ")}`);
    return validation.alertIntake;
  } catch (error) {
    return safeUnavailableAlertIntake(error instanceof Error ? error.message : "latest-alert.json unavailable");
  }
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
    const health = await loadTradingDeskHealth();
    const alertIntake = await loadAlertIntake();
    return {
      snapshot: { ...validation.snapshot, mode: dataMode },
      dataMode,
      source,
      validationIssues: [],
      loadedAt: new Date().toISOString(),
      health,
      alertIntake,
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
  delete snapshot.tradeManagementPlan;
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
