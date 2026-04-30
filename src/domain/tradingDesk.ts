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

export type SoftLandingPace = {
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
  confidence: "LOW" | "MEDIUM" | "HIGH";
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
