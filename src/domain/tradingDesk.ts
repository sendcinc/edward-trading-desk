export const TRADING_DESK_SNAPSHOT_CONTRACT_VERSION = "trading-desk-snapshot.v1" as const;
export type TradingDeskSnapshotContractVersion = typeof TRADING_DESK_SNAPSHOT_CONTRACT_VERSION;

export type DataMode = "live_available" | "live_stale" | "live_unavailable" | "demo_mode" | "validation_error";
export type SnapshotSource = "demo" | "edward-api";
export type SystemStatus = "WATCHING" | "OFFLINE" | "STALE" | "NO_OPEN_POSITION";
export type ProducerStatus = "healthy" | "degraded" | "offline";
export type SourceFreshnessStatus = "fresh" | "stale" | "unavailable" | "missing" | "error" | "unknown";
export type HealthSourceName =
  | "phemex"
  | "thorpHud15m"
  | "thorpHud1h"
  | "thorpHud4h"
  | "activePlan"
  | "brokerTruth"
  | "tradingDeskSnapshot";
export type ExposureStatus = "SAFE" | "ELEVATED" | "OVEREXPOSED" | "CRITICAL";
export type Direction = "LONG" | "SHORT";
export type PaceStatus = "AHEAD" | "BEHIND";
export type AlertIntakeStatus = string;
export type LatestAlertStatus = "fresh" | "stale" | "duplicate" | "invalid" | "context_only" | "accepted";
export type AlertSide = string;
export type ThorpScannerRecommendation =
  | "REVIEW_NOW"
  | "WAIT_FOR_RETEST"
  | "SKIP_STALE"
  | "SKIP_STRETCHED"
  | "DUPLICATE_NO_ACTION"
  | "CONTEXT_INCOMPLETE";

export type ThorpRichScannerPayload = {
  type: "THORP_SCORE_READY";
  schemaVersion: "thorp-rich-scanner.v1";
  lane: "scanner";
  system?: string;
  symbol?: string;
  tickerid?: string;
  exchange?: string;
  timeframe?: string;
  bar_time?: number | null;
  direction?: string | null;
  decision?: string | null;
  score?: number | null;
  bias_zone?: string | null;
  battlefield?: string | null;
  battlefield_pct?: number | null;
  trigger?: string | null;
  action?: string | null;
  setup_state?: string | null;
  price_at_alert?: number | null;
  entries: { scout?: number | null; a1?: number | null; a2?: number | null };
  risk: { warning?: number | null; hard?: number | null; invalidation?: number | null };
  targets: { t1?: number | null; t2?: number | null; t3?: number | null };
  range: { high?: number | null; mid?: number | null; low?: number | null };
  rotation?: string | null;
  body_pct?: number | null;
  auto_execution: false;
  executionIntent: "none";
  copy?: string;
};

export type TradingDeskSnapshot = {
  contractVersion: TradingDeskSnapshotContractVersion;
  timestamp: string;
  mode?: DataMode;
  systemStatus: SystemStatus;
  portfolio: PortfolioSnapshot;
  riskState: RiskState;
  softLandingPace: SoftLandingPace;
  openPositions: TradingPosition[];
  brokerOrderTruth?: BrokerOrderTruth;
  activePositionFocus?: TradingPosition | null;
  edwardVerdict: EdwardVerdict;
  tradeManagementPlan?: TradeManagementPlan;
  liveTradeState?: LiveTradeState;
  tradeObjective?: TradeObjective;
  marketMovement?: MarketMovement;
  wrongBehavior: WrongBehavior;
  recheckTrigger: RecheckTrigger;
  watchlistSummary: WatchlistSummary;
  watchlist: WatchlistItem[];
  tradeJournal?: TradeJournalEntry[];
};

export type TradeJournalEntry = {
  tradeId?: string;
  symbol: string;
  side: "long" | "short";
  status: string;
  entryTime?: string;
  exitTime?: string;
  entryPrice?: number;
  exitPrice?: number;
  realizedPnl?: number;
  fees?: number | null;
  funding?: number | null;
  size?: number | null;
  framework?: string;
  closeReason?: string;
  confidence?: string;
};

export type PortfolioSnapshot = {
  currentPV: number;
  equity: number;
  startingPV: number;
  baselineDate: string;
  dailyPnL?: number;
  unrealizedPnL?: number;
  marginUsed?: number;
  availableBalance?: number;
  exposureStatus: ExposureStatus;
};

export type RiskState = {
  exposureStatus: ExposureStatus;
  summary: string;
};

export type TechnicalThesisState = "VALID" | "WEAKENING" | "FAILED" | "UNKNOWN";
export type ManagementAddPermission = "ALLOWED" | "RETEST_ONLY" | "BLOCKED" | "UNKNOWN";
export type Confidence = "LOW" | "MEDIUM" | "HIGH";

export type TechnicalThesis = {
  state: TechnicalThesisState;
  confidence: Confidence;
  reasons: string[];
};

export type ManagementState = {
  riskState: ExposureStatus;
  dataConfidence: Confidence;
  addPermission: ManagementAddPermission;
  reasons: string[];
};

export type LiveTradePositionStatus = "OPEN" | "FLAT";
export type LiveTradeEntryState = "MANAGING_OPEN_TRADE" | "SCANNER_WAKEUP" | "NONE";
export type LiveTradeLifecycle = "ACTIVE_MANAGEMENT" | "FRESH_CONTEXT_REQUIRED" | "NO_ACTIVE_TRADE";
export type LiveTradeManagementBias =
  | "HOLD_PROTECT"
  | "DEFENSIVE_HOLD"
  | "REDUCE_RISK_NO_ADD"
  | "EXIT_OR_REDUCE"
  | "REVIEW_FRESH_CONTEXT"
  | "WAIT_NO_ACTION";

export type LiveTradeStateItem = {
  symbol: string;
  position_status: LiveTradePositionStatus;
  entry_state: LiveTradeEntryState;
  trade_lifecycle: LiveTradeLifecycle;
  thesis_state: TechnicalThesisState;
  risk_state: ExposureStatus;
  data_confidence: Confidence;
  management_bias: LiveTradeManagementBias;
  last_updated: string;
  recent_state_events: string[];
  auto_execution: false;
  direction?: Direction;
  current_price?: number;
  trade_management_recommendation?: string;
};

export type LiveTradeState = {
  contractVersion: "edward-live-trade-state.v1";
  generatedAt: string;
  trades: LiveTradeStateItem[];
};

export type TradeManagementRecommendation =
  | "HOLD"
  | "HOLD_WITH_PROTECTIVE_TRAIL"
  | "REDUCE_PARTIAL"
  | "REDUCE_PARTIAL_AND_TRAIL"
  | "EXIT"
  | "TAKE_PROFIT"
  | "WAIT_NO_ACTION";
export type ExitPressure = "LOW" | "MEDIUM" | "HIGH";
export type ProtectionMethod = "NONE" | "HARD_STOP" | "TRAIL_STOP" | "PARTIAL_REDUCE_AND_TRAIL";

export type TradeManagementPlan = {
  recommendation: TradeManagementRecommendation;
  confidence: Confidence;
  summary: string;
  primaryReason: string;
  doNotDo: string[];
  addPermission: ManagementAddPermission;
  exitPressure: ExitPressure;
  recheckTrigger: string;
  technicalThesisState?: TechnicalThesisState;
  protectionPlan: {
    preferredMethod: ProtectionMethod;
    suggestedProtectiveStop?: number;
    warningLevel?: number;
    hardInvalidation?: number;
    trailReason: string;
  };
  profitMath: {
    unrealizedNow?: number;
    profitIfCloseNow?: number;
    estimatedProfitAtTP1?: number;
    estimatedProfitAtTP2?: number;
    estimatedProfitAtTP3?: number;
    additionalProfitToTP1?: number;
    givebackToProtectiveStop?: number;
    lossAtHardInvalidation?: number;
  };
  softLandingImpact: {
    moonStatus: PaceStatus;
    sunStatus: PaceStatus;
    moonDailyTargetDollars: number;
    sunDailyTargetDollars: number;
    closeNowMoonContributionPct?: number;
    closeNowSunContributionPct?: number;
    tp1MoonContributionPct?: number;
    tp1SunContributionPct?: number;
    summary: string;
  };
};

export type SoftLandingPace = {
  baselinePV: number;
  baselineDate: string;
  daysSinceBaseline: number;
  currentPV: number;
  currentDailyPVPct: number;
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
  moonStatus: PaceStatus;
  sunStatus: PaceStatus;
};

export type BrokerProtectionStatus = "MISSING" | "PRESENT" | "UNKNOWN";
export type TpCoverageStatus = "NONE" | "PARTIAL" | "FULL" | "UNKNOWN";
export type RiskProtectionState = "UNPROTECTED" | "PROTECTED" | "UNKNOWN";

export type ThorpLevels = {
  scout?: number;
  a1?: number;
  a2?: number;
  hardInvalidation?: number;
  t1?: number;
  t2?: number;
  t3?: number;
};

export type ActivePlanEntryLevel = {
  level: "scout" | "a1" | "a2" | string;
  price: number;
  status: "FILLED" | "PENDING" | "PLANNED" | string;
};

export type ActiveThorpPlan = {
  contractVersion: "active-thorp-trade-plan.v1";
  symbol: string;
  direction: Direction;
  status: "ACTIVE" | string;
  source?: "manual_operator_confirmed_thorp_plan" | "rich_scanner_confirmed_plan" | string;
  createdAt?: string;
  auto_execution: false;
  executionIntent: "none";
  matchedEntryLevel?: string;
  entryLevels?: ActivePlanEntryLevel[];
  levels?: ThorpLevels;
};

export type BrokerProtection = {
  stopLossPresent: boolean;
  stopLossPrice?: number | null;
  takeProfitPrices: number[];
  openAddPrices: number[];
  riskProtectionState: RiskProtectionState;
};

export type RiskVisibility = {
  unprotectedRisk?: boolean;
  stopProtectionStatus?: BrokerProtectionStatus;
  tpCoverageStatus?: TpCoverageStatus;
  openAddContradiction?: boolean;
  activePlanLinked?: boolean;
  matchedEntryLevel?: string;
  entryLevels?: ActivePlanEntryLevel[];
  planBrokerMismatch?: boolean;
  manualAttentionRequired?: boolean;
  reasons?: string[];
};

export type BrokerOrder = {
  symbol?: string;
  side?: string;
  type?: string;
  status?: string;
  price?: number;
  stopPrice?: number;
  size?: number;
  reduceOnly?: boolean | null;
  source?: "broker";
};

export type BrokerOrderTruthSymbol = {
  symbol: string;
  positionStatus: "OPEN" | "FLAT";
  positionSide?: Direction;
  positionSize?: number | null;
  averageEntryPrice?: number | null;
  currentPrice?: number | null;
  unrealizedPnL?: number | null;
  orders: {
    stopLoss: BrokerOrder | null;
    takeProfits: BrokerOrder[];
    openAdds: BrokerOrder[];
    other: BrokerOrder[];
  };
  coverage: RiskVisibility & {
    brokerStopPresent: boolean;
    brokerStopPrice?: number | null;
    tpPrices: number[];
    openAddPrices: number[];
    missingExpectedTpPrices: number[];
  };
};

export type BrokerOrderTruth = {
  contractVersion: "broker-order-truth.v1";
  generatedAt: string;
  source: "phemex_private_read_only";
  auto_execution: false;
  symbols: BrokerOrderTruthSymbol[];
};

export type TradingPosition = {
  symbol: string;
  direction: Direction;
  entryPrice: number;
  currentPrice: number;
  size?: number;
  leverage?: number;
  margin?: number;
  liquidationPrice?: number;
  unrealizedPnL?: number;
  tp1?: number;
  tp2?: number;
  tp3?: number;
  stop?: number;
  stopSource?: "broker" | "hardInvalidation" | string;
  thorpLevels?: ThorpLevels;
  brokerProtection?: BrokerProtection;
  riskVisibility?: RiskVisibility;
  activePlanLinked?: boolean;
  activeThorpPlan?: ActiveThorpPlan;
  extendedTarget?: number;
  distanceToTP1Pct?: number;
  distanceToStopPct?: number;
  estimatedProfitAtTP1?: number;
  estimatedLossAtStop?: number;
  portfolioGainAtTP1Pct?: number;
  portfolioLossAtStopPct?: number;
  tp1ContributionToMoonDailyTargetPct?: number;
  tp1ContributionToSunDailyTargetPct?: number;
  tp1ContributionToMoonGapPct?: number;
  tp1ContributionToSunGapPct?: number;
  filledLadderEntries?: LadderEntry[];
  remainingLadderEntries?: LadderEntry[];
  plannedSizeSplit?: string;
  nextAddLevel?: number;
  averageEntryAfterFills?: number;
  addPermission?: AddPermission;
};

export type AddPermission = "ALLOWED_NOW" | "ONLY_ON_RETEST" | "NOT_ALLOWED" | "UNAVAILABLE";

export type LadderEntry = {
  label?: string;
  price?: number;
  size?: number;
  status?: "FILLED" | "PLANNED" | "WAITING" | "CANCELLED";
};

export type EdwardVerdict = {
  action:
    | "HOLD"
    | "HOLD BUT DO NOT ADD"
    | "ADD ONLY ON RETEST"
    | "ADD NOW"
    | "TAKE PARTIAL"
    | "MOVE STOP / PROTECT"
    | "REDUCE"
    | "EXIT"
    | "WAIT / NO ACTION";
  confidence: Confidence;
  movementClassification:
    | "CLEAN MOVE"
    | "HEALTHY PULLBACK"
    | "STALLING"
    | "CHOPPING"
    | "REJECTING"
    | "THESIS WEAKENING"
    | "THESIS FAILED";
  summary: string;
  whatIWouldDo: string;
  addGuidance: string;
  riskCommentary: string;
  technicalThesis?: TechnicalThesis;
  managementState?: ManagementState;
};

export type MarketMovement = {
  fifteenMinute: string;
  oneHour: string;
  fourHour: string;
  btcContext: string;
};

export type TradeObjective = {
  moonTargetPct: 0.6;
  sunTargetPct: 0.8;
  moonTargetDollars: number;
  sunTargetDollars: number;
  tp1ContributionToMoonPct?: number;
  tp1ContributionToSunPct?: number;
  worthContinuing?: boolean;
  summary: string;
};

export type WrongBehavior = {
  message: string;
};

export type RecheckTrigger = {
  condition: string;
  priceLevel?: number;
  timeframe?: "15m" | "1H" | "4H" | "BTC" | "portfolio";
};

export type WatchlistItem = {
  symbol: string;
  status: "READY" | "WATCHLIST" | "CONDITIONAL" | "EXTENDED" | "TOO LATE" | "SKIP";
  direction?: Direction;
  note?: string;
};

export type WatchlistSummary = {
  total: number;
  ready: number;
  conditional: number;
  blocked: number;
  summary: string;
};

export type TradingDeskHealthSource = {
  status: SourceFreshnessStatus;
  lastUpdatedAt?: string | null;
  ageSeconds?: number | null;
  lastError?: string | null;
  provenance?: string | null;
  detail?: string | null;
};

export type TradingDeskHealth = {
  contractVersion: "edward-trading-desk-health.v1";
  generatedAt: string;
  producerStatus: ProducerStatus;
  lastSnapshotAt?: string | null;
  snapshotAgeSeconds?: number | null;
  latestJsonValid: boolean;
  validationIssues: string[];
  lastSuccessfulUpdate?: string | null;
  lastError?: string | null;
  sources: Record<HealthSourceName, TradingDeskHealthSource>;
  sourceBreakdown?: {
    fresh?: string[];
    stale?: string[];
    unavailable?: string[];
    missing?: string[];
    error?: string[];
    technicalThesisState?: TechnicalThesisState;
  };
};

export type LatestAlert = {
  receivedAt: string;
  alertType: string;
  symbol?: string;
  normalizedSymbol?: string;
  timeframe?: string;
  side?: AlertSide;
  status: LatestAlertStatus;
  payloadHash: string;
  triggeredReview: boolean;
  reviewStatus: string;
  reason?: string | null;
  classification?: string;
  payloadCompleteness?: "rich_scanner" | string | null;
  scannerRecommendation?: ThorpScannerRecommendation;
  richScannerPayload?: ThorpRichScannerPayload;
  autoExecution: false;
  executionIntent: "none";
};

export type AlertIntakeResult = {
  contractVersion: "edward-alert-intake.v1";
  generatedAt: string;
  webhookStatus: AlertIntakeStatus;
  latestAlert: LatestAlert | null;
  latestBySymbol: Record<string, LatestAlert>;
  latestBySymbolTimeframe: Record<string, Record<string, LatestAlert>>;
  recentAlerts: LatestAlert[];
  lastAlertAt?: string | null;
  lastValidAlertAt?: string | null;
  lastInvalidAlertAt?: string | null;
  queueDepth: number;
  lastReviewTriggeredAt?: string | null;
  validationIssues?: string[];
};

export type TradingDeskLoadResult = {
  snapshot: TradingDeskSnapshot;
  dataMode: DataMode;
  source: SnapshotSource;
  scenario?: string;
  validationIssues: string[];
  loadedAt: string;
  health?: TradingDeskHealth;
  alertIntake?: AlertIntakeResult;
};
