import type { TradingDeskSnapshot, TradeJournalEntry as SnapshotTradeJournalEntry } from "../domain/tradingDesk";

export type TradeJournalRow = {
  tradeId: string;
  date: string;
  symbol: string;
  side: string;
  status: string;
  opened: string;
  closed: string;
  entry: string;
  exit: string;
  size: string;
  pnl: string;
  fees: string;
  funding: string;
  framework: string;
  reason: string;
  tone: "neutral" | "warning" | "danger" | "success";
};

export type TradeJournalSummary = {
  badge: string;
  stats: {
    trades: string;
    wins: string;
    losses: string;
    winRate: string;
  };
  rows: TradeJournalRow[];
  tableRows: TradeJournalRow[];
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export function buildTradeJournalSummary(snapshot: TradingDeskSnapshot, latestLimit = 5): TradeJournalSummary {
  const trades = getSortedClosedTrades(snapshot);
  const wins = trades.filter((trade) => (trade.realizedPnl ?? 0) > 0).length;
  const losses = trades.filter((trade) => (trade.realizedPnl ?? 0) < 0).length;
  const decisiveTrades = wins + losses;

  return {
    badge: trades.length ? `${trades.length} closed trades` : "0 closed trades",
    stats: {
      trades: String(trades.length),
      wins: String(wins),
      losses: String(losses),
      winRate: decisiveTrades ? `${((wins / decisiveTrades) * 100).toFixed(1)}%` : "0.0%",
    },
    rows: trades.length ? trades.slice(0, latestLimit).map(formatClosedTradeRow) : buildEmptyRows(),
    tableRows: trades.length ? trades.map(formatClosedTradeRow) : buildEmptyRows(),
  };
}

export function buildTradeJournalRows(snapshot: TradingDeskSnapshot): TradeJournalRow[] {
  const trades = getSortedClosedTrades(snapshot);
  if (!trades.length) {
    return buildEmptyRows();
  }

  return trades.map(formatClosedTradeRow);
}

function buildEmptyRows(): TradeJournalRow[] {
  return [{
    tradeId: "no-closed-trades",
    date: "—",
    symbol: "No closed trades loaded",
    side: "—",
    status: "—",
    opened: "—",
    closed: "—",
    entry: "—",
    exit: "—",
    size: "—",
    pnl: "—",
    fees: "—",
    funding: "—",
    framework: "—",
    reason: "The trade journal ledger is not present in this snapshot yet.",
    tone: "warning",
  }];
}

function getSortedClosedTrades(snapshot: TradingDeskSnapshot) {
  return [...(snapshot.tradeJournal ?? [])]
    .filter((trade) => trade.status.toLowerCase() === "closed")
    .sort((left, right) => getTradeTime(right) - getTradeTime(left));
}

function formatClosedTradeRow(trade: SnapshotTradeJournalEntry): TradeJournalRow {
  const pnl = trade.realizedPnl;

  return {
    tradeId: trade.tradeId || `${trade.symbol}-${trade.side}-${trade.exitTime ?? "open"}-${trade.entryTime ?? "entry"}`,
    date: formatISODate(trade.exitTime),
    symbol: trade.symbol,
    side: trade.side.toUpperCase(),
    status: trade.status || "—",
    opened: formatDate(trade.entryTime),
    closed: formatDate(trade.exitTime),
    entry: formatNumber(trade.entryPrice),
    exit: formatNumber(trade.exitPrice),
    size: formatNumber(trade.size ?? undefined),
    pnl: formatJournalMoney(pnl),
    fees: trade.fees == null ? "—" : money.format(trade.fees),
    funding: trade.funding == null ? "—" : money.format(trade.funding),
    framework: trade.framework || "—",
    reason: cleanCloseReason(trade.closeReason),
    tone: pnl === undefined ? "neutral" : pnl < 0 ? "danger" : pnl > 0 ? "success" : "warning",
  };
}

function getTradeTime(trade: SnapshotTradeJournalEntry) {
  const timestamp = new Date(trade.exitTime ?? trade.entryTime ?? "").getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function formatJournalMoney(value?: number) {
  if (value === undefined) return "—";
  const sign = value < 0 ? "-" : "";
  return `$${sign}${Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(value?: number) {
  return value === undefined ? "—" : value.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function formatISODate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function cleanCloseReason(value?: string) {
  if (!value) return "No close reason recorded.";
  return value.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}
