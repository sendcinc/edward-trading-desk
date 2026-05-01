import { describe, expect, it, vi } from "vitest";
import { demoTradingDeskSnapshot } from "./demoSnapshot";
import {
  buildDemoSnapshot,
  loadTradingDeskSnapshot,
  resolveDataMode,
  validateTradingDeskSnapshot,
  type DemoScenario,
} from "./tradingDeskAdapter";

import { TRADING_DESK_SNAPSHOT_CONTRACT_VERSION } from "../domain/tradingDesk";

const validSnapshot = () => structuredClone(demoTradingDeskSnapshot);

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
  it("fetches the static public Edward snapshot first", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(validSnapshot()), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadTradingDeskSnapshot({ source: "edward-api" });

    expect(fetchMock).toHaveBeenCalledWith("/trading-desk/data/latest.json", {
      headers: { Accept: "application/json" },
    });
    expect(result.dataMode).toBe("live_available");
    expect(result.source).toBe("edward-api");
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
});
