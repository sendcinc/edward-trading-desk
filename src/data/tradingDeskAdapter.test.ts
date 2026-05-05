import { describe, expect, it, vi } from "vitest";
import { demoTradingDeskSnapshot } from "./demoSnapshot";
import {
  buildDemoSnapshot,
  loadTradingDeskSnapshot,
  resolveDataMode,
  safeDegradedHealth,
  safeUnavailableAlertIntake,
  validateAlertIntake,
  validateTradingDeskHealth,
  validateTradingDeskSnapshot,
  type DemoScenario,
} from "./tradingDeskAdapter";

import { TRADING_DESK_SNAPSHOT_CONTRACT_VERSION } from "../domain/tradingDesk";

const validSnapshot = () => structuredClone(demoTradingDeskSnapshot);
const validHealth = () => ({
  contractVersion: "edward-trading-desk-health.v1",
  generatedAt: "2026-05-01T15:00:30.000Z",
  producerStatus: "healthy",
  lastSnapshotAt: "2026-05-01T15:00:00.000Z",
  snapshotAgeSeconds: 30,
  latestJsonValid: true,
  validationIssues: [],
  lastSuccessfulUpdate: "2026-05-01T15:00:00.000Z",
  lastError: null,
  sources: {
    phemex: { status: "fresh", provenance: "Phemex" },
    thorpHud15m: { status: "fresh", provenance: "HUD" },
    thorpHud1h: { status: "fresh", provenance: "HUD" },
    thorpHud4h: { status: "fresh", provenance: "HUD" },
    activePlan: { status: "fresh", provenance: "THORP" },
    brokerTruth: { status: "fresh", provenance: "Broker" },
    tradingDeskSnapshot: { status: "fresh", provenance: "Snapshot" },
  },
  sourceBreakdown: { fresh: ["phemex"], stale: [], unavailable: [], missing: [], error: [], technicalThesisState: "VALID" },
});
const validAlertIntake = () => ({
  contractVersion: "edward-alert-intake.v1",
  generatedAt: new Date().toISOString(),
  webhookStatus: "live",
  latestAlert: {
    receivedAt: new Date().toISOString(),
    alertType: "THORP_HUD",
    symbol: "ETHUSDT",
    normalizedSymbol: "ETHUSDT",
    timeframe: "15m",
    side: "long",
    status: "accepted",
    payloadHash: "abc123",
    triggeredReview: true,
    reviewStatus: "queued",
    reason: "HUD long setup received.",
    autoExecution: false,
    executionIntent: "none",
  },
  latestBySymbol: {},
  latestBySymbolTimeframe: {},
  recentAlerts: [],
  lastAlertAt: new Date().toISOString(),
  lastValidAlertAt: new Date().toISOString(),
  lastInvalidAlertAt: null,
  queueDepth: 1,
  lastReviewTriggeredAt: new Date().toISOString(),
});

describe("alert intake validation", () => {
  it("accepts the latest alert intake contract", () => {
    const result = validateAlertIntake(validAlertIntake());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.alertIntake.contractVersion).toBe("edward-alert-intake.v1");
      expect(result.alertIntake.latestAlert?.autoExecution).toBe(false);
      expect(result.alertIntake.latestAlert?.executionIntent).toBe("none");
    }
  });

  it("returns safe unavailable alert intake when latest-alert is missing", () => {
    const alertIntake = safeUnavailableAlertIntake("latest-alert.json unavailable");

    expect(alertIntake.webhookStatus).toBe("unavailable");
    expect(alertIntake.latestAlert).toBeNull();
    expect(alertIntake.recentAlerts).toEqual([]);
    expect(alertIntake.validationIssues?.join("\n")).toContain("latest-alert.json unavailable");
  });

  it("rejects malformed alert intake so it cannot look live", () => {
    const result = validateAlertIntake({ ...validAlertIntake(), latestAlert: { autoExecution: true, executionIntent: "market" } });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.join("\n")).toContain("latestAlert.receivedAt");
      expect(result.issues.join("\n")).toContain("latestAlert.autoExecution");
      expect(result.issues.join("\n")).toContain("latestAlert.executionIntent");
    }
  });
});

describe("trading desk health validation", () => {
  it("accepts a valid optional producer health contract", () => {
    const result = validateTradingDeskHealth(validHealth());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.health.producerStatus).toBe("healthy");
      expect(result.health.sources.tradingDeskSnapshot.status).toBe("fresh");
    }
  });

  it("returns safe degraded health when health is missing or unavailable", () => {
    const health = safeDegradedHealth("health.json unavailable");

    expect(health.producerStatus).toBe("degraded");
    expect(health.latestJsonValid).toBe(false);
    expect(health.sources.tradingDeskSnapshot.status).toBe("unknown");
    expect(health.lastError).toContain("health.json unavailable");
  });
});

describe("trading desk snapshot validation", () => {
  it("accepts the demo snapshot contract", () => {
    const result = validateTradingDeskSnapshot(validSnapshot());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.contractVersion).toBe(TRADING_DESK_SNAPSHOT_CONTRACT_VERSION);
      expect(result.snapshot.portfolio.currentPV).toBeGreaterThan(0);
      expect(result.snapshot.portfolio.equity).toBeGreaterThan(0);
      expect(result.snapshot.softLandingPace.currentDailyPVPct).toBeGreaterThanOrEqual(0);
      expect(result.snapshot.softLandingPace.moonDailyRate).toBe(0.006);
      expect(result.snapshot.softLandingPace.sunDailyRate).toBe(0.008);
      expect(result.snapshot.edwardVerdict.action).toBe("HOLD BUT DO NOT ADD");
      expect(result.snapshot.wrongBehavior.message).toContain("Do not");
      expect(result.snapshot.recheckTrigger.condition).toContain("Recheck");
      expect(result.snapshot.watchlistSummary.total).toBe(result.snapshot.watchlist.length);
    }
  });

  it("rejects snapshots missing required portfolio PV/equity fields", () => {
    const snapshot = validSnapshot() as Record<string, unknown>;
    snapshot.portfolio = { exposureStatus: "SAFE" };

    const result = validateTradingDeskSnapshot(snapshot);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.join("\n")).toContain("portfolio.currentPV");
      expect(result.issues.join("\n")).toContain("portfolio.equity");
    }
  });

  it("rejects snapshots missing required Edward verdict, warning, recheck, and watchlist summary", () => {
    const snapshot = validSnapshot() as Record<string, unknown>;
    delete snapshot.edwardVerdict;
    delete snapshot.wrongBehavior;
    delete snapshot.recheckTrigger;
    delete snapshot.watchlistSummary;

    const result = validateTradingDeskSnapshot(snapshot);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const issues = result.issues.join("\n");
      expect(issues).toContain("edwardVerdict");
      expect(issues).toContain("wrongBehavior");
      expect(issues).toContain("recheckTrigger");
      expect(issues).toContain("watchlistSummary");
    }
  });

  it("accepts older live snapshots without current daily PV by deriving it", () => {
    const snapshot = validSnapshot() as Record<string, unknown>;
    const pace = { ...(snapshot.softLandingPace as Record<string, unknown>) };
    delete pace.currentDailyPVPct;
    snapshot.softLandingPace = pace;

    const result = validateTradingDeskSnapshot(snapshot);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.softLandingPace.currentDailyPVPct).toBeGreaterThanOrEqual(0);
    }
  });

  it("accepts optional ladder and add-permission fields without requiring them", () => {
    const withoutLadder = validateTradingDeskSnapshot(validSnapshot());
    expect(withoutLadder.ok).toBe(true);

    const snapshot = validSnapshot();
    snapshot.activePositionFocus = {
      ...snapshot.activePositionFocus!,
      filledLadderEntries: [{ label: "starter", price: 145.2, size: 5, status: "FILLED" }],
      remainingLadderEntries: [{ label: "retest add", price: 146.1, size: 3, status: "WAITING" }],
      plannedSizeSplit: "70 / 30 only after retest",
      nextAddLevel: 146.1,
      averageEntryAfterFills: 145.47,
      addPermission: "ONLY_ON_RETEST",
    };
    snapshot.openPositions = [snapshot.activePositionFocus];

    const withLadder = validateTradingDeskSnapshot(snapshot);
    expect(withLadder.ok).toBe(true);
    if (withLadder.ok) {
      expect(withLadder.snapshot.activePositionFocus?.addPermission).toBe("ONLY_ON_RETEST");
      expect(withLadder.snapshot.activePositionFocus?.remainingLadderEntries?.[0].status).toBe("WAITING");
    }
  });

  it("accepts optional active THORP plan linkage fields without requiring them", () => {
    const snapshot = validSnapshot();
    snapshot.activePositionFocus = {
      ...snapshot.activePositionFocus!,
      activePlanLinked: true,
      activeThorpPlan: {
        contractVersion: "active-thorp-trade-plan.v1",
        symbol: "ETHUSDT",
        direction: "SHORT",
        status: "ACTIVE",
        source: "manual_operator_confirmed_thorp_plan",
        createdAt: "2026-05-03T18:00:00.000Z",
        auto_execution: false,
        executionIntent: "none",
        matchedEntryLevel: "a1",
        entryLevels: [
          { level: "a1", price: 2333.08, status: "FILLED" },
          { level: "a2", price: 2343.69, status: "PENDING" },
        ],
        levels: { scout: 2324.12, a1: 2333.08, a2: 2343.69, hardInvalidation: 2352.78, t1: 2282.83, t2: 2261.63, t3: 2219.24 },
      },
      riskVisibility: {
        unprotectedRisk: true,
        stopProtectionStatus: "MISSING",
        tpCoverageStatus: "PARTIAL",
        openAddContradiction: true,
        activePlanLinked: true,
        matchedEntryLevel: "a1",
        entryLevels: [
          { level: "a1", price: 2333.08, status: "FILLED" },
          { level: "a2", price: 2343.69, status: "PENDING" },
        ],
        planBrokerMismatch: true,
        manualAttentionRequired: true,
        reasons: ["BROKER_STOP_MISSING", "TP2_MISSING", "TP3_MISSING", "ADD_PERMISSION_NO_BUT_OPEN_ADD_ORDER_EXISTS"],
      },
    };
    snapshot.openPositions = [snapshot.activePositionFocus];

    const result = validateTradingDeskSnapshot(snapshot);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.activePositionFocus?.activeThorpPlan?.matchedEntryLevel).toBe("a1");
      expect(result.snapshot.activePositionFocus?.riskVisibility?.entryLevels?.[1].status).toBe("PENDING");
    }
  });

  it.each([null, "unknown", "scout", "a1", "a2"])(
    "accepts Phase 3A.3 matchedEntryLevel value %s from runtime coverage",
    (matchedEntryLevel) => {
      const snapshot = validSnapshot() as Record<string, unknown>;
      const focus = {
        ...(snapshot.activePositionFocus as Record<string, unknown>),
        activePlanLinked: false,
        riskVisibility: {
          unprotectedRisk: true,
          stopProtectionStatus: "MISSING",
          tpCoverageStatus: "PARTIAL",
          openAddContradiction: false,
          activePlanLinked: false,
          matchedEntryLevel,
          entryLevels: [],
          planBrokerMismatch: true,
          manualAttentionRequired: true,
          reasons: ["BROKER_STOP_MISSING"],
        },
      };
      snapshot.activePositionFocus = focus;
      snapshot.openPositions = [focus];
      snapshot.brokerOrderTruth = {
        contractVersion: "broker-order-truth.v1",
        generatedAt: "2026-05-03T19:40:00.000Z",
        source: "phemex_private_read_only",
        auto_execution: false,
        symbols: [
          {
            symbol: "ETHUSDT",
            positionStatus: "OPEN",
            positionSide: "SHORT",
            positionSize: 1,
            averageEntryPrice: 2333.08,
            currentPrice: 2320,
            unrealizedPnL: 12,
            orders: { stopLoss: null, takeProfits: [], openAdds: [], other: [] },
            coverage: {
              brokerStopPresent: false,
              brokerStopPrice: null,
              tpPrices: [],
              openAddPrices: [],
              missingExpectedTpPrices: [],
              unprotectedRisk: true,
              stopProtectionStatus: "MISSING",
              tpCoverageStatus: "UNKNOWN",
              openAddContradiction: false,
              activePlanLinked: false,
              matchedEntryLevel,
              entryLevels: [],
              planBrokerMismatch: true,
              manualAttentionRequired: true,
              reasons: ["BROKER_STOP_MISSING"],
            },
          },
        ],
      };

      const result = validateTradingDeskSnapshot(snapshot);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.snapshot.activePositionFocus?.riskVisibility?.matchedEntryLevel).toBe(matchedEntryLevel);
        expect(result.snapshot.brokerOrderTruth?.symbols[0]?.coverage.matchedEntryLevel).toBe(matchedEntryLevel);
        expect(result.snapshot.openPositions[0]?.riskVisibility?.matchedEntryLevel).toBe(matchedEntryLevel);
      }
    },
  );

  it("accepts omitted Phase 3A.3 matchedEntryLevel values from runtime coverage", () => {
    const snapshot = validSnapshot() as Record<string, unknown>;
    const focus = {
      ...(snapshot.activePositionFocus as Record<string, unknown>),
      riskVisibility: {
        unprotectedRisk: true,
        stopProtectionStatus: "MISSING",
        tpCoverageStatus: "PARTIAL",
        activePlanLinked: false,
        entryLevels: [],
        planBrokerMismatch: true,
        manualAttentionRequired: true,
        reasons: ["BROKER_STOP_MISSING"],
      },
    };
    snapshot.activePositionFocus = focus;
    snapshot.openPositions = [focus];

    const result = validateTradingDeskSnapshot(snapshot);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.activePositionFocus?.riskVisibility?.matchedEntryLevel).toBeUndefined();
      expect(result.snapshot.openPositions[0]?.riskVisibility?.matchedEntryLevel).toBeUndefined();
    }
  });

  it("rejects executable active THORP plan fields", () => {
    const snapshot = validSnapshot() as Record<string, unknown>;
    snapshot.activePositionFocus = {
      ...(snapshot.activePositionFocus as Record<string, unknown>),
      activeThorpPlan: {
        contractVersion: "active-thorp-trade-plan.v1",
        symbol: "ETHUSDT",
        direction: "SHORT",
        status: "ACTIVE",
        auto_execution: true,
        executionIntent: "none",
      },
    };

    const result = validateTradingDeskSnapshot(snapshot);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.join("\n")).toContain("activeThorpPlan.auto_execution");
    }
  });

  it("accepts older snapshots without a trade management plan", () => {
    const snapshot = validSnapshot();
    delete snapshot.tradeManagementPlan;

    const oldSnapshot = validateTradingDeskSnapshot(snapshot);

    expect(oldSnapshot.ok).toBe(true);
    if (oldSnapshot.ok) {
      expect(oldSnapshot.snapshot.tradeManagementPlan).toBeUndefined();
    }
  });

  it("accepts optional live trade state when present", () => {
    const snapshot = validSnapshot();
    snapshot.liveTradeState = {
      contractVersion: "edward-live-trade-state.v1",
      generatedAt: "2026-05-02T13:00:00.000Z",
      trades: [
        {
          symbol: "BCHUSDT",
          position_status: "OPEN",
          entry_state: "MANAGING_OPEN_TRADE",
          trade_lifecycle: "ACTIVE_MANAGEMENT",
          thesis_state: "VALID",
          risk_state: "OVEREXPOSED",
          data_confidence: "HIGH",
          management_bias: "REDUCE_RISK_NO_ADD",
          last_updated: "2026-05-02T13:00:00.000Z",
          recent_state_events: ["RISK_OVEREXPOSED"],
          auto_execution: false,
          direction: "LONG",
          current_price: 446.34,
          trade_management_recommendation: "REDUCE_PARTIAL_AND_TRAIL",
        },
      ],
    };

    const result = validateTradingDeskSnapshot(snapshot);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.liveTradeState?.trades[0].management_bias).toBe("REDUCE_RISK_NO_ADD");
      expect(result.snapshot.liveTradeState?.trades[0].auto_execution).toBe(false);
    }
  });

  it("rejects live trade state if auto execution is not explicitly false", () => {
    const snapshot = validSnapshot() as Record<string, unknown>;
    snapshot.liveTradeState = {
      contractVersion: "edward-live-trade-state.v1",
      generatedAt: "2026-05-02T13:00:00.000Z",
      trades: [
        {
          symbol: "BCHUSDT",
          position_status: "OPEN",
          entry_state: "MANAGING_OPEN_TRADE",
          trade_lifecycle: "ACTIVE_MANAGEMENT",
          thesis_state: "VALID",
          risk_state: "SAFE",
          data_confidence: "HIGH",
          management_bias: "HOLD_PROTECT",
          last_updated: "2026-05-02T13:00:00.000Z",
          recent_state_events: [],
          auto_execution: true,
        },
      ],
    };

    const result = validateTradingDeskSnapshot(snapshot);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.join("\n")).toContain("liveTradeState.trades.0.auto_execution");
    }
  });

  it("accepts optional trade management plan when present", () => {
    const snapshot = validSnapshot();
    snapshot.tradeManagementPlan = {
      recommendation: "HOLD_WITH_PROTECTIVE_TRAIL",
      confidence: "MEDIUM",
      summary: "Trade thesis is valid, but management risk requires protection.",
      primaryReason: "VALID_THESIS_GREEN_TRADE_NEEDS_PROTECTION",
      doNotDo: ["Do not add while exposure is elevated.", "Do not widen the stop."],
      addPermission: "BLOCKED",
      exitPressure: "MEDIUM",
      recheckTrigger: "Recheck on warning level touch or TP1 tag.",
      protectionPlan: {
        preferredMethod: "PARTIAL_REDUCE_AND_TRAIL",
        suggestedProtectiveStop: 448,
        warningLevel: 440.17,
        hardInvalidation: 438.49,
        trailReason: "No stop means protection is mandatory.",
      },
      profitMath: {
        unrealizedNow: 11.34,
        profitIfCloseNow: 11.34,
        estimatedProfitAtTP1: 43.14,
        additionalProfitToTP1: 31.8,
        givebackToProtectiveStop: 0,
        lossAtHardInvalidation: -12.21,
      },
      softLandingImpact: {
        moonStatus: "BEHIND",
        sunStatus: "BEHIND",
        moonDailyTargetDollars: 15,
        sunDailyTargetDollars: 20,
        closeNowMoonContributionPct: 0.756,
        closeNowSunContributionPct: 0.567,
        tp1MoonContributionPct: 2.876,
        tp1SunContributionPct: 2.157,
        summary: "TP1 would materially help Moon/Sun pace without adding size.",
      },
    };

    const result = validateTradingDeskSnapshot(snapshot);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.tradeManagementPlan?.recommendation).toBe("HOLD_WITH_PROTECTIVE_TRAIL");
      expect(result.snapshot.tradeManagementPlan?.protectionPlan.preferredMethod).toBe("PARTIAL_REDUCE_AND_TRAIL");
      expect(result.snapshot.tradeManagementPlan?.softLandingImpact.tp1MoonContributionPct).toBeGreaterThan(0);
    }
  });

  it("rejects malformed trade management plans without weakening the base contract", () => {
    const snapshot = validSnapshot() as Record<string, unknown>;
    snapshot.tradeManagementPlan = {
      recommendation: "HOLD_WITH_PROTECTIVE_TRAIL",
      confidence: "HIGH",
      summary: "",
    };

    const result = validateTradingDeskSnapshot(snapshot);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const issues = result.issues.join("\n");
      expect(issues).toContain("tradeManagementPlan.summary");
      expect(issues).toContain("tradeManagementPlan.primaryReason");
      expect(issues).toContain("tradeManagementPlan.protectionPlan");
    }
  });

  it("accepts optional separated technical thesis and management state fields", () => {
    const oldSnapshot = validateTradingDeskSnapshot(validSnapshot());
    expect(oldSnapshot.ok).toBe(true);

    const snapshot = validSnapshot();
    snapshot.edwardVerdict = {
      ...snapshot.edwardVerdict,
      movementClassification: "STALLING",
      technicalThesis: {
        state: "VALID",
        confidence: "MEDIUM",
        reasons: ["HUD_15M_READY_LONG", "HUD_BATTLEFIELD_GREEN"],
      },
      managementState: {
        riskState: "OVEREXPOSED",
        dataConfidence: "LOW",
        addPermission: "BLOCKED",
        reasons: ["ACCOUNT_EXPOSURE_OVER_LIMIT", "ACTIVE_PLAN_MISSING"],
      },
    };

    const result = validateTradingDeskSnapshot(snapshot);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.edwardVerdict.technicalThesis?.state).toBe("VALID");
      expect(result.snapshot.edwardVerdict.managementState?.addPermission).toBe("BLOCKED");
    }
  });
});

describe("data mode resolution", () => {
  it("maps fresh live snapshots to live_available", () => {
    expect(resolveDataMode({ source: "edward-api", snapshot: validSnapshot(), now: new Date() })).toBe("live_available");
  });

  it("maps old live snapshots to live_stale", () => {
    const snapshot = validSnapshot();
    snapshot.timestamp = new Date(Date.now() - 11 * 60 * 1000).toISOString();

    expect(resolveDataMode({ source: "edward-api", snapshot, now: new Date() })).toBe("live_stale");
  });

  it("maps demo snapshots to demo_mode", () => {
    expect(resolveDataMode({ source: "demo", snapshot: validSnapshot(), now: new Date() })).toBe("demo_mode");
  });
});

describe("adapter load states", () => {
  it("fetches the static public Edward snapshot first, optional health second, and optional latest alert third", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(validSnapshot()), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(validHealth()), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(validAlertIntake()), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadTradingDeskSnapshot({ source: "edward-api" });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/trading-desk/data/latest.json", {
      headers: { Accept: "application/json" },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/trading-desk/data/health.json", {
      headers: { Accept: "application/json" },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/trading-desk/data/latest-alert.json", {
      headers: { Accept: "application/json" },
    });
    expect(result.dataMode).toBe("live_available");
    expect(result.health?.producerStatus).toBe("healthy");
    expect(result.alertIntake?.latestAlert?.symbol).toBe("ETHUSDT");
    expect(result.source).toBe("edward-api");
    vi.unstubAllGlobals();
  });

  it("keeps old latest.json and health.json usable when latest alert is unavailable", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(validSnapshot()), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(validHealth()), { status: 200 }))
      .mockResolvedValueOnce(new Response("missing", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadTradingDeskSnapshot({ source: "edward-api" });

    expect(result.dataMode).toBe("live_available");
    expect(result.health?.producerStatus).toBe("healthy");
    expect(result.alertIntake?.webhookStatus).toBe("unavailable");
    expect(result.alertIntake?.latestAlert).toBeNull();
    expect(result.alertIntake?.validationIssues?.join("\n")).toContain("HTTP 404");
    vi.unstubAllGlobals();
  });

  it("keeps old latest.json usable when health is unavailable", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(validSnapshot()), { status: 200 }))
      .mockResolvedValueOnce(new Response("missing", { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(validAlertIntake()), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadTradingDeskSnapshot({ source: "edward-api" });

    expect(result.dataMode).toBe("live_available");
    expect(result.health?.producerStatus).toBe("degraded");
    expect(result.health?.lastError).toContain("HTTP 404");
    expect(result.alertIntake?.latestAlert?.symbol).toBe("ETHUSDT");
    vi.unstubAllGlobals();
  });

  it("degrades malformed latest-alert without changing live snapshot status", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(validSnapshot()), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(validHealth()), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ broken: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadTradingDeskSnapshot({ source: "edward-api" });

    expect(result.dataMode).toBe("live_available");
    expect(result.alertIntake?.webhookStatus).toBe("unavailable");
    expect(result.alertIntake?.latestAlert).toBeNull();
    expect(result.alertIntake?.validationIssues?.join("\n")).toContain("latest-alert.json validation failed");
    vi.unstubAllGlobals();
  });

  it("returns validation_error when Edward returns an invalid snapshot", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ broken: true }), { status: 200 })));

    const result = await loadTradingDeskSnapshot({ source: "edward-api" });

    expect(result.dataMode).toBe("validation_error");
    expect(result.validationIssues.length).toBeGreaterThan(0);
    vi.unstubAllGlobals();
  });

  it("returns live_unavailable when Edward cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Nope", { status: 503 })));

    const result = await loadTradingDeskSnapshot({ source: "edward-api" });

    expect(result.dataMode).toBe("live_unavailable");
    expect(result.snapshot.systemStatus).toBe("OFFLINE");
    vi.unstubAllGlobals();
  });

  it.each<DemoScenario>([
    "normal_demo",
    "stale_data",
    "unavailable_edward",
    "invalid_snapshot",
    "no_active_trade",
    "active_trade_under_pressure",
    "active_trade_healthy",
  ])("builds demo scenario %s", (scenario) => {
    const result = buildDemoSnapshot(scenario);

    expect(result.scenario).toBe(scenario);
    expect(["demo_mode", "live_stale", "live_unavailable", "validation_error"]).toContain(result.dataMode);
  });

  it("does not render demo management advice for unavailable, invalid, or no-position fallback states", () => {
    for (const scenario of ["unavailable_edward", "invalid_snapshot", "no_active_trade"] satisfies DemoScenario[]) {
      const result = buildDemoSnapshot(scenario);

      expect(result.snapshot.tradeManagementPlan).toBeUndefined();
    }
  });
});


describe("rich THORP scanner alert validation", () => {
  const richPayload = {
    type: "THORP_SCORE_READY",
    schemaVersion: "thorp-rich-scanner.v1",
    lane: "scanner",
    system: "THORP_V0_5_8_COMPACT_HUD",
    symbol: "XRPUSDT.P",
    tickerid: "PHEMEX:XRPUSDT.P",
    exchange: "PHEMEX",
    timeframe: "15",
    bar_time: 1710000000000,
    direction: "LONG",
    decision: "READY | 10",
    score: 10,
    bias_zone: "LONG LOWER",
    battlefield: "GREEN | 11.24%",
    battlefield_pct: 11.24,
    trigger: "LOCKED LONG",
    action: "FRESH LONG OK",
    setup_state: "FRESH",
    price_at_alert: 1.3885,
    entries: { scout: 1.3876, a1: 1.371, a2: 1.3545 },
    risk: { warning: 1.3483, hard: 1.3403, invalidation: 1.3403 },
    targets: { t1: 1.4286, t2: 1.4553, t3: 1.5088 },
    range: { high: 1.5088, mid: 1.4286, low: 1.3483 },
    rotation: "Rot OK",
    body_pct: 1.74,
    auto_execution: false,
    executionIntent: "none",
    copy: "THORP detected a potential setup. This is not an execution command.",
  };

  const richAlertIntake = (latestPatch: Record<string, unknown> = {}, payloadPatch: Record<string, unknown> = {}, intakePatch: Record<string, unknown> = {}) => ({
    ...validAlertIntake(),
    queueDepth: 0,
    latestAlert: {
      receivedAt: "2026-05-03T11:45:00.000Z",
      alertType: "THORP_SCORE_READY",
      classification: "thorp_score_ready_rich_scanner_alert",
      payloadCompleteness: "rich_scanner",
      scannerRecommendation: "REVIEW_NOW",
      richScannerPayload: { ...richPayload, ...payloadPatch },
      symbol: "XRPUSDT.P",
      normalizedSymbol: "XRPUSDT.P",
      timeframe: "15",
      side: "LONG",
      status: "fresh",
      payloadHash: "rich123",
      triggeredReview: false,
      reviewStatus: "not_applicable",
      reason: "rich scanner setup",
      autoExecution: false,
      executionIntent: "none",
      ...latestPatch,
    },
    ...intakePatch,
  });

  const expectRejected = (alertIntake: unknown, expectedIssue: string) => {
    const result = validateAlertIntake(alertIntake);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.join("\n")).toContain(expectedIssue);
    }
  };

  const freshAlertReview = (guardrailPatch: Record<string, unknown> = {}) => ({
    contractVersion: "fresh-alert-3tf-review.v1",
    symbol: "XRPUSDT.P",
    normalizedSymbol: "XRPUSDT.P",
    sourceAlertHash: "rich123",
    alertReceivedAt: "2026-05-03T11:45:00.000Z",
    reviewStartedAt: "2026-05-03T11:45:02.000Z",
    reviewCompletedAt: "2026-05-03T11:45:05.000Z",
    alertAgeSeconds: 5,
    status: "3TF_CONTEXT_READY",
    timeframes: {
      "15m": { status: "fresh", decision: "READY", score: 10, action: "FRESH LONG OK", trigger: "LOCKED LONG", timestamp: "2026-05-03T11:45:00.000Z" },
      "1H": { status: "stale", decision: "LATE", score: 6, action: "WAIT", trigger: "NONE", timestamp: "2026-05-03T10:00:00.000Z" },
      "4H": { status: "missing", decision: null, score: null, action: null, trigger: null, timestamp: null },
    },
    livePrice: { status: "available", price: 1.3885, timestamp: "2026-05-03T11:45:05.000Z" },
    entryTactics: {
      contractVersion: "entry-tactics-brain.v1",
      entryTactic: "WAIT_FOR_RETEST",
      positionSplit: "0/40/60",
      nextActionSentence: "Wait for retest. No fill, no trade.",
      riskReason: "1H is stale and 4H context is missing.",
      autoExecution: false,
      executionIntent: "none",
    },
    setupRankingImpact: {
      rankingRecomputedAfterEntryTactics: true,
      candidateRank: 1,
      candidateFocus: "PRIMARY",
      candidateGrade: "B",
      bestSetupSymbol: "XRPUSDT.P",
    },
    finalRecommendation: "WAIT_FOR_RETEST",
    nextActionSentence: "Wait for retest. No fill, no trade.",
    riskReason: "1H is stale and 4H context is missing.",
    confidence: "medium",
    guardrails: {
      autoExecution: false,
      executionIntent: "none",
      readOnly: true,
      tradingViewRefreshAttempted: false,
      ...guardrailPatch,
    },
  });

  it("accepts and preserves the rich scanner latest-alert contract", () => {
    const result = validateAlertIntake(richAlertIntake());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.alertIntake.latestAlert?.classification).toBe("thorp_score_ready_rich_scanner_alert");
      expect(result.alertIntake.latestAlert?.payloadCompleteness).toBe("rich_scanner");
      expect(result.alertIntake.latestAlert?.scannerRecommendation).toBe("REVIEW_NOW");
      expect(result.alertIntake.latestAlert?.richScannerPayload?.entries.scout).toBe(1.3876);
      expect(result.alertIntake.latestAlert?.richScannerPayload?.risk.invalidation).toBe(1.3403);
      expect(result.alertIntake.latestAlert?.richScannerPayload?.targets.t3).toBe(1.5088);
      expect(result.alertIntake.latestAlert?.richScannerPayload?.range.mid).toBe(1.4286);
      expect(result.alertIntake.latestAlert?.richScannerPayload?.copy).toContain("not an execution command");
      expect(result.alertIntake.latestAlert?.autoExecution).toBe(false);
      expect(result.alertIntake.latestAlert?.executionIntent).toBe("none");
      expect(result.alertIntake.latestAlert?.triggeredReview).toBe(false);
      expect(result.alertIntake.queueDepth).toBe(0);
    }
  });

  it("accepts and preserves optional setup ranking with locked execution intent", () => {
    const result = validateAlertIntake(richAlertIntake({}, {}, {
      setupRanking: {
        contractVersion: "setup-ranking-brain.v1",
        bestSetup: {},
        rankingSummary: "BNB leads; BCH and LINK are watch-only.",
        bestActionSentence: "Wait for BNB A1/A2 retest. Do not chase BCH/LINK.",
        candidates: [
          {
            rank: 1,
            symbol: "BNBUSDT.P",
            direction: "SHORT",
            setupGrade: "B",
            recommendedFocus: "PRIMARY",
            entryTactic: "A1_A2_RETEST_ONLY",
            positionSplit: "0/40/60",
            freshnessStatus: "partial",
            mtfAlignment: "15m+1H aligned, 4H waiting",
            rrQuality: "good on retest",
            chaseRisk: "high at current price",
            riskReason: "15m and 1H align; 4H waits. Retest entries improve RR.",
            nextActionSentence: "Wait for BNB A1/A2 retest. No fill, no trade.",
            autoExecution: false,
            executionIntent: "none",
          },
        ],
        autoExecution: false,
        executionIntent: "none",
      },
    }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.alertIntake.setupRanking?.contractVersion).toBe("setup-ranking-brain.v1");
      expect(result.alertIntake.setupRanking?.candidates[0]?.symbol).toBe("BNBUSDT.P");
      expect(result.alertIntake.setupRanking?.autoExecution).toBe(false);
      expect(result.alertIntake.setupRanking?.executionIntent).toBe("none");
      expect(result.alertIntake.setupRanking?.candidates[0]?.autoExecution).toBe(false);
      expect(result.alertIntake.setupRanking?.candidates[0]?.executionIntent).toBe("none");
    }
  });

  it("accepts and preserves top-level fresh alert review v1 with locked guardrails", () => {
    const result = validateAlertIntake(richAlertIntake({}, {}, { freshAlertReview: freshAlertReview() }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.alertIntake.freshAlertReview?.contractVersion).toBe("fresh-alert-3tf-review.v1");
      expect(result.alertIntake.freshAlertReview?.timeframes["15m"].status).toBe("fresh");
      expect(result.alertIntake.freshAlertReview?.finalRecommendation).toBe("WAIT_FOR_RETEST");
      expect(result.alertIntake.freshAlertReview?.guardrails.autoExecution).toBe(false);
      expect(result.alertIntake.freshAlertReview?.guardrails.executionIntent).toBe("none");
      expect(result.alertIntake.freshAlertReview?.guardrails.readOnly).toBe(true);
      expect(result.alertIntake.freshAlertReview?.guardrails.tradingViewRefreshAttempted).toBe(false);
    }
  });

  it.each([
    ["autoExecution", true, "freshAlertReview.guardrails.autoExecution"],
    ["executionIntent", "market", "freshAlertReview.guardrails.executionIntent"],
    ["readOnly", false, "freshAlertReview.guardrails.readOnly"],
    ["tradingViewRefreshAttempted", true, "freshAlertReview.guardrails.tradingViewRefreshAttempted"],
  ])("rejects fresh alert review unsafe guardrail %s", (field, value, expectedIssue) => {
    expectRejected(richAlertIntake({}, {}, { freshAlertReview: freshAlertReview({ [field]: value }) }), expectedIssue);
  });

  it("rejects setup ranking with executable intent", () => {
    expectRejected(
      richAlertIntake({}, {}, {
        setupRanking: {
          contractVersion: "setup-ranking-brain.v1",
          bestSetup: {},
          rankingSummary: "unsafe",
          bestActionSentence: "unsafe",
          candidates: [],
          autoExecution: true,
          executionIntent: "market",
        },
      }),
      "setupRanking.autoExecution",
    );
  });

  it("rejects setup ranking candidates with executable intent", () => {
    expectRejected(
      richAlertIntake({}, {}, {
        setupRanking: {
          contractVersion: "setup-ranking-brain.v1",
          bestSetup: {},
          rankingSummary: "unsafe",
          bestActionSentence: "unsafe",
          candidates: [
            {
              rank: 1,
              symbol: "BNBUSDT.P",
              direction: "SHORT",
              setupGrade: "B",
              recommendedFocus: "PRIMARY",
              entryTactic: "A1_A2_RETEST_ONLY",
              autoExecution: true,
              executionIntent: "market",
            },
          ],
          autoExecution: false,
          executionIntent: "none",
        },
      }),
      "setupRanking.candidates.0.autoExecution",
    );
  });

  it("keeps legacy static THORP_SCORE_READY wake-up alerts valid without rich fields", () => {
    const result = validateAlertIntake({
      ...validAlertIntake(),
      latestAlert: {
        ...validAlertIntake().latestAlert,
        alertType: "THORP_SCORE_READY",
        classification: "thorp_score_ready_legacy_alert",
        payloadCompleteness: "legacy",
        status: "fresh",
        triggeredReview: false,
        reviewStatus: "not_applicable",
        reason: "legacy wake-up only",
        autoExecution: false,
        executionIntent: "none",
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.alertIntake.latestAlert?.richScannerPayload).toBeUndefined();
      expect(result.alertIntake.latestAlert?.scannerRecommendation).toBeUndefined();
    }
  });

  it("rejects rich scanner latest-alerts with executable intent", () => {
    expectRejected(richAlertIntake({}, { auto_execution: true }), "richScannerPayload.auto_execution");
  });

  it("rejects rich classification without payload", () => {
    expectRejected(richAlertIntake({ richScannerPayload: undefined }), "latestAlert.richScannerPayload");
  });

  it("rejects rich classification without payloadCompleteness rich_scanner", () => {
    expectRejected(richAlertIntake({ payloadCompleteness: "legacy" }), "latestAlert.payloadCompleteness");
  });

  it("rejects rich classification without scannerRecommendation", () => {
    expectRejected(richAlertIntake({ scannerRecommendation: undefined }), "latestAlert.scannerRecommendation");
  });

  it("rejects richScannerPayload under non-THORP_SCORE_READY alert", () => {
    expectRejected(richAlertIntake({ alertType: "THORP_HUD" }), "latestAlert.alertType");
  });

  it("rejects richScannerPayload when classification is not rich scanner", () => {
    expectRejected(richAlertIntake({ classification: "thorp_score_ready_legacy_alert" }), "latestAlert.classification");
  });

  it("rejects richScannerPayload with orderType", () => {
    expectRejected(richAlertIntake({}, { orderType: "market" }), "richScannerPayload");
  });

  it("rejects richScannerPayload with qty", () => {
    expectRejected(richAlertIntake({}, { qty: 100 }), "richScannerPayload");
  });

  it("rejects richScannerPayload with nested exchangeAction", () => {
    expectRejected(richAlertIntake({}, { entries: { ...richPayload.entries, exchangeAction: "buy" } }), "richScannerPayload.entries");
  });

  it("accepts optional broker order truth while preserving old snapshot compatibility", () => {
    const oldSnapshot = validateTradingDeskSnapshot(validSnapshot());
    expect(oldSnapshot.ok).toBe(true);

    const snapshot = validSnapshot();
    snapshot.activePositionFocus = {
      ...snapshot.activePositionFocus!,
      symbol: "ETHUSDT",
      direction: "SHORT",
      entryPrice: 2333.08,
      currentPrice: 2328.25,
      stop: 2352.78,
      stopSource: "hardInvalidation",
      tp1: 2282.83,
      tp2: 2261.63,
      tp3: 2219.24,
      thorpLevels: { a1: 2333.08, a2: 2343.69, hardInvalidation: 2352.78, t1: 2282.83, t2: 2261.63, t3: 2219.24 },
      brokerProtection: { stopLossPresent: false, stopLossPrice: null, takeProfitPrices: [2282.83], openAddPrices: [2343.69], riskProtectionState: "UNPROTECTED" },
      riskVisibility: {
        unprotectedRisk: true,
        stopProtectionStatus: "MISSING",
        tpCoverageStatus: "PARTIAL",
        openAddContradiction: true,
        activePlanLinked: true,
        planBrokerMismatch: true,
        manualAttentionRequired: true,
        reasons: ["BROKER_STOP_MISSING", "TP2_MISSING", "TP3_MISSING", "ADD_PERMISSION_NO_BUT_OPEN_ADD_ORDER_EXISTS"],
      },
    };
    snapshot.openPositions = [snapshot.activePositionFocus];
    snapshot.brokerOrderTruth = {
      contractVersion: "broker-order-truth.v1",
      generatedAt: "2026-05-03T16:51:47.000Z",
      source: "phemex_private_read_only",
      auto_execution: false,
      symbols: [{
        symbol: "ETHUSDT",
        positionStatus: "OPEN",
        positionSide: "SHORT",
        positionSize: 2.7,
        averageEntryPrice: 2333.08,
        currentPrice: 2328.25,
        orders: {
          stopLoss: null,
          takeProfits: [{ symbol: "ETHUSDT", side: "BUY", type: "MarketIfTouched", status: "Untriggered", price: 2282.83, source: "broker" }],
          openAdds: [{ symbol: "ETHUSDT", side: "SELL", type: "Limit", status: "New", price: 2343.69, size: 4, source: "broker" }],
          other: [],
        },
        coverage: {
          brokerStopPresent: false,
          brokerStopPrice: null,
          tpPrices: [2282.83],
          openAddPrices: [2343.69],
          missingExpectedTpPrices: [2261.63, 2219.24],
          unprotectedRisk: true,
          stopProtectionStatus: "MISSING",
          tpCoverageStatus: "PARTIAL",
          openAddContradiction: true,
          activePlanLinked: true,
          planBrokerMismatch: true,
          manualAttentionRequired: true,
          reasons: ["BROKER_STOP_MISSING", "TP2_MISSING", "TP3_MISSING", "ADD_PERMISSION_NO_BUT_OPEN_ADD_ORDER_EXISTS"],
        },
      }],
    };

    const result = validateTradingDeskSnapshot(snapshot);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.activePositionFocus?.stopSource).toBe("hardInvalidation");
      expect(result.snapshot.activePositionFocus?.brokerProtection?.stopLossPresent).toBe(false);
      expect(result.snapshot.brokerOrderTruth?.auto_execution).toBe(false);
      expect(result.snapshot.brokerOrderTruth?.symbols[0].orders.stopLoss).toBeNull();
    }
  });

  it("rejects broker order truth with execution-shaped/sensitive order fields", () => {
    const snapshot = validSnapshot() as Record<string, unknown>;
    snapshot.brokerOrderTruth = {
      contractVersion: "broker-order-truth.v1",
      generatedAt: "2026-05-03T16:51:47.000Z",
      source: "phemex_private_read_only",
      auto_execution: false,
      symbols: [{
        symbol: "ETHUSDT",
        positionStatus: "OPEN",
        orders: { stopLoss: { symbol: "ETHUSDT", side: "SELL", type: "Stop", status: "New", price: 2352.78, orderId: "sensitive" }, takeProfits: [], openAdds: [], other: [] },
        coverage: { brokerStopPresent: true, tpPrices: [], openAddPrices: [], missingExpectedTpPrices: [] },
      }],
    };

    const result = validateTradingDeskSnapshot(snapshot);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.join("\n")).toContain("brokerOrderTruth");
    }
  });

});
