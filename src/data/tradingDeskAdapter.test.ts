import { describe, expect, it, vi } from "vitest";
import { demoTradingDeskSnapshot } from "./demoSnapshot";
import {
  buildDemoSnapshot,
  loadTradingDeskSnapshot,
  resolveDataMode,
  safeDegradedHealth,
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

  it("accepts older snapshots without a trade management plan", () => {
    const snapshot = validSnapshot();
    delete snapshot.tradeManagementPlan;

    const oldSnapshot = validateTradingDeskSnapshot(snapshot);

    expect(oldSnapshot.ok).toBe(true);
    if (oldSnapshot.ok) {
      expect(oldSnapshot.snapshot.tradeManagementPlan).toBeUndefined();
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
  it("fetches the static public Edward snapshot first and optional health second", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(validSnapshot()), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(validHealth()), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadTradingDeskSnapshot({ source: "edward-api" });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/trading-desk/data/latest.json", {
      headers: { Accept: "application/json" },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/trading-desk/data/health.json", {
      headers: { Accept: "application/json" },
    });
    expect(result.dataMode).toBe("live_available");
    expect(result.health?.producerStatus).toBe("healthy");
    expect(result.source).toBe("edward-api");
    vi.unstubAllGlobals();
  });

  it("keeps old latest.json usable when health is unavailable", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(validSnapshot()), { status: 200 }))
      .mockResolvedValueOnce(new Response("missing", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadTradingDeskSnapshot({ source: "edward-api" });

    expect(result.dataMode).toBe("live_available");
    expect(result.health?.producerStatus).toBe("degraded");
    expect(result.health?.lastError).toContain("HTTP 404");
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
