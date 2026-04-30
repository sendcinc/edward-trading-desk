import type { SoftLandingPace, TradingPosition } from "./tradingDesk";

export const SOFT_LANDING_BASELINE_PV = 2373;
export const SOFT_LANDING_BASELINE_DATE = "2026-02-16";
export const MOON_DAILY_RATE = 0.006;
export const SUN_DAILY_RATE = 0.008;

export function daysBetweenUtc(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay));
}

export function calculateSoftLandingPace(currentPV: number, asOfDate = new Date()): SoftLandingPace {
  const today = asOfDate.toISOString().slice(0, 10);
  const daysSinceBaseline = daysBetweenUtc(SOFT_LANDING_BASELINE_DATE, today);
  const moonTargetPVToday = SOFT_LANDING_BASELINE_PV * Math.pow(1 + MOON_DAILY_RATE, daysSinceBaseline);
  const sunTargetPVToday = SOFT_LANDING_BASELINE_PV * Math.pow(1 + SUN_DAILY_RATE, daysSinceBaseline);
  const moonGapDollars = currentPV - moonTargetPVToday;
  const sunGapDollars = currentPV - sunTargetPVToday;
  const currentDailyPVPct = daysSinceBaseline === 0
    ? 0
    : Math.pow(currentPV / SOFT_LANDING_BASELINE_PV, 1 / daysSinceBaseline) - 1;

  return {
    baselinePV: SOFT_LANDING_BASELINE_PV,
    baselineDate: SOFT_LANDING_BASELINE_DATE,
    daysSinceBaseline,
    currentPV,
    currentDailyPVPct,
    moonDailyRate: MOON_DAILY_RATE,
    sunDailyRate: SUN_DAILY_RATE,
    moonTargetPVToday,
    sunTargetPVToday,
    moonGapDollars,
    sunGapDollars,
    moonGapPct: moonTargetPVToday === 0 ? 0 : moonGapDollars / moonTargetPVToday,
    sunGapPct: sunTargetPVToday === 0 ? 0 : sunGapDollars / sunTargetPVToday,
    moonDailyTargetDollars: currentPV * MOON_DAILY_RATE,
    sunDailyTargetDollars: currentPV * SUN_DAILY_RATE,
    moonStatus: moonGapDollars >= 0 ? "AHEAD" : "BEHIND",
    sunStatus: sunGapDollars >= 0 ? "AHEAD" : "BEHIND",
  };
}

export function enrichPositionWithPaceMath(
  position: TradingPosition,
  currentPV: number,
  pace: SoftLandingPace,
): TradingPosition {
  const estimatedProfitAtTP1 = position.estimatedProfitAtTP1 ?? estimateProfitAtTarget(position, position.tp1);
  const estimatedLossAtStop = position.estimatedLossAtStop ?? estimateLossAtStop(position);

  return {
    ...position,
    estimatedProfitAtTP1,
    estimatedLossAtStop,
    distanceToTP1Pct: position.distanceToTP1Pct ?? distanceToPricePct(position.currentPrice, position.tp1, position.direction),
    distanceToStopPct: position.distanceToStopPct ?? distanceToPricePct(position.currentPrice, position.stop, opposite(position.direction)),
    portfolioGainAtTP1Pct: estimatedProfitAtTP1 === undefined ? undefined : estimatedProfitAtTP1 / currentPV,
    portfolioLossAtStopPct: estimatedLossAtStop === undefined ? undefined : estimatedLossAtStop / currentPV,
    tp1ContributionToMoonDailyTargetPct:
      estimatedProfitAtTP1 === undefined ? undefined : estimatedProfitAtTP1 / pace.moonDailyTargetDollars,
    tp1ContributionToSunDailyTargetPct:
      estimatedProfitAtTP1 === undefined ? undefined : estimatedProfitAtTP1 / pace.sunDailyTargetDollars,
    tp1ContributionToMoonGapPct:
      estimatedProfitAtTP1 === undefined || pace.moonGapDollars >= 0
        ? undefined
        : estimatedProfitAtTP1 / Math.abs(pace.moonGapDollars),
    tp1ContributionToSunGapPct:
      estimatedProfitAtTP1 === undefined || pace.sunGapDollars >= 0
        ? undefined
        : estimatedProfitAtTP1 / Math.abs(pace.sunGapDollars),
  };
}

function estimateProfitAtTarget(position: TradingPosition, target?: number): number | undefined {
  if (!position.size || target === undefined) return undefined;
  const priceMove = position.direction === "LONG" ? target - position.entryPrice : position.entryPrice - target;
  return priceMove * position.size;
}

function estimateLossAtStop(position: TradingPosition): number | undefined {
  if (!position.size || position.stop === undefined) return undefined;
  const priceMove = position.direction === "LONG" ? position.stop - position.entryPrice : position.entryPrice - position.stop;
  return priceMove * position.size;
}

function distanceToPricePct(currentPrice: number, target: number | undefined, favorableDirection: "LONG" | "SHORT") {
  if (target === undefined) return undefined;
  const distance = favorableDirection === "LONG" ? target - currentPrice : currentPrice - target;
  return distance / currentPrice;
}

function opposite(direction: "LONG" | "SHORT") {
  return direction === "LONG" ? "SHORT" : "LONG";
}
