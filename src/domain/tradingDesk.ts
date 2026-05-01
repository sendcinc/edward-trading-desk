export const TRADING_DESK_SNAPSHOT_CONTRACT_VERSION = "trading-desk-snapshot.v1" as const;
export type TradingDeskSnapshotContractVersion = typeof TRADING_DESK_SNAPSHOT_CONTRACT_VERSION;

export type DataMode = "live_available" | "live_stale" | "live_unavailable" | "demo_mode" | "validation_error";
export type SnapshotSource = "demo" | "edward-api";
export type SystemStatus = "WATCHING" | "OFFLINE" | "STALE" | "NO_OPEN_POSITION";
export type ExposureStatus = "SAFE" | "ELEVATED" | "OVEREXPOSED" | "CRITICAL";
export type Direction = "LONG" | "SHORT";
export type PaceStatus = "AHEAD" | "BEHIND";

export type TradingDeskSnapshot = {
  contractVersion: TradingDeskSnapshotContractVersion;
  timestamp: string;
  mode?: DataMode;
  systemStatus: SystemStatus;
  portfolio: PortfolioSnapshot;
  riskState: RiskState;
  softLandingPace: SoftLandingPace;
  openPositions: TradingPosition[];
  activePositionFocus?: TradingPosition | null;
  edwardVerdict: EdwardVerdict;
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
  stop?: number;
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

export type TradingDeskLoadResult = {
  snapshot: TradingDeskSnapshot;
  dataMode: DataMode;
  source: SnapshotSource;
  scenario?: string;
  validationIssues: string[];
  loadedAt: string;
};
