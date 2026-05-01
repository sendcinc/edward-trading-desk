import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CircleDollarSign,
  Clock3,
  Gauge,
  ListChecks,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Target,
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { EDWARD_SNAPSHOT_ENDPOINT, loadTradingDeskSnapshot } from "./data/tradingDeskAdapter";
import { buildTradeJournalSummary } from "./data/tradeJournal";
import type { DataMode, TradingDeskLoadResult, TradingDeskSnapshot, TradingPosition } from "./domain/tradingDesk";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const pct = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });
const REFRESH_INTERVAL_SECONDS = 30;

export default function App() {
  const [loadResult, setLoadResult] = useState<TradingDeskLoadResult | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "refreshing">("loading");
  const [nextRefreshAt, setNextRefreshAt] = useState(() => Date.now() + REFRESH_INTERVAL_SECONDS * 1000);
  const [now, setNow] = useState(() => Date.now());

  const refreshSnapshot = useCallback(async (manual = false) => {
    setLoadState((current) => (current === "loading" ? "loading" : "refreshing"));
    try {
      const loaded = await loadTradingDeskSnapshot({ source: "edward-api" });
      setLoadResult(loaded);
    } finally {
      setNextRefreshAt(Date.now() + REFRESH_INTERVAL_SECONDS * 1000);
      setNow(Date.now());
      setLoadState("ready");
    }
    if (manual) setNow(Date.now());
  }, []);

  useEffect(() => {
    void refreshSnapshot();
  }, [refreshSnapshot]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => void refreshSnapshot(), REFRESH_INTERVAL_SECONDS * 1000);
    return () => window.clearInterval(timer);
  }, [refreshSnapshot]);

  if (loadState === "loading" || !loadResult) {
    return <main className="app-shell loading-shell">Loading Edward Trading Desk...</main>;
  }

  const { snapshot } = loadResult;
  const refreshSeconds = Math.max(0, Math.ceil((nextRefreshAt - now) / 1000));

  return (
    <main className="app-shell">
      <TopCommandHeader
        loadResult={loadResult}
        refreshSeconds={refreshSeconds}
        isRefreshing={loadState === "refreshing"}
        onRefresh={() => void refreshSnapshot(true)}
      />
      <DataStateBanner loadResult={loadResult} />
      <TradeDecisionCard snapshot={snapshot} />
      {!snapshot.activePositionFocus && <WatchlistPanel snapshot={snapshot} />}
      <EdwardVerdictPanel snapshot={snapshot} />
      <RiskLadderPanel snapshot={snapshot} />
      <MarketMovementPanel snapshot={snapshot} />
      <WarningAndRecheck snapshot={snapshot} />
      <SoftLandingPanel snapshot={snapshot} />
      <PortfolioCommandBar snapshot={snapshot} />
      {snapshot.activePositionFocus && <WatchlistPanel snapshot={snapshot} />}
      <TradeJournalPanel snapshot={snapshot} />
    </main>
  );
}

function TopCommandHeader({
  loadResult,
  refreshSeconds,
  isRefreshing,
  onRefresh,
}: {
  loadResult: TradingDeskLoadResult;
  refreshSeconds: number;
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  const { snapshot, dataMode } = loadResult;
  return (
    <section className="command-header">
      <div>
        <p className="system-label">Edward Live Trade Desk</p>
        <h1>Trading Cockpit</h1>
        <p className="subtitle">Decision-first position management for THORP / Edward.</p>
      </div>
      <div className="header-status">
        <StatusPill label={formatDataMode(dataMode)} tone={dataMode} />
        <StatusPill label={formatStatus(snapshot.systemStatus)} tone={snapshot.systemStatus} />
        <span className="timestamp">
          <Clock3 size={14} />
          Last updated {formatTime(loadResult.loadedAt)} · snapshot {formatAge(snapshot.timestamp)} old
        </span>
        <span className="timestamp refresh-status">Next refresh {isRefreshing ? "now" : `${refreshSeconds}s`}</span>
        <button className="refresh-button" type="button" onClick={onRefresh} disabled={isRefreshing}>
          <RefreshCw size={14} /> {isRefreshing ? "Refreshing" : "Refresh"}
        </button>
      </div>
    </section>
  );
}

function DataStateBanner({ loadResult }: { loadResult: TradingDeskLoadResult }) {
  const age = formatAge(loadResult.snapshot.timestamp);
  return (
    <section className={`data-state-banner ${loadResult.dataMode}`}>
      <div>
        <p className="eyebrow">Data State</p>
        <h2>{formatDataMode(loadResult.dataMode)}</h2>
        <span className="freshness-line">Snapshot {formatTime(loadResult.snapshot.timestamp)} · {age} old</span>
      </div>
      <p>{dataModeMessage(loadResult)}</p>
      {loadResult.validationIssues.length > 0 && (
        <ul>
          {loadResult.validationIssues.slice(0, 4).map((issue) => <li key={issue}>{issue}</li>)}
        </ul>
      )}
    </section>
  );
}

function TradeDecisionCard({ snapshot }: { snapshot: TradingDeskSnapshot }) {
  const position = snapshot.activePositionFocus;
  const verdict = snapshot.edwardVerdict;
  if (!position) {
    return (
      <section className="panel trade-decision-card no-position-decision">
        <div className="decision-topline">
          <div>
            <p className="eyebrow">Trade Decision</p>
            <h2>No open trade</h2>
            <p className="decision-subtitle">Edward is not managing an active position. Preserve attention; scan only for valid THORP setups.</p>
          </div>
          <StatusPill label={verdict.action} tone="WAIT" />
        </div>
        <div className="decision-action">{verdict.whatIWouldDo}</div>
        <div className="decision-guardrails">
          <Guardrail label="Opportunity posture" value="No active trade means watchlist scanning is promoted below, but only READY/CONDITIONAL setups matter." />
          <Guardrail label="Wrong behavior" value={snapshot.wrongBehavior?.message ?? "Do not manufacture a decision from boredom."} danger />
          <Guardrail label="Recheck trigger" value={formatRecheck(snapshot)} />
        </div>
      </section>
    );
  }

  const addPermission = deriveAddPermission(position, verdict.addGuidance, verdict.action);
  return (
    <section className="panel trade-decision-card">
      <div className="decision-topline">
        <div>
          <p className="eyebrow">Trade Decision</p>
          <h2>{position.symbol} <span className={`direction ${position.direction.toLowerCase()}`}>{position.direction}</span></h2>
          <p className="decision-subtitle">What should Edwin do right now with this open trade?</p>
        </div>
        <div className="decision-verdict">
          <span>Edward says</span>
          <strong>{verdict.action}</strong>
        </div>
      </div>

      <div className="decision-action">{verdict.whatIWouldDo}</div>

      <div className="decision-badges">
        <span>{verdict.confidence} CONFIDENCE</span>
        <span>{verdict.movementClassification}</span>
        <span className={addPermission.tone}>{addPermission.label}</span>
      </div>

      <div className="decision-metric-grid">
        <Metric label="Current Price" value={num(position.currentPrice)} strong />
        <Metric label="Entry Price" value={num(position.entryPrice)} />
        <Metric label="TP1" value={num(position.tp1)} />
        <Metric label="Stop" value={num(position.stop)} danger />
        <Metric label="Distance to TP1" value={asPct(position.distanceToTP1Pct)} />
        <Metric label="Distance to Stop" value={asPct(position.distanceToStopPct)} danger />
        <Metric label="Estimated Profit at TP1" value={money(position.estimatedProfitAtTP1)} trend={position.estimatedProfitAtTP1} />
        <Metric label="Estimated Loss at Stop" value={money(position.estimatedLossAtStop)} danger />
        <Metric label="PV Gain at TP1" value={asPct(position.portfolioGainAtTP1Pct)} />
        <Metric label="PV Loss at Stop" value={asPct(position.portfolioLossAtStopPct)} danger />
        <Metric label="Moon Contribution" value={asPct(position.tp1ContributionToMoonDailyTargetPct ?? position.tp1ContributionToMoonGapPct)} />
        <Metric label="Sun Contribution" value={asPct(position.tp1ContributionToSunDailyTargetPct ?? position.tp1ContributionToSunGapPct)} />
      </div>

      <div className="decision-guardrails">
        <Guardrail label="Add guidance" value={verdict.addGuidance} />
        <Guardrail label="Wrong behavior" value={snapshot.wrongBehavior?.message ?? "Do not manufacture a decision from anxiety."} danger />
        <Guardrail label="Recheck trigger" value={formatRecheck(snapshot)} />
      </div>
    </section>
  );
}

function EdwardVerdictPanel({ snapshot }: { snapshot: TradingDeskSnapshot }) {
  const verdict = snapshot.edwardVerdict;
  return (
    <section className="panel verdict-panel">
      <PanelTitle icon={<Gauge />} eyebrow="Edward Verdict / What I Would Do" title={verdict.action} />
      <div className="verdict-tags">
        <span>{verdict.confidence} CONFIDENCE</span>
        <span>{verdict.movementClassification}</span>
      </div>
      <p className="summary">{verdict.summary}</p>
      <div className="verdict-notes">
        <p><strong>What I would do:</strong> {verdict.whatIWouldDo}</p>
        <p><strong>Add guidance:</strong> {verdict.addGuidance}</p>
        <p><strong>Risk:</strong> {verdict.riskCommentary}</p>
      </div>
    </section>
  );
}

function RiskLadderPanel({ snapshot }: { snapshot: TradingDeskSnapshot }) {
  const position = snapshot.activePositionFocus;
  const addPermission = deriveAddPermission(position, snapshot.edwardVerdict.addGuidance, snapshot.edwardVerdict.action);
  const liquidationDistance = calculateLiquidationDistance(position);
  return (
    <section className="panel risk-ladder-panel">
      <PanelTitle icon={<ShieldCheck />} eyebrow="Risk & Ladder Management" title={snapshot.riskState.exposureStatus} />
      <p className="summary">{snapshot.riskState.summary}</p>
      <div className="risk-grid">
        <Metric label="Exposure Status" value={snapshot.riskState.exposureStatus} />
        <Metric label="Margin Used" value={money(snapshot.portfolio.marginUsed ?? position?.margin)} />
        <Metric label="Position Size" value={position?.size?.toString() ?? "Unavailable"} />
        <Metric label="Leverage" value={position?.leverage ? `${position.leverage}x` : "Unavailable"} />
        <Metric label="Liquidation Price" value={num(position?.liquidationPrice)} danger />
        <Metric label="Liquidation Distance" value={asPct(liquidationDistance)} danger />
        <Metric label="Next Add Level" value={num(position?.nextAddLevel)} />
        <Metric label="Avg Entry After Fills" value={num(position?.averageEntryAfterFills)} />
      </div>
      <div className="ladder-state">
        <Guardrail label="Add permission" value={`${addPermission.label}: ${snapshot.edwardVerdict.addGuidance}`} danger={addPermission.tone === "danger"} />
        <Guardrail label="Filled ladder entries" value={formatLadder(position?.filledLadderEntries)} />
        <Guardrail label="Remaining ladder entries" value={formatLadder(position?.remainingLadderEntries)} />
        <Guardrail label="Planned size split" value={position?.plannedSizeSplit ?? "Not provided in current snapshot contract."} />
      </div>
    </section>
  );
}

function MarketMovementPanel({ snapshot }: { snapshot: TradingDeskSnapshot }) {
  const movement = snapshot.marketMovement;
  if (!movement) return null;
  return (
    <section className="panel market-panel">
      <PanelTitle icon={<Activity />} eyebrow="Market Structure Read" title="Execution → Regime" />
      <MovementRow label="15m execution" text={movement.fifteenMinute} />
      <MovementRow label="1H continuation" text={movement.oneHour} />
      <MovementRow label="4H regime" text={movement.fourHour} />
      <MovementRow label="BTC context" text={movement.btcContext} />
    </section>
  );
}

function WarningAndRecheck({ snapshot }: { snapshot: TradingDeskSnapshot }) {
  return (
    <section className="warning-grid">
      <div className="panel warning-panel">
        <PanelTitle icon={<AlertTriangle />} eyebrow="Wrong Behavior Warning" title="Do Not Drift" />
        <p>{snapshot.wrongBehavior?.message ?? "Do not confuse attention with a new trade signal."}</p>
      </div>
      <div className="panel recheck-panel">
        <PanelTitle icon={<LockKeyhole />} eyebrow="Recheck Trigger" title="Next Review" />
        <p>{formatRecheck(snapshot)}</p>
      </div>
    </section>
  );
}

function SoftLandingPanel({ snapshot }: { snapshot: TradingDeskSnapshot }) {
  const pace = snapshot.softLandingPace;
  const position = snapshot.activePositionFocus;
  return (
    <section className="panel pace-panel">
      <PanelTitle icon={<Target />} eyebrow="Soft Landing Pace" title="Moon / Sun Math" />
      <div className="pace-grid">
        <PaceLane name="Moon" dailyRate="0.60%" target={pace.moonTargetPVToday} gap={pace.moonGapDollars} dailyTarget={pace.moonDailyTargetDollars} status={pace.moonStatus} />
        <PaceLane name="Sun" dailyRate="0.80%" target={pace.sunTargetPVToday} gap={pace.sunGapDollars} dailyTarget={pace.sunDailyTargetDollars} status={pace.sunStatus} />
      </div>
      <div className="pace-copy">
        <span>Current PV {currency.format(pace.currentPV)}</span>
        <span>Current Daily PV {asPct(pace.currentDailyPVPct)} vs Moon {asPct(pace.moonDailyRate)} / Sun {asPct(pace.sunDailyRate)}</span>
        <span>Baseline {currency.format(pace.baselinePV)} on {pace.baselineDate}</span>
        <span>{pace.daysSinceBaseline} days compounded</span>
      </div>
      {position?.estimatedProfitAtTP1 && (
        <p className="trade-math-line">
          If TP1 hits, this trade contributes approximately <strong>{asPct(position.tp1ContributionToMoonDailyTargetPct)}</strong> of today's Moon target and <strong>{asPct(position.tp1ContributionToSunDailyTargetPct)}</strong> of today's Sun target.
        </p>
      )}
    </section>
  );
}

function PortfolioCommandBar({ snapshot }: { snapshot: TradingDeskSnapshot }) {
  const { portfolio } = snapshot;
  return (
    <section className="portfolio-bar" aria-label="Portfolio Summary">
      <Metric label="Portfolio Value" value={currency.format(portfolio.currentPV)} icon={<CircleDollarSign />} strong />
      <Metric label="Equity" value={currency.format(portfolio.equity)} />
      <Metric label="Unrealized PnL" value={money(portfolio.unrealizedPnL)} trend={portfolio.unrealizedPnL} />
      <Metric label="Daily PnL" value={money(portfolio.dailyPnL)} trend={portfolio.dailyPnL} />
      <Metric label="Margin Used" value={money(portfolio.marginUsed)} />
      <div className={`exposure ${portfolio.exposureStatus.toLowerCase()}`}>
        <ShieldCheck size={18} />
        <span>{portfolio.exposureStatus}</span>
      </div>
    </section>
  );
}

function WatchlistPanel({ snapshot, compact = false, prominent = false }: { snapshot: TradingDeskSnapshot; compact?: boolean; prominent?: boolean }) {
  const summary = snapshot.watchlistSummary;
  const noOpenPosition = !snapshot.activePositionFocus;
  return (
    <section className={`panel watchlist-panel ${prominent || noOpenPosition ? "prominent" : ""} ${compact ? "compact" : ""}`}>
      <PanelTitle icon={<ListChecks />} eyebrow="Watchlist / Opportunity Scan" title={noOpenPosition ? "Primary Scan" : "Secondary Scan"} />
      <div className="watch-summary">
        <Metric label="Ready" value={summary.ready.toString()} />
        <Metric label="Conditional" value={summary.conditional.toString()} />
        <Metric label="Blocked" value={summary.blocked.toString()} />
        <Metric label="Total" value={summary.total.toString()} />
      </div>
      <p className="summary">{summary.summary}</p>
      <div className="watchlist-items">
        {snapshot.watchlist.map((item) => (
          <div className="watch-item" key={item.symbol}>
            <div>
              <strong>{item.symbol}</strong>
              <span>{item.direction ?? "No direction"}</span>
            </div>
            <StatusPill label={item.status} tone={item.status} />
            <p>{item.note ?? "No note provided."}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function TradeJournalPanel({ snapshot }: { snapshot: TradingDeskSnapshot }) {
  const journal = buildTradeJournalSummary(snapshot);
  return (
    <section className="panel trade-journal-panel">
      <details className="trade-journal-details" open>
        <summary className="trade-journal-header">
          <h2>Trade Journal</h2>
          <span className="trade-journal-badge">{journal.badge}</span>
        </summary>

        <div className="trade-journal-stats" aria-label="Trade journal summary">
          <JournalStat value={journal.stats.trades} label="TRADES" />
          <JournalStat value={journal.stats.wins} label="WINS" />
          <JournalStat value={journal.stats.losses} label="LOSSES" />
          <JournalStat value={journal.stats.winRate} label="WIN RATE" />
        </div>

        <div className="trade-journal-mobile-cards" aria-label="Mobile trade journal cards">
          {journal.tableRows.map((row) => (
            <article key={row.tradeId} className={`journal-card ${row.tone}`}>
              <div><strong>{row.symbol}</strong><span className={`trade-side ${row.side.toLowerCase()}`}>{row.side}</span></div>
              <p>{row.status} · {row.date}</p>
              <dl>
                <dt>P&L</dt><dd>{row.pnl}</dd>
                <dt>Entry / Exit</dt><dd>{row.entry} / {row.exit}</dd>
                <dt>Reason</dt><dd>{row.reason}</dd>
              </dl>
            </article>
          ))}
        </div>

        <div className="trade-journal-table-wrap">
          <table className="trade-journal-table">
            <thead>
              <tr>
                <th>Trade ID</th><th>Date</th><th>Symbol</th><th>Side</th><th>Status</th><th>Opened</th><th>Closed</th><th>Entry</th><th>Exit</th><th>Size</th><th>P&amp;L</th><th>Fees</th><th>Funding</th><th>Framework</th><th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {journal.tableRows.map((row) => (
                <tr key={row.tradeId} className={row.tone}>
                  <td>{row.tradeId}</td><td>{row.date}</td><td>{row.symbol}</td><td><span className={`trade-side ${row.side.toLowerCase()}`}>{row.side}</span></td><td>{row.status}</td><td>{row.opened}</td><td>{row.closed}</td><td>{row.entry}</td><td>{row.exit}</td><td>{row.size}</td><td>{row.pnl}</td><td>{row.fees}</td><td>{row.funding}</td><td>{row.framework}</td><td>{row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function Guardrail({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div className={`guardrail ${danger ? "danger" : ""}`}><span>{label}</span><strong>{value}</strong></div>;
}

function JournalStat({ value, label }: { value: string; label: string }) {
  return <div className="journal-stat"><strong>{value}</strong><span>{label}</span></div>;
}

function PaceLane({ name, dailyRate, target, gap, dailyTarget, status }: { name: string; dailyRate: string; target: number; gap: number; dailyTarget: number; status: string }) {
  return (
    <div className="pace-lane">
      <div><span>{name} Pace</span><strong className={status.toLowerCase()}>{status}</strong></div>
      <Metric label="Target PV Today" value={currency.format(target)} />
      <Metric label="Gap" value={currency.format(gap)} trend={gap} />
      <Metric label={`Daily Target ${dailyRate}`} value={currency.format(dailyTarget)} />
    </div>
  );
}

function Metric({ label, value, icon, strong, trend, danger }: { label: string; value: string; icon?: ReactNode; strong?: boolean; trend?: number; danger?: boolean }) {
  const className = ["metric", strong ? "strong" : "", danger ? "danger" : "", trend && trend > 0 ? "positive" : ""].filter(Boolean).join(" ");
  return <div className={className}><span>{icon}{label}</span><strong>{trend !== undefined && trend > 0 ? <ArrowUpRight size={15} /> : null}{trend !== undefined && trend < 0 ? <ArrowDownRight size={15} /> : null}{value}</strong></div>;
}

function PanelTitle({ icon, eyebrow, title }: { icon: ReactNode; eyebrow: string; title: string }) {
  return <div className="panel-title"><span className="panel-icon">{icon}</span><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div></div>;
}

function MovementRow({ label, text }: { label: string; text: string }) {
  return <div className="movement-row"><span>{label}</span><p>{text}</p></div>;
}

function StatusPill({ label, tone }: { label: string; tone: string }) {
  return <span className={`status-pill ${tone.toLowerCase().replace(/\s+/g, "-").replace(/\//g, "")}`}>{label}</span>;
}

function deriveAddPermission(position: TradingPosition | null | undefined, guidance: string, action: string) {
  if (!position) return { label: "NO POSITION", tone: "neutral" };
  if (position.addPermission === "ALLOWED_NOW" || action === "ADD NOW") return { label: "ADD ALLOWED NOW", tone: "positive" };
  if (position.addPermission === "ONLY_ON_RETEST" || action === "ADD ONLY ON RETEST" || /retest/i.test(guidance)) return { label: "ADD ONLY ON RETEST", tone: "caution" };
  if (position.addPermission === "UNAVAILABLE") return { label: "ADD PERMISSION UNAVAILABLE", tone: "caution" };
  return { label: "DO NOT ADD", tone: "danger" };
}

function calculateLiquidationDistance(position?: TradingPosition | null) {
  if (!position?.liquidationPrice || !position.currentPrice) return undefined;
  const raw = position.direction === "LONG"
    ? (position.currentPrice - position.liquidationPrice) / position.currentPrice
    : (position.liquidationPrice - position.currentPrice) / position.currentPrice;
  return Number.isFinite(raw) ? raw : undefined;
}

function formatLadder(entries?: TradingPosition["filledLadderEntries"]) {
  if (!entries?.length) return "Not provided in current snapshot contract.";
  return entries.map((entry) => [entry.label, entry.price ? num(entry.price) : undefined, entry.size ? `size ${entry.size}` : undefined, entry.status].filter(Boolean).join(" · ")).join("; ");
}

function formatRecheck(snapshot: TradingDeskSnapshot) {
  const trigger = snapshot.recheckTrigger;
  if (!trigger) return "Recheck when Edward publishes a new valid management condition.";
  const detail = [trigger.timeframe, trigger.priceLevel ? num(trigger.priceLevel) : undefined].filter(Boolean).join(" · ");
  return detail ? `${trigger.condition} (${detail})` : trigger.condition;
}

function formatDataMode(mode: DataMode) {
  return mode.replace(/_/g, " ").toUpperCase();
}

function dataModeMessage(loadResult: TradingDeskLoadResult) {
  switch (loadResult.dataMode) {
    case "live_available": return `Edward data validated and fresh from ${EDWARD_SNAPSHOT_ENDPOINT}. Adapter contract passed runtime checks.`;
    case "live_stale": return "Edward data is stale. Do not treat this as current market truth until a fresh snapshot arrives.";
    case "live_unavailable": return "Edward is unavailable. This desk is showing safe fallback data and should not drive trading decisions.";
    case "validation_error": return "Snapshot validation failed. The UI rejected the incoming contract and is showing fallback data.";
    case "demo_mode": return "Demo data is active. This is for visual testing only and is not live Edward output.";
  }
}

function money(value?: number) { return value === undefined ? "Unavailable" : currency.format(value); }
function num(value?: number) { return value === undefined ? "Unavailable" : value.toLocaleString("en-US", { maximumFractionDigits: 4 }); }
function asPct(value?: number) { return value === undefined ? "N/A" : pct.format(value); }

function formatTime(timestamp: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" }).format(new Date(timestamp));
}

function formatAge(timestamp: string) {
  const timestampMs = new Date(timestamp).getTime();
  if (!Number.isFinite(timestampMs)) return "unknown age";
  const ageSeconds = Math.max(0, Math.round((Date.now() - timestampMs) / 1000));
  if (ageSeconds < 90) return `${ageSeconds}s`;
  const ageMinutes = Math.round(ageSeconds / 60);
  if (ageMinutes < 90) return `${ageMinutes}m`;
  const ageHours = Math.round(ageMinutes / 60);
  return `${ageHours}h`;
}

function formatStatus(status: string) { return status.replace(/_/g, " "); }
