import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CircleDollarSign,
  Clock3,
  Gauge,
  LockKeyhole,
  Radio,
  ShieldCheck,
  Target,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { loadTradingDeskSnapshot, type DemoScenario } from "./data/tradingDeskAdapter";
import type { DataMode, TradingDeskLoadResult, TradingDeskSnapshot } from "./domain/tradingDesk";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const pct = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });

export default function App() {
  const [loadResult, setLoadResult] = useState<TradingDeskLoadResult | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<DemoScenario>("normal_demo");
  const [dataSource, setDataSource] = useState<"live" | "demo">("live");
  const [loadState, setLoadState] = useState<"loading" | "ready">("loading");

  useEffect(() => {
    setLoadState("loading");
    const loadOptions = dataSource === "live"
      ? { source: "edward-api" as const }
      : { source: "demo" as const, scenario: selectedScenario };
    loadTradingDeskSnapshot(loadOptions)
      .then((loaded) => {
        setLoadResult(loaded);
        setLoadState("ready");
      })
      .catch(() => setLoadState("ready"));
  }, [dataSource, selectedScenario]);

  if (loadState === "loading" || !loadResult) {
    return <main className="app-shell loading-shell">Loading Edward Trading Desk...</main>;
  }

  const { snapshot } = loadResult;

  return (
    <main className="app-shell">
      <TopCommandHeader loadResult={loadResult} />
      <DataStateBanner loadResult={loadResult} />
      <DemoControls
        selectedScenario={selectedScenario}
        dataSource={dataSource}
        onScenarioChange={setSelectedScenario}
        onDataSourceChange={setDataSource}
      />
      <PortfolioCommandBar snapshot={snapshot} />
      <SoftLandingPanel snapshot={snapshot} />
      <ActivePositionCard snapshot={snapshot} />
      <EdwardVerdictPanel snapshot={snapshot} />
      <TradeObjectivePanel snapshot={snapshot} />
      <MarketMovementPanel snapshot={snapshot} />
      <WarningAndRecheck snapshot={snapshot} />
      <WatchlistStrip snapshot={snapshot} />
    </main>
  );
}

function TopCommandHeader({ loadResult }: { loadResult: TradingDeskLoadResult }) {
  const { snapshot, dataMode } = loadResult;
  return (
    <section className="command-header">
      <div>
        <p className="system-label">Edward Live Trade Desk</p>
        <h1>Edward Trading Desk</h1>
        <p className="subtitle">Position-aware command center</p>
      </div>
      <div className="header-status">
        <StatusPill label={formatDataMode(dataMode)} tone={dataMode} />
        <StatusPill label={formatStatus(snapshot.systemStatus)} tone={snapshot.systemStatus} />
        <span className="timestamp">
          <Clock3 size={14} />
          {formatTime(snapshot.timestamp)} · {formatAge(snapshot.timestamp)} old
        </span>
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

const demoScenarios: { value: DemoScenario; label: string }[] = [
  { value: "normal_demo", label: "Normal demo" },
  { value: "stale_data", label: "Stale data" },
  { value: "unavailable_edward", label: "Unavailable Edward" },
  { value: "invalid_snapshot", label: "Invalid snapshot" },
  { value: "no_active_trade", label: "No active trade" },
  { value: "active_trade_under_pressure", label: "Active trade under pressure" },
  { value: "active_trade_healthy", label: "Active trade healthy" },
];

function DemoControls({
  selectedScenario,
  dataSource,
  onScenarioChange,
  onDataSourceChange,
}: {
  selectedScenario: DemoScenario;
  dataSource: "live" | "demo";
  onScenarioChange: (scenario: DemoScenario) => void;
  onDataSourceChange: (source: "live" | "demo") => void;
}) {
  return (
    <section className="demo-controls" aria-label="Data source and demo scenario controls">
      <div>
        <p className="eyebrow">Data Source</p>
        <strong>{dataSource === "live" ? "Live Edward snapshot first" : "Developer demo mode"}</strong>
        <span>Demo remains available as an explicit fallback; live data is primary when valid.</span>
      </div>
      <div className="control-stack">
        <select value={dataSource} onChange={(event) => onDataSourceChange(event.target.value as "live" | "demo")}>
          <option value="live">Live Edward snapshot</option>
          <option value="demo">Developer demo scenarios</option>
        </select>
        <select
          value={selectedScenario}
          disabled={dataSource === "live"}
          onChange={(event) => onScenarioChange(event.target.value as DemoScenario)}
        >
          {demoScenarios.map((scenario) => <option key={scenario.value} value={scenario.value}>{scenario.label}</option>)}
        </select>
      </div>
    </section>
  );
}

function PortfolioCommandBar({ snapshot }: { snapshot: TradingDeskSnapshot }) {
  const { portfolio } = snapshot;
  return (
    <section className="portfolio-bar">
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

function SoftLandingPanel({ snapshot }: { snapshot: TradingDeskSnapshot }) {
  const pace = snapshot.softLandingPace;
  const position = snapshot.activePositionFocus;
  return (
    <section className="panel pace-panel">
      <PanelTitle icon={<Target />} eyebrow="Moon Pace / Sun Pace" title="Soft Landing Math" />
      <div className="pace-grid">
        <PaceLane
          name="Moon"
          dailyRate="0.60%"
          target={pace.moonTargetPVToday}
          gap={pace.moonGapDollars}
          dailyTarget={pace.moonDailyTargetDollars}
          status={pace.moonStatus}
        />
        <PaceLane
          name="Sun"
          dailyRate="0.80%"
          target={pace.sunTargetPVToday}
          gap={pace.sunGapDollars}
          dailyTarget={pace.sunDailyTargetDollars}
          status={pace.sunStatus}
        />
      </div>
      <div className="pace-copy">
        <span>Current PV {currency.format(pace.currentPV)}</span>
        <span>Baseline {currency.format(pace.baselinePV)} on {pace.baselineDate}</span>
        <span>{pace.daysSinceBaseline} days compounded</span>
      </div>
      {position?.estimatedProfitAtTP1 && (
        <p className="trade-math-line">
          If TP1 hits, this trade contributes approximately{" "}
          <strong>{asPct(position.tp1ContributionToMoonDailyTargetPct)}</strong> of today's Moon target and{" "}
          <strong>{asPct(position.tp1ContributionToSunDailyTargetPct)}</strong> of today's Sun target.
        </p>
      )}
    </section>
  );
}

function ActivePositionCard({ snapshot }: { snapshot: TradingDeskSnapshot }) {
  const position = snapshot.activePositionFocus;
  if (!position) {
    return (
      <section className="panel active-card empty-position">
        <PanelTitle icon={<Radio />} eyebrow="Active Position" title="No Open Position" />
        <p>No open position. Edward is standing by. THORP opportunities remain secondary until a trade is active.</p>
      </section>
    );
  }

  return (
    <section className="panel active-card">
      <div className="position-head">
        <div>
          <p className="eyebrow">Active Position Focus</p>
          <h2>{position.symbol}</h2>
        </div>
        <span className={`direction ${position.direction.toLowerCase()}`}>{position.direction}</span>
      </div>
      <div className="position-question">Is this trade still worth being in?</div>
      <div className="metric-grid">
        <Metric label="Entry" value={num(position.entryPrice)} />
        <Metric label="Current" value={num(position.currentPrice)} />
        <Metric label="Size" value={position.size?.toString() ?? "Unavailable"} />
        <Metric label="Leverage" value={position.leverage ? `${position.leverage}x` : "Unavailable"} />
        <Metric label="Margin" value={money(position.margin)} />
        <Metric label="Unrealized" value={money(position.unrealizedPnL)} trend={position.unrealizedPnL} />
        <Metric label="Distance to TP1" value={asPct(position.distanceToTP1Pct)} />
        <Metric label="Distance to Stop" value={asPct(position.distanceToStopPct)} danger />
        <Metric label="Profit at TP1" value={money(position.estimatedProfitAtTP1)} trend={position.estimatedProfitAtTP1} />
        <Metric label="Loss at Stop" value={money(position.estimatedLossAtStop)} danger />
        <Metric label="PV Gain at TP1" value={asPct(position.portfolioGainAtTP1Pct)} />
        <Metric label="PV Loss at Stop" value={asPct(position.portfolioLossAtStopPct)} danger />
      </div>
    </section>
  );
}

function EdwardVerdictPanel({ snapshot }: { snapshot: TradingDeskSnapshot }) {
  const verdict = snapshot.edwardVerdict;
  if (!verdict) return null;
  return (
    <section className="panel verdict-panel">
      <PanelTitle icon={<Gauge />} eyebrow="Edward Verdict" title={verdict.action} />
      <div className="verdict-tags">
        <span>{verdict.confidence} CONFIDENCE</span>
        <span>{verdict.movementClassification}</span>
      </div>
      <p className="summary">{verdict.summary}</p>
      <div className="verdict-notes">
        <p><strong>Edward would do:</strong> {verdict.whatIWouldDo}</p>
        <p><strong>Add guidance:</strong> {verdict.addGuidance}</p>
        <p><strong>Risk:</strong> {verdict.riskCommentary}</p>
      </div>
    </section>
  );
}

function TradeObjectivePanel({ snapshot }: { snapshot: TradingDeskSnapshot }) {
  const objective = snapshot.tradeObjective;
  if (!objective) return null;
  return (
    <section className="panel objective-panel">
      <PanelTitle icon={<TrendingUp />} eyebrow="Trade Objective" title="Today vs TP1" />
      <div className="objective-grid">
        <Metric label="Moon Target" value={`${objective.moonTargetPct}% / ${money(objective.moonTargetDollars)}`} />
        <Metric label="Sun Target" value={`${objective.sunTargetPct}% / ${money(objective.sunTargetDollars)}`} />
        <Metric label="TP1 to Moon" value={asPct(objective.tp1ContributionToMoonPct)} />
        <Metric label="TP1 to Sun" value={asPct(objective.tp1ContributionToSunPct)} />
      </div>
      <p className={objective.worthContinuing ? "worth yes" : "worth no"}>
        {objective.summary} Remaining reward {objective.worthContinuing ? "justifies staying in" : "does not justify staying in"}.
      </p>
    </section>
  );
}

function MarketMovementPanel({ snapshot }: { snapshot: TradingDeskSnapshot }) {
  const movement = snapshot.marketMovement;
  if (!movement) return null;
  return (
    <section className="panel market-panel">
      <PanelTitle icon={<Activity />} eyebrow="Market Movement" title="Structure Read" />
      <MovementRow label="15m" text={movement.fifteenMinute} />
      <MovementRow label="1H" text={movement.oneHour} />
      <MovementRow label="4H" text={movement.fourHour} />
      <MovementRow label="BTC" text={movement.btcContext} />
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
        <p>{snapshot.recheckTrigger?.condition ?? "Recheck when Edward publishes a new valid management condition."}</p>
      </div>
    </section>
  );
}

function WatchlistStrip({ snapshot }: { snapshot: TradingDeskSnapshot }) {
  return (
    <section className="panel watchlist-panel">
      <PanelTitle icon={<Radio />} eyebrow="Watchlist / Opportunity Strip" title="Secondary Context" />
      <p className="watchlist-summary">{snapshot.watchlistSummary.summary}</p>
      <div className="watchlist">
        {snapshot.watchlist.map((item) => (
          <article key={item.symbol} className="watch-item">
            <div>
              <strong>{item.symbol}</strong>
              <span>{item.direction ?? "No direction"}</span>
            </div>
            <StatusPill label={item.status} tone={item.status} />
            <p>{item.note}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function PaceLane({ name, dailyRate, target, gap, dailyTarget, status }: {
  name: string;
  dailyRate: string;
  target: number;
  gap: number;
  dailyTarget: number;
  status: string;
}) {
  return (
    <div className="pace-lane">
      <div>
        <span>{name} Pace</span>
        <strong className={status.toLowerCase()}>{status}</strong>
      </div>
      <Metric label="Target PV Today" value={currency.format(target)} />
      <Metric label="Gap" value={currency.format(gap)} trend={gap} />
      <Metric label={`Daily Target ${dailyRate}`} value={currency.format(dailyTarget)} />
    </div>
  );
}

function Metric({ label, value, icon, strong, trend, danger }: {
  label: string;
  value: string;
  icon?: ReactNode;
  strong?: boolean;
  trend?: number;
  danger?: boolean;
}) {
  const className = ["metric", strong ? "strong" : "", danger ? "danger" : "", trend && trend > 0 ? "positive" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={className}>
      <span>{icon}{label}</span>
      <strong>{trend !== undefined && trend > 0 ? <ArrowUpRight size={15} /> : null}{trend !== undefined && trend < 0 ? <ArrowDownRight size={15} /> : null}{value}</strong>
    </div>
  );
}

function PanelTitle({ icon, eyebrow, title }: { icon: ReactNode; eyebrow: string; title: string }) {
  return (
    <div className="panel-title">
      <span className="panel-icon">{icon}</span>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
    </div>
  );
}

function MovementRow({ label, text }: { label: string; text: string }) {
  return (
    <div className="movement-row">
      <span>{label}</span>
      <p>{text}</p>
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: string }) {
  return <span className={`status-pill ${tone.toLowerCase().replace(/\s+/g, "-").replace(/\//g, "")}`}>{label}</span>;
}

function formatDataMode(mode: DataMode) {
  return mode.replace(/_/g, " ").toUpperCase();
}

function dataModeMessage(loadResult: TradingDeskLoadResult) {
  switch (loadResult.dataMode) {
    case "live_available":
      return "Edward data validated and fresh. Adapter contract passed runtime checks.";
    case "live_stale":
      return "Edward data is stale. Do not treat this as current market truth until a fresh snapshot arrives.";
    case "live_unavailable":
      return "Edward is unavailable. This desk is showing safe fallback data and should not drive trading decisions.";
    case "validation_error":
      return "Snapshot validation failed. The UI rejected the incoming contract and is showing fallback data.";
    case "demo_mode":
      return "Demo data is active. This is for visual testing only and is not live Edward output.";
  }
}

function money(value?: number) {
  return value === undefined ? "Unavailable" : currency.format(value);
}

function num(value?: number) {
  return value === undefined ? "Unavailable" : value.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function asPct(value?: number) {
  return value === undefined ? "N/A" : pct.format(value);
}

function formatTime(timestamp: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
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

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}
