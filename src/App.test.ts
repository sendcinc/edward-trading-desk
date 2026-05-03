import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LatestAlertPanel } from "./App";
import type { AlertIntakeResult, LatestAlert, ThorpRichScannerPayload, ThorpScannerRecommendation } from "./domain/tradingDesk";

const currentDir = dirname(fileURLToPath(import.meta.url));
const appSource = readFileSync(join(currentDir, "App.tsx"), "utf8");

describe("Trading Desk shell", () => {
  it("does not render the visible data source/demo control panel", () => {
    expect(appSource).not.toContain("<DemoControls");
    expect(appSource).not.toContain("Data source and demo scenario controls");
    expect(appSource).not.toContain("Live Edward snapshot first");
    expect(appSource).not.toContain("Demo remains available as an explicit fallback");
  });

  it("keeps journal cards above a full-field all-trades table", () => {
    expect(appSource.indexOf('className="trade-journal-stats"')).toBeGreaterThan(-1);
    expect(appSource.indexOf('className="trade-journal-table-wrap"')).toBeGreaterThan(
      appSource.indexOf('className="trade-journal-stats"'),
    );
    expect(appSource).toContain("trade-journal-mobile-cards");
    expect(appSource).toContain("journal.tableRows.map");
    for (const header of [
      "Trade ID",
      "Date",
      "Symbol",
      "Side",
      "Status",
      "Opened",
      "Closed",
      "Entry",
      "Exit",
      "Size",
      "P&amp;L",
      "Fees",
      "Funding",
      "Framework",
      "Reason",
    ]) {
      expect(appSource).toContain(`<th>${header}</th>`);
    }
    expect(appSource).not.toContain("<th>Confidence</th>");
    expect(appSource).not.toContain("row.confidence");
  });

  it("integrates the compact Edward Core status into the title metadata row", () => {
    const titleMetaIndex = appSource.indexOf('className="title-meta-row"');
    const systemLabelIndex = appSource.indexOf('className="system-label"');
    const avatarIndex = appSource.indexOf("<EdwardCoreAvatar core={coreState} />");
    const titleIndex = appSource.indexOf("<h1>Trading Cockpit</h1>");

    expect(titleMetaIndex).toBeGreaterThan(-1);
    expect(systemLabelIndex).toBeGreaterThan(titleMetaIndex);
    expect(avatarIndex).toBeGreaterThan(systemLabelIndex);
    expect(avatarIndex).toBeLessThan(titleIndex);
    expect(appSource).toContain("deriveEdwardCoreState");
    expect(appSource).toContain("Manual / Read-only");
    expect(appSource).toContain("edward-core-orb");
    expect(appSource).toContain("prefers-reduced-motion: reduce");
    expect(appSource.indexOf("<TopCommandHeader")).toBeLessThan(appSource.indexOf("<TradeDecisionCard snapshot={snapshot} />"));
  });

  it("renders a decision-first cockpit with refresh, risk ladder, and watchlist surfaces", () => {
    expect(appSource.indexOf("<TradeDecisionCard snapshot={snapshot} />")).toBeLessThan(
      appSource.indexOf("<EdwardVerdictPanel snapshot={snapshot} />"),
    );
    expect(appSource.indexOf("<RiskLadderPanel snapshot={snapshot} />")).toBeLessThan(
      appSource.indexOf("<MarketMovementPanel snapshot={snapshot} />"),
    );
    expect(appSource).toContain("REFRESH_INTERVAL_SECONDS = 30");
    expect(appSource).toContain("Next refresh");
    expect(appSource).toContain("Watchlist / Opportunity Scan");
    expect(appSource).toContain("Risk & Ladder Management");
    const tradeDecisionIndex = appSource.indexOf("<TradeDecisionCard snapshot={snapshot} />");
    const tradeManagementIndex = appSource.indexOf("<TradeManagementPlanPanel snapshot={snapshot} />");
    const healthIndex = appSource.indexOf("<EdwardHealthPanel health={loadResult.health} />");
    const bodyProgressIndex = appSource.indexOf("<EdwardBodyProgressPanel />");
    const journalIndex = appSource.indexOf("<TradeJournalPanel snapshot={snapshot} />");

    expect(tradeDecisionIndex).toBeLessThan(tradeManagementIndex);
    expect(tradeManagementIndex).toBeLessThan(healthIndex);
    const alertIndex = appSource.indexOf("<LatestAlertPanel alertIntake={loadResult.alertIntake} />");
    const watchlistIndex = appSource.indexOf("<WatchlistPanel snapshot={snapshot} />");
    const verdictIndex = appSource.indexOf("<EdwardVerdictPanel snapshot={snapshot} />");
    const riskIndex = appSource.indexOf("<RiskLadderPanel snapshot={snapshot} />");
    expect(tradeDecisionIndex).toBeLessThan(alertIndex);
    expect(tradeManagementIndex).toBeLessThan(alertIndex);
    expect(healthIndex).toBeLessThan(alertIndex);
    expect(alertIndex).toBeLessThan(watchlistIndex);
    expect(watchlistIndex).toBeLessThan(verdictIndex);
    expect(verdictIndex).toBeLessThan(riskIndex);
    expect(healthIndex).toBeLessThan(bodyProgressIndex);
    expect(healthIndex).toBeLessThan(journalIndex);
    expect(appSource).toContain("Edward Health");
    expect(appSource).toContain("Producer Status");
    expect(appSource).toContain("Source Freshness");
  });

  it("keeps Edward Body Progress after cockpit/watchlist flow and before the journal", () => {
    const tradeDecisionIndex = appSource.indexOf("<TradeDecisionCard snapshot={snapshot} />");
    const portfolioIndex = appSource.indexOf("<PortfolioCommandBar snapshot={snapshot} />");
    const bodyProgressIndex = appSource.indexOf("<EdwardBodyProgressPanel />");
    const journalIndex = appSource.indexOf("<TradeJournalPanel snapshot={snapshot} />");

    expect(bodyProgressIndex).toBeGreaterThan(tradeDecisionIndex);
    expect(bodyProgressIndex).toBeGreaterThan(portfolioIndex);
    expect(bodyProgressIndex).toBeLessThan(journalIndex);
  });

  it("renders body-progress copy and locked execution state from static progress data", () => {
    expect(appSource).toContain("edwardBodyProgress");
    expect(appSource).toContain("Edward Gets a Body completion");
    expect(appSource).toContain("progress.projectName");
    expect(appSource).toContain("Edward Gets a Body");
    expect(appSource).toContain("% Complete");
    expect(appSource).toContain("Current Reflex Status");
    expect(appSource).toContain("Monitor active");
    expect(appSource).toContain("reflex.guardrailBadge");
    expect(appSource).toContain("progress.reasonExecutionLocked");
    expect(appSource).toContain("Object.entries(progress.bodyParts)");
  });

  it("renders separated thesis, risk, data confidence, add permission, and reasons when present", () => {
    expect(appSource).toContain("Technical Thesis");
    expect(appSource).toContain("Risk State");
    expect(appSource).toContain("Data Confidence");
    expect(appSource).toContain("Add Permission");
    expect(appSource).toContain("State Reasons");
    expect(appSource).toContain("technicalThesis");
    expect(appSource).toContain("managementState");
  });

  it("renders trade management plan below the trade decision with protection and soft landing math", () => {
    expect(appSource.indexOf("<TradeDecisionCard snapshot={snapshot} />")).toBeLessThan(
      appSource.indexOf("<TradeManagementPlanPanel snapshot={snapshot} />"),
    );
    expect(appSource.indexOf("<TradeManagementPlanPanel snapshot={snapshot} />")).toBeLessThan(
      appSource.indexOf("<EdwardVerdictPanel snapshot={snapshot} />"),
    );
    expect(appSource).toContain("Trade Management Plan");
    expect(appSource).toContain("Protection Plan");
    expect(appSource).toContain("Profit / Giveback Math");
    expect(appSource).toContain("Soft Landing Impact");
    expect(appSource).toContain("Do Not Do");
    expect(appSource).toContain("tradeManagementPlan");
  });

  it("only renders trade management plan content when the optional plan exists", () => {
    expect(appSource).toContain("const plan = snapshot.tradeManagementPlan;");
    expect(appSource).toContain("if (!plan) return null;");
    expect(appSource.indexOf("if (!plan) return null;")).toBeLessThan(
      appSource.indexOf('eyebrow="Trade Management Plan"'),
    );
  });

  it("renders latest alert intake below Edward Health without outranking decision or management", () => {
    const tradeDecisionIndex = appSource.indexOf("<TradeDecisionCard snapshot={snapshot} />");
    const tradeManagementIndex = appSource.indexOf("<TradeManagementPlanPanel snapshot={snapshot} />");
    const healthIndex = appSource.indexOf("<EdwardHealthPanel health={loadResult.health} />");
    const alertIndex = appSource.indexOf("<LatestAlertPanel alertIntake={loadResult.alertIntake} />");
    const watchlistIndex = appSource.indexOf("<WatchlistPanel snapshot={snapshot} />");

    expect(alertIndex).toBeGreaterThan(-1);
    expect(tradeDecisionIndex).toBeLessThan(tradeManagementIndex);
    expect(tradeManagementIndex).toBeLessThan(healthIndex);
    expect(healthIndex).toBeLessThan(alertIndex);
    expect(alertIndex).toBeLessThan(watchlistIndex);
    expect(appSource).toContain("Latest Alert / Alert Intake");
    expect(appSource).toContain("Alerts do not execute trades.");
    expect(appSource).toContain("Alert intake unavailable / no recent alerts");
    expect(appSource).toContain("context_only");
    expect(appSource).toContain("duplicate");
  });
});


const richScannerPayload: ThorpRichScannerPayload = {
  type: "THORP_SCORE_READY",
  schemaVersion: "thorp-rich-scanner.v1" as const,
  lane: "scanner" as const,
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
  auto_execution: false as const,
  executionIntent: "none" as const,
  copy: "THORP detected a potential setup. This is not an execution command.",
};

function richAlert(recommendation: ThorpScannerRecommendation, overrides: Partial<LatestAlert> = {}): LatestAlert {
  return {
    receivedAt: "2026-05-03T11:45:00.000Z",
    alertType: "THORP_SCORE_READY",
    classification: "thorp_score_ready_rich_scanner_alert",
    payloadCompleteness: "rich_scanner",
    scannerRecommendation: recommendation,
    richScannerPayload,
    symbol: "XRPUSDT.P",
    normalizedSymbol: "XRPUSDT.P",
    timeframe: "15",
    side: "LONG",
    status: recommendation === "DUPLICATE_NO_ACTION" ? "duplicate" : recommendation === "SKIP_STALE" ? "stale" : "fresh",
    payloadHash: `rich-${recommendation}`,
    triggeredReview: false,
    reviewStatus: recommendation === "DUPLICATE_NO_ACTION" ? "duplicate" : "not_applicable",
    reason: "rich scanner setup",
    autoExecution: false,
    executionIntent: "none",
    ...overrides,
  };
}

function alertIntakeFor(latestAlert: LatestAlert): AlertIntakeResult {
  return {
    contractVersion: "edward-alert-intake.v1",
    generatedAt: "2026-05-03T11:45:03.000Z",
    webhookStatus: "live",
    latestAlert,
    latestBySymbol: {},
    latestBySymbolTimeframe: {},
    recentAlerts: [latestAlert],
    lastAlertAt: latestAlert.receivedAt,
    lastValidAlertAt: latestAlert.receivedAt,
    lastInvalidAlertAt: null,
    queueDepth: 0,
    lastReviewTriggeredAt: null,
  };
}

describe("THORP rich setup latest-alert card", () => {
  const renderRich = (recommendation: ThorpScannerRecommendation, overrides: Partial<LatestAlert> = {}) =>
    renderToStaticMarkup(React.createElement(LatestAlertPanel, { alertIntake: alertIntakeFor(richAlert(recommendation, overrides)) }));

  it("renders THORP SETUP READY with REVIEW NOW copy and fields", () => {
    const html = renderRich("REVIEW_NOW");

    expect(html).toContain("THORP SETUP READY");
    expect(html).toContain("REVIEW NOW");
    expect(html).toContain("Review now. Confirm current price has not moved away from Scout.");
    expect(html).toContain("XRPUSDT.P");
    expect(html).toContain("15");
    expect(html).toContain("LONG");
    expect(html).toContain("10");
    expect(html).toContain("LONG LOWER");
    expect(html).toContain("GREEN | 11.24%");
    expect(html).toContain("LOCKED LONG");
    expect(html).toContain("FRESH LONG OK");
    expect(html).toContain("1.3885");
    expect(html).toContain("1.3876");
    expect(html).toContain("1.371");
    expect(html).toContain("1.3545");
    expect(html).toContain("1.3483");
    expect(html).toContain("1.3403");
    expect(html).toContain("1.4286");
    expect(html).toContain("1.4553");
    expect(html).toContain("1.5088");
    expect(html).toContain("Rot OK");
    expect(html).toContain("1.74%");
    expect(html).toContain("THORP detected a potential setup. This is not an execution command.");
    expect(html).toContain("Alerts do not execute trades.");
    expect(html).toContain("autoExecution false / executionIntent none");
  });

  it.each([
    ["WAIT_FOR_RETEST", "WAIT FOR RETEST", "Wait for retest. Do not chase."],
    ["SKIP_STALE", "SKIP — STALE", "Skip. Alert is stale."],
    ["SKIP_STRETCHED", "SKIP — STRETCHED", "Skip or wait. Move is already extended."],
    ["DUPLICATE_NO_ACTION", "DUPLICATE — NO NEW ACTION", "Duplicate scanner alert. No new action."],
    ["CONTEXT_INCOMPLETE", "REVIEW CHART — CONTEXT INCOMPLETE", "Setup alert received, but required context is incomplete. Review chart manually."],
  ] as const)("renders %s recommendation copy", (recommendation, label, copy) => {
    const html = renderRich(recommendation);

    expect(html).toContain(label);
    expect(html).toContain(copy);
  });

  it("shows Unavailable for missing nullable fields without crashing", () => {
    const html = renderRich("CONTEXT_INCOMPLETE", {
      richScannerPayload: {
        ...richScannerPayload,
        price_at_alert: null,
        entries: { scout: null, a1: null, a2: null },
        targets: { t1: null, t2: null, t3: null },
      },
    });

    expect(html).toContain("Unavailable");
    expect(html).toContain("REVIEW CHART — CONTEXT INCOMPLETE");
  });

  it("keeps legacy static THORP_SCORE_READY as wake-up only", () => {
    const legacy = richAlert("REVIEW_NOW", {
      classification: "thorp_score_ready_legacy_alert",
      payloadCompleteness: undefined,
      scannerRecommendation: undefined,
      richScannerPayload: undefined,
      timeframe: undefined,
      side: undefined,
      reason: "legacy wake-up only",
    });
    const html = renderToStaticMarkup(React.createElement(LatestAlertPanel, { alertIntake: alertIntakeFor(legacy) }));

    expect(html).not.toContain("THORP SETUP READY");
    expect(html).toContain("Fresh context/setup review required before any action.");
    expect(html).toContain("Alerts do not execute trades.");
  });

  it("does not render execution buttons or order affordances", () => {
    const html = renderRich("REVIEW_NOW").toLowerCase();

    expect(html).not.toContain("<button");
    expect(html).not.toContain("buy");
    expect(html).not.toContain("sell");
    expect(html).not.toContain("enter ");
    expect(html).not.toContain("exit ");
    expect(html).not.toContain("order");
  });
});
