import { describe, expect, it } from "vitest";
import { demoTradingDeskSnapshot } from "./demoSnapshot";
import { buildTradeJournalRows, buildTradeJournalSummary } from "./tradeJournal";

describe("trade journal table rows", () => {
  it("builds the compact latest-five journal summary from actual closed trades", () => {
    const snapshot = structuredClone(demoTradingDeskSnapshot);
    snapshot.tradeJournal = [
      makeTrade("xrp-close", "XRPUSDT", "long", "2026-04-29T08:20:41-04:00", -0.8752),
      makeTrade("link-close", "LINKUSDT", "long", "2026-04-28T08:20:41-04:00", 17.62),
      makeTrade("btc-close", "BTCUSDT", "short", "2026-04-27T08:20:41-04:00", 26.53),
      makeTrade("avax-close", "AVAXUSDT", "long", "2026-04-26T08:20:41-04:00", -5.01),
      makeTrade("fet-close", "FETUSDT", "short", "2026-04-23T08:20:41-04:00", 19.6),
      makeTrade("old-close", "SUIUSDT", "short", "2026-02-16T08:20:41-04:00", 94.63),
    ];

    const summary = buildTradeJournalSummary(snapshot);

    expect(summary.stats).toEqual({ trades: "6", wins: "4", losses: "2", winRate: "66.7%" });
    expect(summary.badge).toBe("6 closed trades");
    expect(summary.rows).toHaveLength(5);
    expect(summary.rows.map((row) => row.symbol)).toEqual(["XRPUSDT", "LINKUSDT", "BTCUSDT", "AVAXUSDT", "FETUSDT"]);
    expect(summary.tableRows).toHaveLength(6);
    expect(summary.tableRows.map((row) => row.symbol)).toEqual(["XRPUSDT", "LINKUSDT", "BTCUSDT", "AVAXUSDT", "FETUSDT", "SUIUSDT"]);
    expect(summary.tableRows[0]).toMatchObject({
      tradeId: "xrp-close",
      date: "2026-04-29",
      symbol: "XRPUSDT",
      side: "LONG",
      status: "closed",
      opened: "Apr 1, 8:20 AM",
      closed: "Apr 29, 8:20 AM",
      entry: "1",
      exit: "1.1",
      size: "10",
      pnl: "$-0.88",
      fees: "$0.00",
      funding: "$0.00",
      framework: "THORP",
      reason: "historical backfill",
      tone: "danger",
    });
  });

  it("keeps summary stats and full table scoped to closed trades only", () => {
    const snapshot = structuredClone(demoTradingDeskSnapshot);
    snapshot.tradeJournal = [
      { ...makeTrade("open-xrp", "XRPUSDT", "long", "2026-04-30T08:20:41-04:00", 0), status: "open" },
      makeTrade("xrp-close", "XRPUSDT", "long", "2026-04-29T08:20:41-04:00", -0.8752),
      makeTrade("link-close", "LINKUSDT", "long", "2026-04-28T08:20:41-04:00", 17.62),
    ];

    const summary = buildTradeJournalSummary(snapshot);

    expect(summary.stats.trades).toBe("2");
    expect(summary.tableRows).toHaveLength(2);
    expect(summary.tableRows.map((row) => row.tradeId)).not.toContain("open-xrp");
  });

  it("returns one warning row instead of faking a current-position journal", () => {
    const snapshot = structuredClone(demoTradingDeskSnapshot);
    delete snapshot.tradeJournal;

    const rows = buildTradeJournalRows(snapshot);

    expect(rows).toHaveLength(1);
    expect(rows[0].symbol).toBe("No closed trades loaded");
    expect(rows[0].reason).toContain("ledger is not present");
    expect(rows[0].tone).toBe("warning");
  });
});

function makeTrade(tradeId: string, symbol: string, side: "long" | "short", exitTime: string, realizedPnl: number) {
  return {
    tradeId,
    symbol,
    side,
    status: "closed" as const,
    entryTime: "2026-04-01T08:20:41-04:00",
    exitTime,
    entryPrice: 1,
    exitPrice: 1.1,
    realizedPnl,
    fees: 0,
    funding: 0,
    closeReason: "historical backfill",
    confidence: "HIGH",
    size: 10,
    framework: "THORP",
  };
}
