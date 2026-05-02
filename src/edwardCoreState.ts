import type { LiveTradeStateItem, TradingDeskHealth, TradingDeskSnapshot } from "./domain/tradingDesk";

export type EdwardCoreAvatarState =
  | "MONITORING"
  | "ANALYZING"
  | "WARNING"
  | "CRITICAL"
  | "STALE"
  | "OFFLINE"
  | "DEGRADED_VISIBILITY";

export type EdwardCoreState = {
  avatarState: EdwardCoreAvatarState;
  title: string;
  subtitle: string;
  guardrail: "Manual / Read-only";
  allAutoExecutionFalse: boolean;
};

export function deriveEdwardCoreState({
  snapshot,
  health,
}: {
  snapshot: TradingDeskSnapshot;
  health?: TradingDeskHealth;
}): EdwardCoreState {
  const liveTradeState = snapshot.liveTradeState;
  const trades = liveTradeState?.trades ?? [];
  const openTrades = trades.filter((trade) => trade.position_status === "OPEN");
  const hasActiveTrade = openTrades.length > 0;
  const allAutoExecutionFalse = trades.every((trade) => trade.auto_execution === false);

  let avatarState: EdwardCoreAvatarState = "MONITORING";

  if (!health || health.producerStatus === "offline") {
    avatarState = "OFFLINE";
  } else if (!liveTradeState) {
    avatarState = health.producerStatus === "degraded" ? "DEGRADED_VISIBILITY" : "STALE";
  } else if (health.producerStatus === "degraded" && !hasActiveTrade) {
    avatarState = "DEGRADED_VISIBILITY";
  } else if (trades.some((trade) => trade.data_confidence === "LOW")) {
    avatarState = "STALE";
  } else if (trades.some((trade) => trade.management_bias === "EXIT_OR_REDUCE")) {
    avatarState = "CRITICAL";
  } else if (trades.some((trade) => trade.risk_state === "ELEVATED" || trade.risk_state === "OVEREXPOSED")) {
    avatarState = "WARNING";
  } else if (openTrades.some((trade) => trade.data_confidence === "HIGH" || trade.data_confidence === "MEDIUM")) {
    avatarState = "ANALYZING";
  }

  const focusTrade = openTrades[0] ?? trades[0];

  return {
    avatarState,
    title: avatarState === "OFFLINE" ? "Edward Offline" : "Edward Active",
    subtitle: coreSubtitle(avatarState, focusTrade),
    guardrail: "Manual / Read-only",
    allAutoExecutionFalse,
  };
}

function coreSubtitle(avatarState: EdwardCoreAvatarState, trade: LiveTradeStateItem | undefined) {
  if (avatarState === "OFFLINE") return "Offline · no trusted live context";
  if (avatarState === "DEGRADED_VISIBILITY") return "Limited visibility";
  if (avatarState === "STALE") return "Stale data · No action";
  if (avatarState === "CRITICAL") return trade ? `Exit pressure · ${trade.symbol}` : "Exit pressure detected";
  if (avatarState === "WARNING") return trade ? `Risk elevated · Do not add · ${trade.symbol}` : "Risk elevated · Do not add";
  if (avatarState === "ANALYZING") return trade ? `Managing ${trade.symbol}` : "Analyzing live context";
  return "Monitoring live context";
}
