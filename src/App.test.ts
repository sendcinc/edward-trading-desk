import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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
    expect(appSource).toContain("Edward Body Progress");
    expect(appSource).toContain("Current Chapter");
    expect(appSource).toContain("Overall Body Completion");
    expect(appSource).toContain("Next Milestone");
    expect(appSource).toContain("progress.executionAllowed ? \"Unlocked\" : \"Locked\"");
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
