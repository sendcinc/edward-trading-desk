import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { derivePrimaryScanDisplay, ActiveTradeManagementPanel, EdwardHawkPage, FreshAlertReviewPanel, LatestAlertPanel, buildAlertInboxRows } from "./App";
import { safeUnavailableHawkSession, validateHawkSession, type HawkLoadResult, type HawkWatchSession } from "./data/hawkSession";
import type { AlertIntakeResult, FreshAlertReview, LatestAlert, ManagementBinding, ThorpRichScannerPayload, ThorpScannerRecommendation, TradingDeskSnapshot, WatchlistItem } from "./domain/tradingDesk";

const currentDir = dirname(fileURLToPath(import.meta.url));
const appSource = readFileSync(join(currentDir, "App.tsx"), "utf8");
const latestAlertFreshReviewBlockedFixture = JSON.parse(
  readFileSync(join(currentDir, "data", "__fixtures__", "latest-alert-fresh-review-blocked.json"), "utf8"),
) as AlertIntakeResult;
const latestAlertFreshReviewHistoryTimeframesFixture = JSON.parse(
  readFileSync(join(currentDir, "data", "__fixtures__", "latest-alert-fresh-review-history-timeframes.json"), "utf8"),
) as AlertIntakeResult;
const latestAlertEthLiveReviewTimestampStringFixture = JSON.parse(
  readFileSync(join(currentDir, "data", "fixtures", "latest-alert-eth-live-review-timestamp-string.json"), "utf8"),
) as AlertIntakeResult;
const hawkFixture = JSON.parse(
  readFileSync(join(currentDir, "..", "public", "data", "hawk-session-latest.json"), "utf8"),
) as HawkWatchSession;

function makeAlert(symbol: string, receivedAt: string, reason = "Context required"): LatestAlert {
  return {
    receivedAt,
    alertType: "THORP_TRADE_SIGNAL",
    symbol,
    normalizedSymbol: symbol,
    status: "fresh",
    payloadHash: `${symbol}-${receivedAt}`,
    triggeredReview: false,
    reviewStatus: "not_applicable",
    reason,
    autoExecution: false,
    executionIntent: "none",
  };
}

function makeReview(symbol: string, reviewCompletedAt: string, nextActionSentence = "Review needed"): FreshAlertReview {
  const normalizedSymbol = symbol.endsWith(".P") ? symbol : `${symbol}.P`;
  return ({
    contractVersion: "fresh-alert-3tf-review.v1",
    symbol,
    normalizedSymbol,
    status: "completed",
    tradingViewReadAttempted: true,
    tradingViewReadState: "completed",
    tradingViewRefreshAttempted: false,
    tradingViewMutationAttempted: false,
    alertReceivedAt: reviewCompletedAt,
    reviewStartedAt: reviewCompletedAt,
    reviewCompletedAt,
    originalChartContextCaptured: false,
    originalChartContextRestored: false,
    timeframes: {
      "15m": { status: "fresh", source: "tradingview_read", decision: "WAIT", action: "Context required", score: null },
      "1H": { status: "fresh", source: "tradingview_read", decision: "WAIT", action: "Context required", score: null },
      "4H": { status: "fresh", source: "tradingview_read", decision: "WAIT", action: "Context required", score: null },
    },
    livePrice: { status: "unavailable", price: null, timestamp: reviewCompletedAt },
    finalRecommendation: "WAIT",
    nextActionSentence,
    riskReason: "History-only review context",
    confidence: "medium",
    guardrails: { readOnly: true, autoExecution: false, executionIntent: "none" },
  }) as unknown as FreshAlertReview;
}

function makeSnapshot(symbols: string[]): TradingDeskSnapshot {
  return {
    watchlist: symbols.map((symbol) => ({ symbol, normalizedSymbol: symbol, status: "WAIT", freshnessStatus: "fresh", missingEvidence: [] })),
    hudHeartbeatDecisions: [],
  } as unknown as TradingDeskSnapshot;
}

function makeAlertIntake(overrides: Partial<AlertIntakeResult>): AlertIntakeResult {
  return {
    contractVersion: "edward-alert-intake.v1",
    generatedAt: "2026-05-15T00:00:00.000Z",
    webhookStatus: "healthy",
    latestAlert: null,
    latestBySymbol: {},
    latestBySymbolTimeframe: {},
    recentAlerts: [],
    queueDepth: 0,
    ...overrides,
  } as AlertIntakeResult;
}

function hawkLoadResult(session: HawkWatchSession): HawkLoadResult {
  return {
    status: session.current_state === "STALE_NO_ACTION" ? "stale" : "available",
    session,
    message: "Hawk session available.",
    validationIssues: [],
    loadedAt: "2026-06-02T13:00:00.000Z",
  };
}

function staleHawkLoadResult(session: HawkWatchSession): HawkLoadResult {
  return {
    status: "stale",
    session,
    message: "Hawk data stale/unavailable. No action.",
    validationIssues: [],
    loadedAt: "2026-06-02T13:05:00.000Z",
  };
}

function renderHawk(session: HawkWatchSession) {
  return renderToStaticMarkup(React.createElement(EdwardHawkPage, { hawkResult: hawkLoadResult(session) }));
}

describe("Trading Desk shell", () => {
  it("does not render the visible data source/demo control panel", () => {
    expect(appSource).not.toContain("<DemoControls");
    expect(appSource).not.toContain("Data source and demo scenario controls");
    expect(appSource).not.toContain("Live Edward snapshot first");
    expect(appSource).not.toContain("Demo remains available as an explicit fallback");
  });

  it("validates and renders the Edward Hawk current decision from the sample session", () => {
    expect(validateHawkSession(hawkFixture).ok).toBe(true);
    const html = renderHawk(hawkFixture);

    expect(html).toContain("Edward Hawk decision");
    expect(html).toContain("VALID_ENTRY_REVIEW");
    expect(html).toContain("Valid entry review. Advisory only. Manual approval required. Execution disabled.");
    expect(html).toContain("JUPUSDT");
    expect(html).toContain("Range Long Sweep/Reclaim");
  });

  it("renders WATCH_SUPPORT as a watch alert and says touch is not permission", () => {
    const watchSupport = {
      ...hawkFixture,
      current_state: "WATCH_SUPPORT",
      latest_decision: {
        ...hawkFixture.latest_decision!,
        state: "WATCH_SUPPORT",
        message: "Support touched at 0.1984. No entry yet; wait for seller failure and reclaim.",
        order_ticket_suggestion: null,
      },
    } as HawkWatchSession;
    const html = renderHawk(watchSupport);

    expect(html).toContain("WATCH_SUPPORT");
    expect(html).toContain("Support touched. No entry yet. Touch is not permission.");
    expect(html).not.toContain("Advisory ticket");
  });

  it("renders the fresh Hawk story states without granting entry before valid review", () => {
    const storyStates = [
      {
        state: "WATCH_SUPPORT",
        message: "Support touched at 0.1984. No entry yet; wait for seller failure and reclaim.",
        copy: "Support touched. No entry yet. Touch is not permission.",
      },
      {
        state: "WAITING_FOR_RECLAIM",
        message: "Sweep/support test in progress. Still no entry; wait for a 15m reclaim above 0.1984.",
        copy: "Waiting for reclaim. No entry until reclaim confirms.",
      },
      {
        state: "RECLAIM_CONFIRMED",
        message: "Reclaim confirmed above 0.1984. Entry review may become active if price holds and pushes into 0.2000 - 0.2010.",
        copy: "Reclaim confirmed. Entry review only if price holds and pushes into the review zone.",
      },
    ] as const;

    for (const { state, message, copy } of storyStates) {
      const session = {
        ...hawkFixture,
        current_state: state,
        latest_decision: {
          ...hawkFixture.latest_decision!,
          state,
          message,
          order_ticket_suggestion: null,
        },
      } as HawkWatchSession;
      const html = renderHawk(session);

      expect(html).toContain(state);
      expect(html).toContain(copy);
      expect(html).not.toContain("Advisory ticket");
      expect(html).not.toContain("Proposed action");
    }
  });

  it("renders VALID_ENTRY_REVIEW advisory ticket with execution disabled and approval required", () => {
    const html = renderHawk(hawkFixture);

    expect(html).toContain("Advisory ticket");
    expect(html).toContain("Advisory only. Manual approval required. Execution disabled.");
    expect(html).toContain("Approval required");
    expect(html).toContain("Yes");
    expect(html).toContain("Execution enabled");
    expect(html).toContain("No");
    expect(html).toContain("Auto execution");
    expect(html).toContain("false");
    expect(html).toContain("Execution intent");
    expect(html).toContain("none");
  });

  it("renders fresh Hawk live management fields with safe action wording", () => {
    const html = renderHawk(hawkFixture);

    expect(html).toContain("Live Management");
    expect(html).toContain("Valid entry review. Good add zone is 0.1988-0.2005 / 0.2000-0.2010 depending on fill quality. Manual approval required. Execution disabled.");
    expect(html).toContain("3:30pm 15m close");
    expect(html).toContain("Review stays valid only while data is fresh and price holds the plan.");
    expect(html).toContain("Good add zone only after reclaim");
    expect(html).toContain("0.1988 - 0.2005");
    expect(html).toContain("Soft invalidation");
    expect(html).toContain("0.1982");
    expect(html).toContain("Hard failure");
    expect(html).toContain("0.1955");
    expect(html).toContain("Chase cutoff");
    expect(html).toContain("0.2035");
    expect(html).toContain("Manual review only");
    expect(html).toContain("execution disabled");
    expect(html).not.toContain("allowed to trade");
  });

  it("renders WAITING_FOR_RECLAIM live management as no-add/no-action", () => {
    const waitingForReclaim = {
      ...hawkFixture,
      current_state: "WAITING_FOR_RECLAIM",
      latest_decision: {
        ...hawkFixture.latest_decision!,
        state: "WAITING_FOR_RECLAIM",
        message: "Sweep/support test is in progress. No entry; wait for reclaim.",
        order_ticket_suggestion: null,
      },
      live_management: {
        ...hawkFixture.live_management!,
        operator_message: "JUPUSDT inside the support zone. No add yet. Waiting for reclaim above 0.1982.",
        current_decision_plain: "WAITING_FOR_RECLAIM",
        next_checkpoint: {
          at: "2026-06-02T15:30:00-04:00",
          label: "3:30pm 15m close",
          reason: "Need candle close above reclaim level 0.1982.",
        },
        next_checkpoint_reason: "Need candle close above reclaim level 0.1982.",
        action_allowed: false,
        action_type: "none",
        no_action_reason: "Price is still below reclaim; touch/support test is not permission.",
      },
    } as HawkWatchSession;
    const html = renderHawk(waitingForReclaim);

    expect(html).toContain("WAITING_FOR_RECLAIM");
    expect(html).toContain("No add yet");
    expect(html).toContain("Waiting for reclaim above 0.1982");
    expect(html).toContain("Good add zone only after reclaim");
    expect(html).toContain("0.1988 - 0.2005");
    expect(html).toContain("No action allowed");
    expect(html).toContain("touch/support test is not permission");
    expect(html).not.toContain("Advisory ticket");
    expect(html.toLowerCase()).not.toContain("confirm trade");
    expect(html.toLowerCase()).not.toContain("send order");
    expect(html.toLowerCase()).not.toContain("place order");
  });

  it("renders VALID_ENTRY_REVIEW live management as review only, not execution", () => {
    const html = renderHawk(hawkFixture);

    expect(html).toContain("Valid entry review");
    expect(html).toContain("Manual approval required");
    expect(html).toContain("Execution disabled");
    expect(html).toContain("Manual review only");
    expect(html).toContain("Advisory ticket");
    expect(html.toLowerCase()).not.toContain("confirm trade");
    expect(html.toLowerCase()).not.toContain("send order");
    expect(html.toLowerCase()).not.toContain("place order");
  });

  it("renders missing or stale Hawk data as safe no-action unavailable state", () => {
    const missingHtml = renderToStaticMarkup(React.createElement(EdwardHawkPage, { hawkResult: safeUnavailableHawkSession("hawk-session-latest.json unavailable: HTTP 404") }));
    const staleSession = {
      ...hawkFixture,
      current_state: "STALE_NO_ACTION",
      latest_decision: {
        ...hawkFixture.latest_decision!,
        state: "STALE_NO_ACTION",
        message: "Candle/context data is stale, missing, or unavailable. No action.",
        data_confidence: "STALE_OR_UNAVAILABLE",
        order_ticket_suggestion: null,
      },
    } as HawkWatchSession;
    const staleHtml = renderHawk(staleSession);

    expect(missingHtml).toContain("HAWK DATA UNAVAILABLE");
    expect(missingHtml).toContain("Hawk data stale/unavailable. No action.");
    expect(staleHtml).toContain("HAWK DATA UNAVAILABLE");
    expect(staleHtml).toContain("Hawk data stale/unavailable. No action.");
    expect(staleHtml).not.toContain("Advisory ticket");
  });

  it("fails closed when a schema-valid Hawk artifact is stale but still claims VALID_ENTRY_REVIEW with a ticket", () => {
    const staleButValidEntryReview = {
      ...hawkFixture,
      current_state: "VALID_ENTRY_REVIEW",
      latest_decision: {
        ...hawkFixture.latest_decision!,
        state: "VALID_ENTRY_REVIEW",
        data_confidence: "STALE_OR_UNAVAILABLE",
        order_ticket_suggestion: hawkFixture.latest_decision!.order_ticket_suggestion,
      },
      live_management: {
        ...hawkFixture.live_management!,
        operator_message: "Valid entry review. Manual approval required. Execution disabled.",
        action_allowed: "review_only",
        action_type: "review_only",
      },
    } as HawkWatchSession;
    const html = renderToStaticMarkup(React.createElement(EdwardHawkPage, { hawkResult: staleHawkLoadResult(staleButValidEntryReview) }));

    expect(html).toContain("HAWK DATA UNAVAILABLE");
    expect(html).toContain("Hawk data stale/unavailable. No action.");
    expect(html).not.toContain("Advisory ticket");
    expect(html).not.toContain("Valid entry review. Advisory only. Manual approval required. Execution disabled.");
    expect(html).not.toContain("Valid entry review. Manual approval required. Execution disabled.");
    expect(html).not.toContain("Good add zone only after reclaim");
    expect(html).not.toContain("Proposed action");
    expect(html).not.toContain("Execution enabled");
  });

  it("keeps older Hawk artifacts without live_management rendering safely", () => {
    const oldArtifact = {
      ...hawkFixture,
      live_management: undefined,
    } as HawkWatchSession;
    const html = renderHawk(oldArtifact);

    expect(html).toContain("Live Management");
    expect(html).toContain("No execution - decision fields shown");
    expect(html).toContain("VALID_ENTRY_REVIEW");
    expect(html).toContain("Advisory ticket");
    expect(html.toLowerCase()).not.toContain("confirm trade");
    expect(html.toLowerCase()).not.toContain("send order");
    expect(html.toLowerCase()).not.toContain("place order");
  });

  it("does not render an execution or order action in the Hawk panel", () => {
    const html = renderHawk(hawkFixture).toLowerCase();

    expect(html).not.toContain("<button");
    expect(html).not.toContain("confirm trade");
    expect(html).not.toContain("send order");
    expect(html).not.toContain("place order");
  });

  it("keeps journal summary as the default view and moves full detail behind a See Detail toggle", () => {
    expect(appSource.indexOf('className="trade-journal-stats"')).toBeGreaterThan(-1);
    expect(appSource).toContain("<summary");
    expect(appSource).toContain("See Detail");
    expect(appSource).not.toContain("<details className=\"trade-journal-details\" open>");
    expect(appSource).not.toContain("ALL ${trades.length}/${trades.length}");
    expect(appSource.indexOf('className="trade-journal-detail-body"')).toBeGreaterThan(
      appSource.indexOf('className="trade-journal-stats"'),
    );
    expect(appSource).toContain("trade-journal-mobile-cards");
    expect(appSource).toContain("journalDetailRows.map");
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

  it("paginates trade journal detail rows instead of rendering every trade at once", () => {
    expect(appSource).toContain("TRADE_JOURNAL_PAGE_SIZE = 10");
    expect(appSource).toContain("journalDetailRows = journal.tableRows.slice");
    expect(appSource).toContain("Page {safeJournalPage + 1} of {journalPageCount}");
    expect(appSource).toContain("Previous journal page");
    expect(appSource).toContain("Next journal page");
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
    expect(appSource.indexOf("<TopCommandHeader")).toBeLessThan(appSource.indexOf("<PrimaryTradeDecisionPanel snapshot={snapshot} loadResult={loadResult} />"));
  });

  it("maps Primary Scan rows to operator evidence labels instead of vague trade copy", () => {
    const missing: WatchlistItem = {
      symbol: "SOLUSDT.P",
      status: "SKIP",
      latestRichScannerAt: null,
      latestHudHeartbeatAt: null,
      freshnessStatus: "missing",
      missingEvidence: ["LEGACY_SCANNER_WAKEUP_MISSING", "RICH_SCANNER_MISSING", "HUD_CONTEXT_MISSING"],
    };
    const stale: WatchlistItem = {
      symbol: "XRPUSDT.P",
      status: "EXTENDED",
      latestRichScannerAt: "2026-05-04T14:30:26.000Z",
      latestHudHeartbeatAt: null,
      freshnessStatus: "stale",
      missingEvidence: ["HUD_CONTEXT_MISSING"],
      duplicateStaleNoActionStatus: ["richScanner:SKIP_STALE", "richScanner:stale"],
    };
    const legacyOnly: WatchlistItem = {
      symbol: "DOGEUSDT.P",
      status: "EXTENDED",
      latestLegacyScannerWakeupAt: "2026-05-03T16:15:12.000Z",
      latestRichScannerAt: null,
      latestHudHeartbeatAt: null,
      freshnessStatus: "stale",
      missingEvidence: ["RICH_SCANNER_MISSING"],
    };

    expect(derivePrimaryScanDisplay(missing)).toMatchObject({
      direction: "Direction: unavailable",
      scanner: "Scanner: waiting for natural fire",
      hud: "HUD: missing",
      freshness: "Freshness: missing",
      decision: "Decision: NO ACTION",
      reason: "Waiting for natural fire",
    });
    expect(derivePrimaryScanDisplay(stale)).toMatchObject({
      direction: "Direction: unavailable",
      scanner: "Scanner: rich stale",
      hud: "HUD: missing",
      freshness: "Freshness: partial",
      decision: "Decision: BLOCKED",
      reason: "HUD context missing",
    });
    expect(derivePrimaryScanDisplay(legacyOnly)).toMatchObject({
      scanner: "Scanner: rich missing",
      hud: "HUD: missing",
      decision: "Decision: BLOCKED",
      reason: "No fresh rich scanner evidence",
    });
  });

  it("removes confusing Primary Scan fallbacks and raw status badges from the panel", () => {
    expect(appSource).not.toContain("No direction");
    expect(appSource).not.toContain("No note provided");
    expect(appSource).toContain("derivePrimaryScanDisplay");
    expect(appSource).toContain("primary-scan-evidence");
  });

  it("renders a decision-first cockpit with refresh, risk ladder, and watchlist surfaces", () => {
    expect(appSource).toContain("REFRESH_INTERVAL_SECONDS = 30");
    expect(appSource).toContain("Next refresh");
    expect(appSource).toContain("Active Basket Coverage");
    expect(appSource).toContain("Risk & Ladder Management");
    const commandIndex = appSource.indexOf("<PrimaryTradeDecisionPanel snapshot={snapshot} loadResult={loadResult} />");
    const guardrailIndex = appSource.indexOf("<RiskGuardrailsPanel snapshot={snapshot} />");
    const warningIndex = appSource.indexOf("<WarningAndRecheck snapshot={snapshot} />");
    const alertIndex = appSource.indexOf("<LatestAlertPanel alertIntake={loadResult.alertIntake} />");
    const watchlistIndex = appSource.indexOf("<WatchlistPanel snapshot={snapshot} compact />");
    const riskIndex = appSource.indexOf("<RiskLadderPanel snapshot={snapshot} />");

    expect(commandIndex).toBeGreaterThan(-1);
    expect(commandIndex).toBeLessThan(guardrailIndex);
    expect(guardrailIndex).toBeLessThan(warningIndex);
    expect(warningIndex).toBeLessThan(alertIndex);
    expect(watchlistIndex).toBeGreaterThan(-1);
    expect(riskIndex).toBeGreaterThan(-1);
    expect(appSource).toContain("Edward Health");
    expect(appSource).toContain("Producer Status");
    expect(appSource).toContain("Data Source Status");
  });

  it("keeps the Performance report pace-first and journal second", () => {
    const portfolioIndex = appSource.indexOf("<PortfolioCommandBar snapshot={snapshot} />");
    const softLandingIndex = appSource.indexOf("<SoftLandingPanel snapshot={snapshot} />");
    const compoundingIndex = appSource.indexOf("<CompoundingStatusCard snapshot={snapshot} />");
    const journalIndex = appSource.indexOf("<TradeJournalPanel snapshot={snapshot} />");

    expect(portfolioIndex).toBeGreaterThan(-1);
    expect(portfolioIndex).toBeLessThan(softLandingIndex);
    expect(softLandingIndex).toBeLessThan(compoundingIndex);
    expect(compoundingIndex).toBeLessThan(journalIndex);
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

  it("frames Performance as a compact read-only portfolio and journal report", () => {
    expect(appSource).toContain('title: "Portfolio & Journal"');
    expect(appSource).toContain('description: "Portfolio pace and closed-trade results. Read-only performance view."');
    expect(appSource).toContain('label: "Performance"');
    expect(appSource).toContain('eyebrow: ""');
    expect(appSource).toContain('page.eyebrow ? <span>{page.eyebrow}</span> : null');
    expect(appSource).toContain("Data stale — portfolio values may lag. No trade decisions from this page.");
    expect(appSource).toContain("READ-ONLY");
    expect(appSource).not.toContain("performance-subnav");
    expect(appSource).not.toContain('title="Portfolio & Pace"');
    expect(appSource).not.toContain('eyebrow: "Pace + Journal"');
    expect(appSource).toContain("Compounding Status");
    expect(appSource).toContain("Realized Journal PnL");
    expect(appSource).toContain("Moon target rate");
    expect(appSource).toContain("Sun target rate");
    expect(appSource).toContain("Average trade");
    expect(appSource).toContain("Median trade");
    expect(appSource).toContain("Largest win");
    expect(appSource).toContain("Largest loss");
    expect(appSource).toContain("Last closed trade");
  });

  it("adds an Alert Inbox page with read-only wake-up signal doctrine", () => {
    expect(appSource).toContain('id: "alerts"');
    expect(appSource).toContain('label: "Alerts"');
    expect(appSource).toContain('title: "Alert Inbox"');
    expect(appSource).toContain("Latest received alert for each active-basket symbol. Alerts are wake-up signals only; fresh context review is required before any trade decision.");
    expect(appSource).toContain("READ-ONLY alert ledger. No trade action is created from this page.");
    expect(appSource).toContain('case "alerts"');
  });

  it("keeps Alert Inbox compact with missing-alert rows and no execution affordances", () => {
    expect(appSource).toContain("buildAlertInboxRows");
    expect(appSource).toContain("No alert received");
    expect(appSource).toContain("Missing");
    expect(appSource).toContain("Fresh");
    expect(appSource).toContain("Aging");
    expect(appSource).toContain("Stale");
    expect(appSource).toContain("Context required");
    expect(appSource).toContain("Read-only · Auto-execution");
    expect(appSource).toContain("Execution intent");
    expect(appSource).toContain("Fresh review not available — fresh chart context is required before any trade decision.");
    expect(appSource).toContain("alert-technical-details");
    expect(appSource).toContain("truncatePayloadHash");
    expect(appSource).not.toContain("Place order");
    expect(appSource).not.toContain("Trade now");
  });

  it("includes JUPUSDT from fresh alert review history as canonical JUPUSDT.P", () => {
    const rows = buildAlertInboxRows(makeSnapshot(["BTCUSDT.P"]), makeAlertIntake({
      freshAlertReviewHistory: {
        current: null,
        lastSuccessfulBySymbol: { JUPUSDT: makeReview("JUPUSDT", "2026-05-15T12:00:00.000Z") },
        blockedBySymbol: {},
        recent: [],
      },
    }));

    expect(rows.map((row) => row.normalizedSymbol)).toContain("JUPUSDT.P");
    expect(rows.filter((row) => row.normalizedSymbol === "JUPUSDT.P")).toHaveLength(1);
    expect(rows.find((row) => row.normalizedSymbol === "JUPUSDT.P")?.sourceDetail).toBe("latest alert history");
  });

  it("dedupes JUPUSDT and JUPUSDT.P into one Alert Inbox row", () => {
    const rows = buildAlertInboxRows(makeSnapshot(["JUPUSDT.P"]), makeAlertIntake({
      latestBySymbol: { JUPUSDT: makeAlert("JUPUSDT", "2026-05-15T12:00:00.000Z") },
      recentAlerts: [makeAlert("JUPUSDT.P", "2026-05-15T11:00:00.000Z")],
    }));

    expect(rows.filter((row) => row.normalizedSymbol === "JUPUSDT.P")).toHaveLength(1);
    expect(rows.map((row) => row.symbol)).not.toContain("JUPUSDT");
  });

  it("selects the newest alert or review across available Alert Inbox sources", () => {
    const rows = buildAlertInboxRows(makeSnapshot(["JUPUSDT.P"]), makeAlertIntake({
      latestBySymbol: { JUPUSDT: makeAlert("JUPUSDT", "2026-05-15T10:00:00.000Z", "older direct") },
      latestBySymbolTimeframe: { JUPUSDT: { "15m": makeAlert("JUPUSDT", "2026-05-15T11:00:00.000Z", "newer timeframe") } },
      freshAlertReviewHistory: {
        current: null,
        lastSuccessfulBySymbol: { JUPUSDT: makeReview("JUPUSDT", "2026-05-15T12:00:00.000Z", "newest review") },
        blockedBySymbol: {},
        recent: [],
      },
    }));

    const row = rows.find((item) => item.normalizedSymbol === "JUPUSDT.P");
    expect(row?.alert?.receivedAt).toBe("2026-05-15T12:00:00.000Z");
    expect(row?.alert?.reason).toBe("newest review");
  });

  it("counts an alert-history-only symbol inside the normalized Alert Inbox universe", () => {
    const rows = buildAlertInboxRows(makeSnapshot(["BTCUSDT.P", "ETHUSDT.P"]), makeAlertIntake({
      freshAlertReviewHistory: {
        current: null,
        lastSuccessfulBySymbol: { JUPUSDT: makeReview("JUPUSDT", "2026-05-15T12:00:00.000Z") },
        blockedBySymbol: {},
        recent: [],
      },
    }));

    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((row) => row.normalizedSymbol)).size).toBe(3);
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

  it("renders trade management plan below active position management with protection and soft landing math", () => {
    expect(appSource.indexOf("<ActiveTradeManagementPanel binding={snapshot.managementBinding} />")).toBeLessThan(
      appSource.indexOf("<TradeManagementPlanPanel snapshot={snapshot} />"),
    );
    expect(appSource.indexOf("<TradeManagementPlanPanel snapshot={snapshot} />")).toBeLessThan(
      appSource.indexOf("<RecheckTriggersCard snapshot={snapshot} />"),
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

  it("renders latest alert intake as command detail without outranking decision or management", () => {
    const commandIndex = appSource.indexOf("<PrimaryTradeDecisionPanel snapshot={snapshot} loadResult={loadResult} />");
    const guardrailIndex = appSource.indexOf("<RiskGuardrailsPanel snapshot={snapshot} />");
    const warningIndex = appSource.indexOf("<WarningAndRecheck snapshot={snapshot} />");
    const alertIndex = appSource.indexOf("<LatestAlertPanel alertIntake={loadResult.alertIntake} />");
    const managementIndex = appSource.indexOf("<TradeManagementPlanPanel snapshot={snapshot} />");

    expect(alertIndex).toBeGreaterThan(-1);
    expect(commandIndex).toBeLessThan(guardrailIndex);
    expect(guardrailIndex).toBeLessThan(warningIndex);
    expect(warningIndex).toBeLessThan(alertIndex);
    expect(alertIndex).toBeLessThan(managementIndex);
    expect(appSource).toContain("Latest Alert / Alert Intake");
    expect(appSource).toContain("Alerts do not execute trades.");
    expect(appSource).toContain("Alert intake unavailable / no recent alerts");
    expect(appSource).toContain("context_only");
    expect(appSource).toContain("duplicate");
  });

  it("renders broker order truth warnings and relabels hard invalidation as THORP invalidation", () => {
    expect(appSource).toContain("BrokerOrderTruthWarnings");
    expect(appSource).toContain("ActiveThorpPlanLinkage");
    expect(appSource).toContain("Active THORP plan linked:");
    expect(appSource).toContain("Plan source");
    expect(appSource).toContain("Matched level");
    expect(appSource).toContain("formatMatchedEntryLevel");
    expect(appSource).toContain('if (!level || level === "unknown") return "Unknown";');
    expect(appSource).toContain('if (level === "a1" || level === "a2") return level.toUpperCase();');
    expect(appSource).toContain('if (level === "scout") return "Scout";');
    expect(appSource).toContain("Plan/broker mismatch");
    expect(appSource).toContain("MANUAL ATTENTION / UNPROTECTED RISK");
    expect(appSource).toContain("No broker stop-loss order found. THORP invalidation is a level, not exchange-side protection.");
    expect(appSource).toContain("PENDING ADD CONTRADICTION");
    expect(appSource).toContain("Edward says DO NOT ADD, but broker has open add order(s):");
    expect(appSource).toContain("THORP Invalidation");
    expect(appSource).toContain("Broker stop");
    expect(appSource).toContain("TP1 found");
    expect(appSource).toContain("TP2 missing");
    expect(appSource).toContain("TP3 missing");
    expect(appSource).not.toContain("Stop Protected");
    expect(appSource).not.toContain("stop active");
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

function alertIntakeFor(latestAlert: LatestAlert, overrides: Partial<AlertIntakeResult> = {}): AlertIntakeResult {
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
    ...overrides,
  };
}

describe("THORP rich setup latest-alert card", () => {
  const renderRich = (recommendation: ThorpScannerRecommendation, overrides: Partial<LatestAlert> = {}, intakeOverrides: Partial<AlertIntakeResult> = {}) =>
    renderToStaticMarkup(React.createElement(LatestAlertPanel, { alertIntake: alertIntakeFor(richAlert(recommendation, overrides), intakeOverrides) }));

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

  it("renders entry tactics as dominant operator line under scanner recommendation", () => {
    const html = renderRich("REVIEW_NOW", {
      entryTactics: {
        contractVersion: "entry-tactics-brain.v1",
        entryTactic: "A1_A2_RETEST_ONLY",
        positionSplit: "0/40/60",
        nextActionSentence: "Retest-only short. Do not chase current price. Use A1/A2 ladder; no fill, no trade.",
        riskReason: "15m is fresh, but 1H is late/no fresh entry and 4H is wait. Retest entries improve RR and avoid chasing below Scout.",
        autoExecution: false,
        executionIntent: "none",
      },
    });

    expect(html).toContain("Entry tactic");
    expect(html).toContain("A1/A2 RETEST ONLY");
    expect(html).toContain("Next action:");
    expect(html).toContain("Retest-only short. Do not chase current price. Use A1/A2 ladder; no fill, no trade.");
    expect(html).toContain("0/40/60");
    expect(html).toContain("15m is fresh");
  });

  it("does not render fresh/actionable badge when review is stale and fail-closed", () => {
    const html = renderRich("REVIEW_NOW", {
      status: "stale",
      entryTactics: {
        contractVersion: "entry-tactics-brain.v1",
        entryTactic: "NO_ACTION_STALE",
        positionSplit: "no entry",
        nextActionSentence: "No action. Alert became stale during TradingView review.",
        riskReason: "Fresh alert review exceeded the stale threshold.",
        autoExecution: false,
        executionIntent: "none",
      },
      freshAlertReview: freshReview({
        status: "blocked",
        tradingViewReadAttempted: false,
        tradingViewReadState: "blocked_stale_alert",
        tradingViewReadBlockedReason: "alert_stale_before_chart_context",
        finalRecommendation: "NO_ACTION_STALE",
      }),
    });

    expect(html).toContain("STALE CONTEXT — NO ACTION");
    expect(html).toContain("Stale context — no action.");
    expect(html).toContain("SKIP — STALE");
    expect(html).not.toContain("THORP SETUP READY");
    expect(html).not.toContain("REVIEW NOW");
  });

  it("does not render fresh/actionable state for production-shaped blocked Fresh Alert Review fixture", () => {
    const latestHtml = renderToStaticMarkup(React.createElement(LatestAlertPanel, { alertIntake: latestAlertFreshReviewBlockedFixture }));
    const reviewHtml = renderToStaticMarkup(React.createElement(FreshAlertReviewPanel, { alertIntake: latestAlertFreshReviewBlockedFixture }));
    const html = `${latestHtml}${reviewHtml}`;

    expect(html).toContain("STALE CONTEXT — NO ACTION");
    expect(html).toContain("Stale context — no action.");
    expect(html).toContain("SKIP — STALE");
    expect(html).toContain("blocked_stale_alert / alert_stale_before_chart_context");
    expect(html).toContain("unavailable_not_attempted_due_to_stale_alert");
    expect(html).not.toContain("THORP SETUP READY");
    expect(html).not.toContain("REVIEW NOW");
    expect(html).not.toContain("<button");
  });

  it("keeps generated history-timeframe fixture blocked/no-action without execution controls", () => {
    const latestHtml = renderToStaticMarkup(React.createElement(LatestAlertPanel, { alertIntake: latestAlertFreshReviewHistoryTimeframesFixture }));
    const reviewHtml = renderToStaticMarkup(React.createElement(FreshAlertReviewPanel, { alertIntake: latestAlertFreshReviewHistoryTimeframesFixture }));
    const html = `${latestHtml}${reviewHtml}`;

    expect(html).toContain("STALE CONTEXT — NO ACTION");
    expect(html).toContain("Stale context — no action.");
    expect(html).toContain("SKIP — STALE");
    expect(html).toContain("blocked_stale_alert / alert_stale_before_chart_context");
    expect(html).not.toContain("THORP SETUP READY");
    expect(html).not.toContain("REVIEW NOW");
    expect(html).not.toContain("Actionable");
    expect(html).not.toContain("<button");
    expect(latestAlertFreshReviewHistoryTimeframesFixture.freshAlertReviewHistory?.recent[0]?.timeframes["15m"]?.source).toBe("tradingview_read");
    expect(latestAlertFreshReviewHistoryTimeframesFixture.freshAlertReviewHistory?.recent[0]?.guardrails.autoExecution).toBe(false);
    expect(latestAlertFreshReviewHistoryTimeframesFixture.freshAlertReviewHistory?.recent[0]?.guardrails.executionIntent).toBe("none");
  });

  it("renders completed live ETH review with timestamp-string live price without unavailable state or execution controls", () => {
    const latestHtml = renderToStaticMarkup(React.createElement(LatestAlertPanel, { alertIntake: latestAlertEthLiveReviewTimestampStringFixture }));
    const reviewHtml = renderToStaticMarkup(React.createElement(FreshAlertReviewPanel, { alertIntake: latestAlertEthLiveReviewTimestampStringFixture }));
    const html = `${latestHtml}${reviewHtml}`;

    expect(html).toContain("THORP SETUP READY");
    expect(html).toContain("ETHUSDT");
    expect(html).toContain("Fresh Alert Review");
    expect(html).toContain("TradingView read-only pull");
    expect(html).toContain("available / 2,366.33");
    expect(html).toContain("A1/A2 RETEST ONLY");
    expect(html).toContain("Wait for A1/A2 retest. No fill, no trade. Do not chase.");
    expect(html).toContain("autoExecution false / executionIntent none");
    expect(html).not.toContain("Alert intake unavailable");
    expect(html).not.toContain("latest-alert.json validation failed");
    expect(html).not.toContain("<button");
  });

  it("renders setup ranking compactly when setupRanking exists", () => {
    const hiddenCandidates = Array.from({ length: 4 }, (_, index) => ({
      rank: index + 4,
      symbol: `ALT${index}USDT.P`,
      direction: "LONG",
      setupGrade: "C",
      recommendedFocus: "WATCH_ONLY",
      entryTactic: "WAIT_FOR_RETEST",
      autoExecution: false as const,
      executionIntent: "none" as const,
    }));
    const html = renderRich("WAIT_FOR_RETEST", {}, {
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
          {
            rank: 2,
            symbol: "BCHUSDT.P",
            direction: "LONG",
            setupGrade: "C",
            recommendedFocus: "WATCH_ONLY",
            entryTactic: "15m-only",
            autoExecution: false,
            executionIntent: "none",
          },
          {
            rank: 3,
            symbol: "LINKUSDT.P",
            direction: "SHORT",
            setupGrade: "C",
            recommendedFocus: "WATCH_ONLY",
            entryTactic: "1H late",
            autoExecution: false,
            executionIntent: "none",
          },
          ...hiddenCandidates,
        ],
        autoExecution: false,
        executionIntent: "none",
      },
    });

    expect(html).toContain("Setup ranking");
    expect(html).toContain("7 candidates considered; showing top 3.");
    expect(html).toContain("BNB SHORT — PRIMARY — A1/A2 RETEST ONLY");
    expect(html).toContain("BCH LONG — WATCH ONLY — 15m-only");
    expect(html).toContain("LINK SHORT — WATCH ONLY — 1H late");
    expect(html).toContain("Best action:");
    expect(html).toContain("Wait for BNB A1/A2 retest. Do not chase BCH/LINK.");
    expect(html).toContain("autoExecution false / executionIntent none");
  });

  it("does not render setup ranking when setupRanking is absent", () => {
    const html = renderRich("WAIT_FOR_RETEST");

    expect(html).not.toContain("Setup ranking");
    expect(html).toContain("WAIT FOR RETEST");
  });

  it.each([
    ["WAIT_FOR_RETEST", "WAIT FOR RETEST", "Wait for retest. Do not chase."],
    ["SKIP_STALE", "SKIP — STALE", "Stale context — no action."],
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
    const html = renderRich("REVIEW_NOW", {}, {
      setupRanking: {
        contractVersion: "setup-ranking-brain.v1",
        bestSetup: {},
        rankingSummary: "Ranking is advisory only.",
        bestActionSentence: "Wait for retest. No fill, no trade.",
        candidates: [
          {
            rank: 1,
            symbol: "BNBUSDT.P",
            direction: "SHORT",
            setupGrade: "B",
            recommendedFocus: "PRIMARY",
            entryTactic: "A1_A2_RETEST_ONLY",
            autoExecution: false,
            executionIntent: "none",
          },
        ],
        autoExecution: false,
        executionIntent: "none",
      },
    }).toLowerCase();

    expect(html).not.toContain("<button");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("href=");
    expect(html).not.toContain("buy");
    expect(html).not.toContain("sell");
    expect(html).not.toContain("enter ");
    expect(html).not.toContain("exit ");
    expect(html).not.toContain("order");
  });
});

const freshReviewTimeframe = (status: FreshAlertReview["timeframes"]["15m"]["status"] = "fresh") => ({
  status,
  source: "tradingview_read" as const,
  decision: status === "fresh" ? "READY | 10" : "WAIT",
  score: status === "fresh" ? 10 : 4,
  biasZone: "LONG LOWER",
  battlefield: "GREEN | 11.24%",
  trigger: "LOCKED LONG",
  action: status === "fresh" ? "FRESH LONG OK" : "NO ACTION",
  scout: 1.3876,
  a1: 1.371,
  a2: 1.3545,
  warning: 1.3483,
  hardInvalidation: 1.3403,
  t1: 1.4286,
  t2: 1.4553,
  t3: 1.5088,
  extractedAt: "2026-05-04T12:00:00.000Z",
});

function freshReview(overrides: Partial<FreshAlertReview> = {}): FreshAlertReview {
  return {
    contractVersion: "fresh-alert-3tf-review.v1",
    symbol: "XRPUSDT.P",
    normalizedSymbol: "XRPUSDT.P",
    status: "completed",
    tradingViewReadAttempted: true,
    tradingViewReadState: "completed",
    tradingViewReadBlockedReason: null,
    tradingViewRefreshAttempted: false,
    tradingViewMutationAttempted: false,
    originalChartContextCaptured: true,
    originalChartContextRestored: true,
    timeframes: {
      "15m": freshReviewTimeframe("fresh"),
      "1H": freshReviewTimeframe("stale"),
      "4H": freshReviewTimeframe("missing"),
    },
    livePrice: { status: "available", reason: null, price: 1.3891, timestamp: "2026-05-04T12:00:03.000Z" },
    finalRecommendation: "WAIT FOR RETEST",
    nextActionSentence: "Wait for A1/A2 retest. No fill, no trade.",
    riskReason: "15m is fresh, but higher timeframe confirmation is incomplete.",
    confidence: "medium",
    guardrails: { readOnly: true, autoExecution: false, executionIntent: "none" },
    ...overrides,
  };
}

describe("Fresh Alert Review panel", () => {
  it("renders TradingView read-only pull source and 3TF rows", () => {
    const latestAlert = richAlert("REVIEW_NOW", { freshAlertReview: freshReview({ finalRecommendation: "LATEST SHOULD NOT WIN" }) });
    const html = renderToStaticMarkup(React.createElement(FreshAlertReviewPanel, {
      alertIntake: alertIntakeFor(latestAlert, { freshAlertReview: freshReview() }),
    }));

    expect(html).toContain("Fresh Alert Review");
    expect(html).toContain("XRPUSDT.P 3TF HUD Pull");
    expect(html).toContain("TradingView read-only pull");
    expect(html).toContain("15m");
    expect(html).toContain("1H");
    expect(html).toContain("4H");
    expect(html).toContain("READY | 10");
    expect(html).toContain("FRESH LONG OK");
    expect(html).toContain("LONG LOWER");
    expect(html).toContain("available / 1.3891");
    expect(html).toContain("LATEST SHOULD NOT WIN");
    expect(html).toContain("Wait for A1/A2 retest. No fill, no trade.");
    expect(html).toContain("Original chart context restored");
    expect(html).toContain("yes / auto off");
    expect(html).toContain("autoExecution false / executionIntent none");
    expect(html).toContain("LATEST SHOULD NOT WIN");
  });

  it("renders restore warning and fail-closed copy when chart context is not restored", () => {
    const latestAlert = richAlert("REVIEW_NOW", {
      freshAlertReview: freshReview({
        originalChartContextCaptured: true,
        originalChartContextRestored: false,
        livePrice: { status: "unavailable", reason: "unavailable_not_attempted_due_to_stale_alert", price: null, timestamp: null },
        confidence: "low",
      }),
    });
    const html = renderToStaticMarkup(React.createElement(FreshAlertReviewPanel, { alertIntake: alertIntakeFor(latestAlert) }));

    expect(html).toContain("Warning: original chart context not restored / fail-closed");
    expect(html).toContain("unavailable");
    expect(html).toContain("LOW");
  });
});


describe("Active Trade Management Binding panel", () => {
  const baseBinding: ManagementBinding = {
    state: "verified",
    source: "broker_open_position",
    activePositionSymbol: "BCHUSDT.P",
    activePositionSide: "SHORT",
    normalizedSymbol: "BCHUSDT",
    timeframes: {
      "15m": { status: "fresh", symbol: "BCHUSDT", timeframe: "15m" },
      "1H": { status: "fresh", symbol: "BCHUSDT", timeframe: "1H" },
      "4H": { status: "fresh", symbol: "BCHUSDT", timeframe: "4H" },
    },
    managementConfidence: "HIGH",
    addPermission: "BLOCKED",
    addReason: "Management context verified; add permission remains controlled by risk/THORP logic.",
    nextAction: "hold / reduce / exit / wait",
    mismatchWarning: null,
    readOnly: true,
    autoExecution: false,
    executionIntent: "none",
  };

  it("renders active-position management separately from alert context", () => {
    const html = renderToStaticMarkup(React.createElement(ActiveTradeManagementPanel, { binding: baseBinding }));

    expect(html).toContain("Position management link");
    expect(html).toContain("BCHUSDT SHORT");
    expect(html).toContain("broker open position");
    expect(html).toContain("15m");
    expect(html).toContain("1H");
    expect(html).toContain("4H");
    expect(html).toContain("HIGH");
    expect(html).toContain("No action / blocked");
    expect(html).toContain("autoExecution false");
    expect(html).toContain("executionIntent none");
    expect(html).not.toContain("Place order");
    expect(html).not.toContain("Cancel order");
  });

  it("shows context mismatch no action when active position and visible detail differ", () => {
    const html = renderToStaticMarkup(React.createElement(ActiveTradeManagementPanel, { binding: { ...baseBinding, state: "blocked", managementConfidence: "BLOCKED", mismatchWarning: "Context mismatch — no action.", addReason: "Active position is BCHUSDT but 15m context is XRPUSDT.", timeframes: { ...baseBinding.timeframes, "15m": { status: "wrong_symbol", symbol: "XRPUSDT", reason: "Active position is BCHUSDT but 15m context is XRPUSDT." } } } }));

    expect(html).toContain("Context mismatch — no action.");
    expect(html).toContain("Active position is BCHUSDT but 15m context is XRPUSDT.");
  });
});
