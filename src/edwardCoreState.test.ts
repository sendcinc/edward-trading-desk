import { describe, expect, it } from "vitest";
import { deriveEdwardCoreState } from "./edwardCoreState";
import type { TradingDeskHealth, TradingDeskSnapshot } from "./domain/tradingDesk";

const baseSnapshot = (): TradingDeskSnapshot => ({
  contractVersion: "trading-desk-snapshot.v1",
  timestamp: "2026-05-02T16:45:00.000Z",
  systemStatus: "WATCHING",
  portfolio: {
    currentPV: 1000,
    equity: 1000,
    startingPV: 1000,
    baselineDate: "2026-05-01",
    exposureStatus: "SAFE",
  },
  riskState: { exposureStatus: "SAFE", summary: "Safe" },
  softLandingPace: {
    baselinePV: 1000,
    baselineDate: "2026-05-01",
    daysSinceBaseline: 1,
    currentPV: 1000,
    currentDailyPVPct: 0,
    moonDailyRate: 0.006,
    sunDailyRate: 0.008,
    moonTargetPVToday: 1006,
    sunTargetPVToday: 1008,
    moonGapDollars: 6,
    sunGapDollars: 8,
    moonGapPct: 0.006,
    sunGapPct: 0.008,
    moonDailyTargetDollars: 6,
    sunDailyTargetDollars: 8,
    moonStatus: "AHEAD",
    sunStatus: "AHEAD",
  },
  openPositions: [],
  activePositionFocus: null,
  edwardVerdict: {
    action: "WAIT / NO ACTION",
    confidence: "LOW",
    movementClassification: "CHOPPING",
    summary: "No setup.",
    whatIWouldDo: "Wait.",
    addGuidance: "UNKNOWN",
    riskCommentary: "No active risk.",
  },
  wrongBehavior: { message: "Do not chase." },
  recheckTrigger: { condition: "new alert" },
  watchlistSummary: { ready: 0, conditional: 0, blocked: 0, total: 0, summary: "No setups." },
  watchlist: [],
});

const baseHealth = (producerStatus: TradingDeskHealth["producerStatus"] = "healthy"): TradingDeskHealth => ({
  contractVersion: "edward-trading-desk-health.v1",
  generatedAt: "2026-05-02T16:45:00.000Z",
  producerStatus,
  lastSnapshotAt: "2026-05-02T16:45:00.000Z",
  snapshotAgeSeconds: 10,
  latestJsonValid: true,
  validationIssues: [],
  lastSuccessfulUpdate: "2026-05-02T16:45:00.000Z",
  lastError: null,
  sources: {
    phemex: { status: "fresh", provenance: "test" },
    thorpHud15m: { status: "fresh", provenance: "test" },
    thorpHud1h: { status: "fresh", provenance: "test" },
    thorpHud4h: { status: "fresh", provenance: "test" },
    activePlan: { status: "fresh", provenance: "test" },
    brokerTruth: { status: "fresh", provenance: "test" },
    tradingDeskSnapshot: { status: "fresh", provenance: "test" },
  },
  sourceBreakdown: { fresh: [], stale: [], unavailable: [], missing: [], error: [], technicalThesisState: "UNKNOWN" },
});

const withTrade = (patch: Partial<NonNullable<TradingDeskSnapshot["liveTradeState"]>["trades"][number]>): TradingDeskSnapshot => ({
  ...baseSnapshot(),
  liveTradeState: {
    contractVersion: "edward-live-trade-state.v1",
    generatedAt: "2026-05-02T16:45:00.000Z",
    trades: [{
      symbol: "BCHUSDT",
      position_status: "OPEN",
      entry_state: "MANAGING_OPEN_TRADE",
      trade_lifecycle: "ACTIVE_MANAGEMENT",
      thesis_state: "VALID",
      risk_state: "SAFE",
      data_confidence: "HIGH",
      management_bias: "HOLD_PROTECT",
      last_updated: "2026-05-02T16:45:00.000Z",
      recent_state_events: [],
      auto_execution: false,
      ...patch,
    }],
  },
});

describe("Edward Core avatar state mapping", () => {
  it("maps offline or unavailable health to OFFLINE", () => {
    expect(deriveEdwardCoreState({ snapshot: baseSnapshot(), health: baseHealth("offline") }).avatarState).toBe("OFFLINE");
  });

  it("maps degraded health with no active trade to DEGRADED_VISIBILITY", () => {
    expect(deriveEdwardCoreState({ snapshot: baseSnapshot(), health: baseHealth("degraded") }).avatarState).toBe("DEGRADED_VISIBILITY");
  });

  it("maps missing liveTradeState to STALE when health is healthy", () => {
    expect(deriveEdwardCoreState({ snapshot: baseSnapshot(), health: baseHealth("healthy") }).avatarState).toBe("STALE");
  });

  it("prioritizes low data confidence, exit bias, elevated risk, then active open-trade analysis", () => {
    expect(deriveEdwardCoreState({ snapshot: withTrade({ data_confidence: "LOW" }), health: baseHealth() }).avatarState).toBe("STALE");
    expect(deriveEdwardCoreState({ snapshot: withTrade({ management_bias: "EXIT_OR_REDUCE" }), health: baseHealth() }).avatarState).toBe("CRITICAL");
    expect(deriveEdwardCoreState({ snapshot: withTrade({ risk_state: "OVEREXPOSED" }), health: baseHealth() }).avatarState).toBe("WARNING");
    expect(deriveEdwardCoreState({ snapshot: withTrade({ position_status: "OPEN", data_confidence: "MEDIUM" }), health: baseHealth() }).avatarState).toBe("ANALYZING");
  });

  it("always reports manual read-only operation and active trade copy without enabling execution", () => {
    const core = deriveEdwardCoreState({ snapshot: withTrade({ symbol: "BCHUSDT", risk_state: "ELEVATED" }), health: baseHealth() });
    expect(core.title).toBe("Edward Active");
    expect(core.subtitle).toContain("BCHUSDT");
    expect(core.guardrail).toBe("Manual / Read-only");
    expect(core.allAutoExecutionFalse).toBe(true);
  });
});
