import { describe, expect, it } from "vitest";
import {
  activeTradeUnderPressureExample,
  liveAvailableExample,
  liveStaleExample,
  liveUnavailableExample,
  noActiveTradeExample,
  validationErrorExampleInput,
} from "./exampleSnapshots";
import { resolveDataMode, validateTradingDeskSnapshot } from "./tradingDeskAdapter";
import { TRADING_DESK_SNAPSHOT_CONTRACT_VERSION } from "../domain/tradingDesk";

describe("Edward snapshot contract examples", () => {
  it.each([
    ["live available", liveAvailableExample],
    ["live stale", liveStaleExample],
    ["live unavailable", liveUnavailableExample],
    ["no active trade", noActiveTradeExample],
    ["active trade under pressure", activeTradeUnderPressureExample],
  ])("validates the %s example", (_name, snapshot) => {
    const result = validateTradingDeskSnapshot(snapshot);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.contractVersion).toBe(TRADING_DESK_SNAPSHOT_CONTRACT_VERSION);
    }
  });

  it("rejects the invalid example input", () => {
    const result = validateTradingDeskSnapshot(validationErrorExampleInput);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.join("\n")).toContain("contractVersion");
      expect(result.issues.join("\n")).toContain("portfolio.currentPV");
    }
  });

  it("treats no-active-trade as a valid nullable active position state", () => {
    const result = validateTradingDeskSnapshot(noActiveTradeExample);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.systemStatus).toBe("NO_OPEN_POSITION");
      expect(result.snapshot.openPositions).toEqual([]);
      expect(result.snapshot.activePositionFocus).toBeNull();
    }
  });

  it("resolves stale example to live_stale", () => {
    const result = validateTradingDeskSnapshot(liveStaleExample);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(resolveDataMode({ source: "edward-api", snapshot: result.snapshot, now: new Date("2026-04-30T15:00:00.000Z") })).toBe("live_stale");
    }
  });

  it("resolves unavailable example to live_unavailable", () => {
    const result = validateTradingDeskSnapshot(liveUnavailableExample);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(resolveDataMode({ source: "edward-api", snapshot: result.snapshot, now: new Date("2026-04-30T15:00:00.000Z") })).toBe("live_unavailable");
    }
  });
});
