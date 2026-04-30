import { describe, expect, it } from "vitest";
import { calculateSoftLandingPace, MOON_DAILY_RATE, SOFT_LANDING_BASELINE_PV } from "./softLanding";

describe("calculateSoftLandingPace", () => {
  it("publishes the current compounded daily PV percent for Moon/Sun comparison", () => {
    const tenMoonDaysPV = SOFT_LANDING_BASELINE_PV * Math.pow(1 + MOON_DAILY_RATE, 10);

    const pace = calculateSoftLandingPace(tenMoonDaysPV, new Date("2026-02-26T12:00:00Z"));

    expect(pace.currentDailyPVPct).toBeCloseTo(0.006, 6);
  });
});
