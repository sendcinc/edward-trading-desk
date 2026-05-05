import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BellRing,
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
import { edwardBodyProgress } from "./data/bodyProgress";
import { EDWARD_SNAPSHOT_ENDPOINT, LIVE_STALE_AFTER_MS, loadTradingDeskSnapshot, safeDegradedHealth } from "./data/tradingDeskAdapter";
import { buildTradeJournalSummary } from "./data/tradeJournal";
import type { AlertIntakeResult, DataMode, FreshAlertReview, FreshAlertReviewTimeframe, LatestAlert, ManagementBinding, ThorpRichScannerPayload, ThorpScannerRecommendation, TradingDeskHealth, TradingDeskLoadResult, TradingDeskSnapshot, TradingPosition, WatchlistItem } from "./domain/tradingDesk";
import { deriveEdwardCoreState, type EdwardCoreState } from "./edwardCoreState";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const pct = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });
const REFRESH_INTERVAL_SECONDS = 30;
const TRADE_JOURNAL_PAGE_SIZE = 10;

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
  const coreState = deriveEdwardCoreState({ snapshot, health: loadResult.health });
  const refreshSeconds = Math.max(0, Math.ceil((nextRefreshAt - now) / 1000));

  return (
    <main className="app-shell">
      <TopCommandHeader
        loadResult={loadResult}
        refreshSeconds={refreshSeconds}
        isRefreshing={loadState === "refreshing"}
        onRefresh={() => void refreshSnapshot(true)}
        coreState={coreState}
      />
      <DataStateBanner loadResult={loadResult} />
      <TradeDecisionCard snapshot={snapshot} />
      <ActiveTradeManagementPanel binding={snapshot.managementBinding} />
      <TradeManagementPlanPanel snapshot={snapshot} />
      <EdwardHealthPanel health={loadResult.health} />
      <LatestAlertPanel alertIntake={loadResult.alertIntake} />
      <FreshAlertReviewPanel alertIntake={loadResult.alertIntake} />
      <WatchlistPanel snapshot={snapshot} />
      <EdwardVerdictPanel snapshot={snapshot} />
      <RiskLadderPanel snapshot={snapshot} />
      <MarketMovementPanel snapshot={snapshot} />
      <WarningAndRecheck snapshot={snapshot} />
      <SoftLandingPanel snapshot={snapshot} />
      <PortfolioCommandBar snapshot={snapshot} />
      <EdwardBodyProgressPanel />
      <TradeJournalPanel snapshot={snapshot} />
    </main>
  );
}

export function ActiveTradeManagementPanel({ binding }: { binding?: ManagementBinding }) {
  const effective = binding ?? {
    state: "unavailable",
    source: "broker_open_position",
    activePositionSymbol: null,
    activePositionSide: null,
    normalizedSymbol: null,
    timeframes: {},
    managementConfidence: "BLOCKED",
    addPermission: "BLOCKED",
    addReason: "Add blocked: management binding unavailable.",
    nextAction: "No action.",
    mismatchWarning: null,
    readOnly: true,
    autoExecution: false,
    executionIntent: "none",
  } satisfies ManagementBinding;
  const danger = effective.state === "blocked" || effective.managementConfidence === "BLOCKED" || effective.addPermission === "BLOCKED";
  const symbol = effective.normalizedSymbol ?? effective.activePositionSymbol ?? "No active position";
  const side = effective.activePositionSide ?? "—";
  const title = effective.state === "idle"
    ? "No active position — management binding idle."
    : effective.normalizedSymbol || effective.activePositionSymbol
      ? `${symbol} ${side} — Active Position Management`
      : "Active Position Management binding unavailable";

  return (
    <section className={`panel active-trade-management-panel ${danger ? "warning" : "ready"}`}>
      <div className="latest-alert-head">
        <PanelTitle icon={<ShieldCheck />} eyebrow="Active Trade Management / Management Binding" title={title} />
        <StatusPill label={effective.managementConfidence} tone={effective.managementConfidence.toLowerCase()} />
      </div>
      <div className="alert-metrics">
        <Metric label="Active position" value={effective.state === "idle" ? "No open broker position" : `${symbol} ${side}`} strong />
        <Metric label="Source" value="broker open position" />
        <Metric label="15m" value={formatManagementTimeframe(effective, "15m")} danger={managementTimeframeDanger(effective, "15m")} />
        <Metric label="1H" value={formatManagementTimeframe(effective, "1H")} danger={managementTimeframeDanger(effective, "1H")} />
        <Metric label="4H" value={formatManagementTimeframe(effective, "4H")} danger={managementTimeframeDanger(effective, "4H")} />
        <Metric label="Add permission" value={effective.addPermission} danger={effective.addPermission !== "ALLOWED"} />
        <Metric label="Next action" value={effective.nextAction} strong />
      </div>
      <div className="alert-guardrails">
        <Guardrail label="Binding state" value={effective.state} danger={danger} />
        <Guardrail label="Add reason" value={effective.addReason} danger={effective.addPermission === "BLOCKED"} />
        <Guardrail label="Execution guardrail" value={`readOnly ${String(effective.readOnly)} / autoExecution ${String(effective.autoExecution)} / executionIntent ${effective.executionIntent}`} danger={!effective.readOnly || effective.autoExecution || effective.executionIntent !== "none"} />
      </div>
      {effective.mismatchWarning ? <p className="alert-warning"><AlertTriangle size={16} /> {effective.mismatchWarning}</p> : null}
    </section>
  );
}

function formatManagementTimeframe(binding: ManagementBinding, timeframe: "15m" | "1H" | "4H") {
  const row = binding.timeframes[timeframe];
  if (!row) return binding.state === "idle" ? "idle" : "missing";
  const symbol = row.symbol ? ` / ${row.symbol}` : "";
  const reason = row.reason ? ` — ${row.reason}` : "";
  return `${row.status}${symbol}${reason}`;
}

function managementTimeframeDanger(binding: ManagementBinding, timeframe: "15m" | "1H" | "4H") {
  const status = binding.timeframes[timeframe]?.status;
  return binding.state !== "idle" && status !== "fresh";
}

export function FreshAlertReviewPanel({ alertIntake }: { alertIntake?: AlertIntakeResult }) {
  const review = alertIntake?.latestAlert?.freshAlertReview ?? alertIntake?.freshAlertReview ?? null;
  if (!review) return null;

  const restoreOk = review.originalChartContextCaptured && review.originalChartContextRestored;
  return (
    <section className={`panel fresh-alert-review-panel ${restoreOk ? "ready" : "warning"}`}>
      <div className="latest-alert-head">
        <PanelTitle icon={<ListChecks />} eyebrow="Fresh Alert Review" title={`${review.normalizedSymbol} 3TF HUD Pull`} />
        <StatusPill label={review.confidence.toUpperCase()} tone={review.confidence} />
      </div>

      <div className="fresh-alert-review-summary">
        <Metric label="Source" value="TradingView read-only pull" strong />
        <Metric label="Live price" value={formatLivePrice(review)} danger={review.livePrice.status !== "available"} />
        <Metric label="Final recommendation" value={review.finalRecommendation} strong />
        <Metric label="Read state" value={review.tradingViewReadBlockedReason ? `${review.tradingViewReadState} / ${review.tradingViewReadBlockedReason}` : review.tradingViewReadState} danger={review.tradingViewReadState !== "completed"} />
        <Metric label="Read-only" value={`yes / auto ${review.guardrails.autoExecution ? "on" : "off"}`} danger={!review.guardrails.readOnly || review.guardrails.autoExecution} />
      </div>

      <div className="fresh-alert-timeframes" aria-label="3TF check rows">
        {(["15m", "1H", "4H"] as const).map((timeframe) => (
          <FreshAlertTimeframeRow key={timeframe} label={timeframe} review={review.timeframes[timeframe]} />
        ))}
      </div>

      <div className="fresh-alert-callouts">
        <div>
          <span>Next action</span>
          <strong>{review.nextActionSentence}</strong>
        </div>
        <div>
          <span>Risk reason</span>
          <strong>{review.riskReason}</strong>
        </div>
        <div className={restoreOk ? "" : "danger"}>
          <span>Restore</span>
          <strong>{restoreOk ? "Original chart context restored" : "Warning: original chart context not restored / fail-closed"}</strong>
        </div>
      </div>

      <div className="alert-guardrails">
        <Guardrail label="TradingView mutation" value={review.tradingViewMutationAttempted ? "attempted" : "not attempted"} danger={review.tradingViewMutationAttempted} />
        <Guardrail label="Execution guardrail" value={`readOnly ${String(review.guardrails.readOnly)} / autoExecution ${String(review.guardrails.autoExecution)} / executionIntent ${review.guardrails.executionIntent}`} danger={!review.guardrails.readOnly || review.guardrails.autoExecution || review.guardrails.executionIntent !== "none"} />
      </div>
    </section>
  );
}

function FreshAlertTimeframeRow({ label, review }: { label: "15m" | "1H" | "4H"; review: FreshAlertReviewTimeframe }) {
  const stale = review.status !== "fresh";
  return (
    <div className={`fresh-alert-timeframe-row ${stale ? "warning" : "fresh"}`}>
      <div className="fresh-alert-timeframe-main">
        <strong>{label}</strong>
        <StatusPill label={review.status} tone={review.status} />
      </div>
      <Metric label="Score" value={numOrUnavailable(review.score)} danger={stale} />
      <Metric label="Decision" value={formatNullable(review.decision)} />
      <Metric label="Action" value={formatNullable(review.action)} />
      <Metric label="Bias" value={formatNullable(review.biasZone)} />
    </div>
  );
}

function formatLivePrice(review: FreshAlertReview) {
  const price = review.livePrice.status === "available" ? numOrUnavailable(review.livePrice.price) : "Unavailable";
  const reason = review.livePrice.reason ? ` / ${review.livePrice.reason}` : "";
  const timestamp = review.livePrice.timestamp ? ` @ ${formatTime(review.livePrice.timestamp)}` : "";
  return `${review.livePrice.status}${price === "Unavailable" ? reason : ` / ${price}`}${timestamp}`;
}

function isStaleOrBlockedReview(review?: FreshAlertReview | null) {
  if (!review) return false;
  return review.status === "stale" || review.status === "blocked" || review.tradingViewReadState === "blocked_stale_alert" || review.finalRecommendation === "NO_ACTION_STALE" || review.entryTactics?.entryTactic === "NO_ACTION_STALE";
}

export function LatestAlertPanel({ alertIntake }: { alertIntake?: AlertIntakeResult }) {
  const latest = alertIntake?.latestAlert ?? null;
  const unavailable = !alertIntake || alertIntake.webhookStatus === "unavailable";
  const stale = isAlertIntakeStale(alertIntake);
  const status = latest?.status;
  const needsWarning = unavailable || stale || status === "context_only" || status === "invalid" || status === "duplicate";
  const warning = alertWarningText({ unavailable, stale, status });

  if (isRichThorpScannerAlert(latest)) {
    return <ThorpSetupReadyCard alert={latest} alertIntake={alertIntake} needsWarning={needsWarning} warning={warning} />;
  }

  return (
    <section className={`panel latest-alert-panel ${needsWarning ? "warning" : "ready"}`}>
      <div className="latest-alert-head">
        <PanelTitle icon={<BellRing />} eyebrow="Latest Alert / Alert Intake" title={latest ? `${latest.alertType} received` : "Alert intake unavailable / no recent alerts"} />
        <StatusPill label={alertIntake?.webhookStatus ?? "unavailable"} tone={alertIntake?.webhookStatus ?? "unavailable"} />
      </div>

      <div className="alert-metrics">
        <Metric label="Type" value={latest?.alertType ?? "No recent alert"} />
        <Metric label="Symbol" value={latest?.normalizedSymbol ?? latest?.symbol ?? "Unavailable"} />
        <Metric label="Timeframe" value={latest?.timeframe ?? "Unavailable"} />
        <Metric label="Direction" value={formatAlertSide(latest)} />
        <Metric label="Age" value={latest ? formatAge(latest.receivedAt) : "No recent alerts"} />
        <Metric label="Status" value={latest?.status ?? "unavailable"} danger={needsWarning} />
        <Metric label="Review Trigger" value={latest ? (latest.triggeredReview ? "Triggered" : "Not triggered") : "Unavailable"} />
        <Metric label="Review Status" value={latest?.reviewStatus ?? "Unavailable"} />
      </div>

      <div className="alert-guardrails">
        <Guardrail label="Execution" value="Alerts do not execute trades." danger />
        <Guardrail label="Intent" value={latest ? `autoExecution ${String(latest.autoExecution)} / executionIntent ${latest.executionIntent}` : "No executable intent available."} danger />
        <Guardrail label="Queue" value={`${alertIntake?.queueDepth ?? 0} queued reviews`} />
        <Guardrail label="Latest reason" value={latest?.reason ?? "No recent valid alert intake data is available."} danger={needsWarning} />
      </div>

      {latest?.alertType === "THORP_SCORE_READY" && latest.classification !== "thorp_score_ready_rich_scanner_alert" ? (
        <p className="alert-warning"><AlertTriangle size={16} /> Fresh context/setup review required before any action.</p>
      ) : null}
      {warning && <p className="alert-warning"><AlertTriangle size={16} /> {warning}</p>}
      {alertIntake?.validationIssues?.length ? (
        <ul className="health-issues">
          {alertIntake.validationIssues.slice(0, 2).map((issue) => <li key={issue}>{issue}</li>)}
        </ul>
      ) : null}
    </section>
  );
}


function ThorpSetupReadyCard({
  alert,
  alertIntake,
  needsWarning,
  warning,
}: {
  alert: LatestAlert;
  alertIntake?: AlertIntakeResult;
  needsWarning: boolean;
  warning: string;
}) {
  const payload = alert.richScannerPayload!;
  const review = alert.freshAlertReview ?? alertIntake?.freshAlertReview ?? null;
  const staleReview = isStaleOrBlockedReview(review);
  const staleContext = alert.status === "stale" || alert.scannerRecommendation === "SKIP_STALE" || alert.entryTactics?.entryTactic === "NO_ACTION_STALE" || staleReview;
  const recommendation = staleContext ? { label: "SKIP — STALE", copy: "Stale context — no action." } : thorpRecommendationDisplay(alert.scannerRecommendation);
  const title = staleContext ? "STALE CONTEXT — NO ACTION" : "THORP SETUP READY";
  return (
    <section className={`panel latest-alert-panel thorp-setup-card ${needsWarning || staleContext ? "warning" : "ready"}`}>
      <div className="latest-alert-head thorp-setup-head">
        <PanelTitle icon={<BellRing />} eyebrow="Latest Alert / THORP Scanner" title={title} />
        <div className="thorp-setup-tags">
          <StatusPill label={alertIntake?.webhookStatus ?? "unavailable"} tone={alertIntake?.webhookStatus ?? "unavailable"} />
          <StatusPill label={recommendation.label} tone={staleContext ? "stale" : alert.scannerRecommendation ?? "CONTEXT_INCOMPLETE"} />
        </div>
      </div>

      {staleContext ? <p className="alert-warning"><AlertTriangle size={16} /> Stale context — no action.</p> : null}

      <div className="thorp-recommendation">
        <span>Scanner recommendation</span>
        <strong>{recommendation.label}</strong>
        <p>{recommendation.copy}</p>
      </div>

      {alert.entryTactics ? (
        <div className="entry-tactics-callout">
          <span>Entry tactic</span>
          <strong>{entryTacticDisplay(alert.entryTactics.entryTactic)}</strong>
          <p className="entry-next-action"><b>Next action:</b> {alert.entryTactics.nextActionSentence}</p>
          <p><b>Split:</b> {alert.entryTactics.positionSplit}</p>
          <p><b>Risk reason:</b> {alert.entryTactics.riskReason}</p>
        </div>
      ) : null}

      {alertIntake?.setupRanking ? <SetupRankingPanel ranking={alertIntake.setupRanking} /> : null}

      <div className="alert-metrics thorp-setup-grid">
        <Metric label="Symbol" value={alert.normalizedSymbol ?? alert.symbol ?? payload.symbol ?? "Unavailable"} />
        <Metric label="Timeframe" value={alert.timeframe ?? payload.timeframe ?? "Unavailable"} />
        <Metric label="Direction" value={formatNullable(payload.direction ?? alert.side)} />
        <Metric label="Score" value={formatNullable(payload.score)} strong />
        <Metric label="Bias / Zone" value={formatNullable(payload.bias_zone)} />
        <Metric label="Battlefield" value={formatNullable(payload.battlefield)} />
        <Metric label="Trigger" value={formatNullable(payload.trigger)} />
        <Metric label="Action" value={formatNullable(payload.action)} />
        <Metric label="Price at alert" value={numOrUnavailable(payload.price_at_alert)} />
        <Metric label="Scout" value={numOrUnavailable(payload.entries?.scout)} />
        <Metric label="A1" value={numOrUnavailable(payload.entries?.a1)} />
        <Metric label="A2" value={numOrUnavailable(payload.entries?.a2)} />
        <Metric label="Warning" value={numOrUnavailable(payload.risk?.warning)} danger />
        <Metric label="Hard invalidation" value={numOrUnavailable(payload.risk?.invalidation ?? payload.risk?.hardInvalidation ?? payload.risk?.hard)} danger />
        <Metric label="T1" value={numOrUnavailable(payload.targets?.t1)} />
        <Metric label="T2" value={numOrUnavailable(payload.targets?.t2)} />
        <Metric label="T3" value={numOrUnavailable(payload.targets?.t3)} />
        <Metric label="Range H/M/L" value={`${numOrUnavailable(payload.range?.high)} / ${numOrUnavailable(payload.range?.mid)} / ${numOrUnavailable(payload.range?.low)}`} />
        <Metric label="Rotation" value={formatNullable(payload.rotation)} />
        <Metric label="Body %" value={payload.body_pct === null || payload.body_pct === undefined ? "Unavailable" : `${num(payload.body_pct)}%`} />
        <Metric label="Age/status" value={`${formatAge(alert.receivedAt)} / ${alert.status}`} danger={needsWarning} />
      </div>

      <div className="alert-guardrails thorp-setup-guardrails">
        <Guardrail label="Setup copy" value={payload.copy ?? "THORP detected a potential setup. This is not an execution command."} danger />
        <Guardrail label="Execution" value="Alerts do not execute trades." danger />
        <Guardrail label="Intent" value={`autoExecution ${String(alert.autoExecution)} / executionIntent ${alert.executionIntent}`} danger />
        <Guardrail label="Queue" value={`${alertIntake?.queueDepth ?? 0} queued reviews`} />
      </div>

      {warning && <p className="alert-warning"><AlertTriangle size={16} /> {warning}</p>}
    </section>
  );
}

function SetupRankingPanel({ ranking }: { ranking: NonNullable<AlertIntakeResult["setupRanking"]> }) {
  const hiddenCount = Math.max(0, ranking.candidates.length - 3);

  return (
    <div className="setup-ranking-callout">
      <span>Setup ranking</span>
      {hiddenCount > 0 ? <p className="setup-ranking-hidden">{ranking.candidates.length} candidates considered; showing top 3.</p> : null}
      <ul>
        {ranking.candidates.slice(0, 3).map((candidate) => (
          <li key={`${candidate.rank}-${candidate.symbol}`}>
            {formatSetupRankingSymbol(candidate.symbol)} {candidate.direction} — {setupRankingFocusDisplay(candidate.recommendedFocus)} — {entryTacticDisplay(candidate.entryTactic)}
          </li>
        ))}
      </ul>
      <p><b>Best action:</b> {ranking.bestActionSentence}</p>
      <p className="setup-ranking-intent">autoExecution {String(ranking.autoExecution)} / executionIntent {ranking.executionIntent}</p>
    </div>
  );
}

function TopCommandHeader({
  loadResult,
  refreshSeconds,
  isRefreshing,
  onRefresh,
  coreState,
}: {
  loadResult: TradingDeskLoadResult;
  refreshSeconds: number;
  isRefreshing: boolean;
  onRefresh: () => void;
  coreState: EdwardCoreState;
}) {
  const { snapshot, dataMode } = loadResult;
  return (
    <section className="command-header">
      <div className="command-title-row">
        <div className="command-title-copy">
          <div className="title-meta-row">
            <p className="system-label">Edward Live Trade Desk</p>
            <EdwardCoreAvatar core={coreState} />
          </div>
          <h1>Trading Cockpit</h1>
          <p className="subtitle">Decision-first position management for THORP / Edward.</p>
        </div>
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

function EdwardCoreAvatar({ core }: { core: EdwardCoreState }) {
  return (
    <div className={`edward-core-avatar ${core.avatarState.toLowerCase()}`} aria-label={`Edward Core ${core.avatarState}`}>
      {/* CSS animation honors prefers-reduced-motion: reduce */}
      <svg className="edward-core-orb" viewBox="0 0 64 64" role="img" aria-hidden="true">
        <defs>
          <radialGradient id="edward-core-glow" cx="50%" cy="42%" r="58%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.95" />
            <stop offset="46%" stopColor="currentColor" stopOpacity="0.42" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.05" />
          </radialGradient>
        </defs>
        <circle className="edward-core-halo" cx="32" cy="32" r="28" />
        <circle className="edward-core-pulse" cx="32" cy="32" r="19" />
        <circle className="edward-core-ring" cx="32" cy="32" r="22" />
        <path className="edward-core-scan" d="M32 8a24 24 0 0 1 20.8 12M56 32a24 24 0 0 1-8 17.9M32 56a24 24 0 0 1-20.8-12M8 32a24 24 0 0 1 8-17.9" />
        <circle className="edward-core-node" cx="32" cy="32" r="8" />
      </svg>
      <div className="edward-core-copy">
        <strong>{core.title}</strong>
        <span>{core.subtitle}</span>
        <small>{core.guardrail === "Manual / Read-only" ? core.guardrail : "Manual / Read-only"} · {core.allAutoExecutionFalse ? "Auto off" : "Auto flag detected"}</small>
      </div>
    </div>
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
          <p className="decision-subtitle">What should Edward do right now with this open trade?</p>
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
      <SeparatedStateBar snapshot={snapshot} />
      <BrokerOrderTruthWarnings snapshot={snapshot} />

      <div className="decision-metric-grid">
        <Metric label="Current Price" value={num(position.currentPrice)} strong />
        <Metric label="Entry Price" value={num(position.entryPrice)} />
        <Metric label="TP1" value={num(position.tp1)} />
        <Metric label={position.stopSource === "hardInvalidation" ? "THORP Invalidation" : "Broker Stop"} value={num(position.stopSource === "hardInvalidation" ? position.thorpLevels?.hardInvalidation ?? position.stop : position.brokerProtection?.stopLossPrice ?? position.stop)} danger />
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


function formatPlanSource(source?: string): string {
  if (!source) return "Unavailable";
  return source.replace(/_/g, " ");
}

function formatMatchedEntryLevel(level?: string | null): string {
  if (!level || level === "unknown") return "Unknown";
  if (level === "a1" || level === "a2") return level.toUpperCase();
  if (level === "scout") return "Scout";
  return level;
}

function ActiveThorpPlanLinkage({ position }: { position: TradingPosition }) {
  const plan = position.activeThorpPlan;
  const visibility = position.riskVisibility;
  const linked = position.activePlanLinked ?? visibility?.activePlanLinked ?? Boolean(plan);
  const entryLevels = plan?.entryLevels ?? visibility?.entryLevels ?? [];
  const matched = plan?.matchedEntryLevel ?? visibility?.matchedEntryLevel;
  return (
    <div className={`active-thorp-plan-link ${linked ? "linked" : "missing"}`}>
      <strong>Active THORP plan linked: {linked ? "Yes" : "No"}</strong>
      <div className="active-plan-grid">
        <Metric label="Plan source" value={formatPlanSource(plan?.source)} />
        <Metric label="Matched level" value={formatMatchedEntryLevel(matched)} />
        <Metric label="Plan/broker mismatch" value={visibility?.planBrokerMismatch ? "Yes" : "No"} danger={visibility?.planBrokerMismatch} />
      </div>
      {entryLevels.length > 0 ? (
        <div className="entry-level-tags" aria-label="Matched THORP entry levels">
          {entryLevels.map((entry) => (
            <span className="entry-level-tag" key={`${entry.level}-${entry.price}-${entry.status}`}>
              {formatMatchedEntryLevel(entry.level)} {entry.status.toLowerCase()} · {num(entry.price)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function BrokerOrderTruthWarnings({ snapshot }: { snapshot: TradingDeskSnapshot }) {
  const position = snapshot.activePositionFocus;
  const visibility = position?.riskVisibility;
  const protection = position?.brokerProtection;
  const thorpInvalidation = position?.thorpLevels?.hardInvalidation ?? (position?.stopSource === "hardInvalidation" ? position.stop : undefined);
  const addPrices = protection?.openAddPrices ?? [];
  if (!position || (!visibility && !protection)) return null;
  const tpPrices = protection?.takeProfitPrices ?? [];
  const expectedTps = [position.thorpLevels?.t1 ?? position.tp1, position.thorpLevels?.t2 ?? position.tp2, position.thorpLevels?.t3 ?? position.tp3];
  const found = (target?: number) => typeof target === "number" && tpPrices.some((price) => Math.abs(price - target) <= Math.max(0.01, Math.abs(target) * 0.0015));
  return (
    <div className="broker-truth-warnings" aria-label="Broker order truth warnings">
      <ActiveThorpPlanLinkage position={position} />
      {visibility?.unprotectedRisk || visibility?.stopProtectionStatus === "MISSING" ? (
        <div className="broker-warning critical">
          <strong>MANUAL ATTENTION / UNPROTECTED RISK</strong>
          <p>No broker stop-loss order found. THORP invalidation is a level, not exchange-side protection.</p>
          <Metric label="THORP invalidation" value={num(thorpInvalidation)} danger />
          <Metric label="Broker stop" value="Not found" danger />
        </div>
      ) : protection?.stopLossPresent ? (
        <div className="broker-warning ok">
          <strong>Broker stop confirmed</strong>
          <Metric label="Broker stop" value={num(protection.stopLossPrice ?? undefined)} />
        </div>
      ) : null}
      {visibility?.openAddContradiction ? (
        <div className="broker-warning critical">
          <strong>PENDING ADD CONTRADICTION</strong>
          <p>Edward says DO NOT ADD, but broker has open add order(s): {addPrices.length ? addPrices.map(num).join(", ") : "Unavailable"}.</p>
        </div>
      ) : null}
      <div className="tp-coverage-grid">
        <Metric label="Broker TP coverage" value={visibility?.tpCoverageStatus ?? "UNKNOWN"} danger={visibility?.tpCoverageStatus !== "FULL"} />
        <Metric label="TP1" value={found(expectedTps[0]) ? "TP1 found" : "TP1 missing"} danger={!found(expectedTps[0])} />
        <Metric label="TP2" value={found(expectedTps[1]) ? "TP2 found" : "TP2 missing"} danger={!found(expectedTps[1])} />
        <Metric label="TP3" value={found(expectedTps[2]) ? "TP3 found" : "TP3 missing"} danger={!found(expectedTps[2])} />
      </div>
    </div>
  );
}

function EdwardHealthPanel({ health }: { health?: TradingDeskHealth }) {
  const degraded = !health;
  const shown = health ?? safeDegradedHealth("health.json unavailable");
  const sources = Object.entries(shown.sources).slice(0, 7);
  return (
    <section className={`panel health-panel ${shown.producerStatus}`}>
      <div className="health-head">
        <PanelTitle icon={<Activity />} eyebrow="Edward Health" title="Nervous System" />
        <div className="health-tags">
          <StatusPill label={`Producer ${shown.producerStatus}`} tone={shown.producerStatus} />
          <StatusPill label={shown.latestJsonValid ? "Snapshot valid" : "Snapshot not verified"} tone={shown.latestJsonValid ? "live_available" : "validation_error"} />
        </div>
      </div>
      <div className="health-grid">
        <Metric label="Producer Status" value={shown.producerStatus.toUpperCase()} />
        <Metric label="Last Successful Update" value={shown.lastSuccessfulUpdate ? formatTime(shown.lastSuccessfulUpdate) : "Unavailable"} />
        <Metric label="Snapshot Age" value={typeof shown.snapshotAgeSeconds === "number" ? `${Math.round(shown.snapshotAgeSeconds)}s` : "Unknown"} />
        <Metric label="Last Error" value={shown.lastError ?? (degraded ? "health.json unavailable" : "None")} danger={Boolean(shown.lastError || degraded)} />
      </div>
      {shown.validationIssues.length > 0 && (
        <ul className="health-issues">
          {shown.validationIssues.slice(0, 3).map((issue) => <li key={issue}>{issue}</li>)}
        </ul>
      )}
      <div className="source-freshness">
        <h3>Source Freshness</h3>
        <div className="source-grid">
          {sources.map(([name, source]) => (
            <div className="source-item" key={name}>
              <span>{sourceLabel(name)}</span>
              <StatusPill label={source.status} tone={source.status} />
              <small>{source.detail ?? source.provenance ?? "No provenance"}</small>
            </div>
          ))}
          {sources.length === 0 && <p className="pace-copy">Health source details unavailable. Treat producer health as degraded.</p>}
        </div>
      </div>
    </section>
  );
}

function sourceLabel(name: string): string {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase())
    .replace("Phemex", "Phemex")
    .replace("Thorp", "THORP");
}

function TradeManagementPlanPanel({ snapshot }: { snapshot: TradingDeskSnapshot }) {
  const plan = snapshot.tradeManagementPlan;
  if (!plan) return null;
  return (
    <section className="panel trade-management-plan">
      <PanelTitle icon={<ShieldCheck />} eyebrow="Trade Management Plan" title={plan.recommendation.replace(/_/g, " ")} />
      <div className="management-plan-head">
        <div>
          <p className="summary">{plan.summary}</p>
          <p><strong>Why:</strong> {plan.primaryReason.replace(/_/g, " ")}</p>
          <p><strong>Recheck:</strong> {plan.recheckTrigger}</p>
        </div>
        <div className="management-plan-tags">
          <StatusPill label={`${plan.confidence} confidence`} tone={plan.confidence} />
          <StatusPill label={`Exit pressure ${plan.exitPressure}`} tone={plan.exitPressure} />
          <StatusPill label={`Add ${plan.addPermission}`} tone={plan.addPermission} />
        </div>
      </div>
      <div className="management-plan-grid">
        <div className="management-plan-box">
          <h3>Protection Plan</h3>
          <Metric label="Preferred Method" value={plan.protectionPlan.preferredMethod.replace(/_/g, " ")} />
          <Metric label="Protective Stop" value={num(plan.protectionPlan.suggestedProtectiveStop)} danger />
          <Metric label="Warning Level" value={num(plan.protectionPlan.warningLevel)} danger />
          <Metric label="Hard Invalidation" value={num(plan.protectionPlan.hardInvalidation)} danger />
          <p>{plan.protectionPlan.trailReason}</p>
        </div>
        <div className="management-plan-box">
          <h3>Profit / Giveback Math</h3>
          <Metric label="Unrealized Now" value={money(plan.profitMath.unrealizedNow)} trend={plan.profitMath.unrealizedNow} />
          <Metric label="Profit if Close Now" value={money(plan.profitMath.profitIfCloseNow)} trend={plan.profitMath.profitIfCloseNow} />
          <Metric label="Estimated Profit at TP1" value={money(plan.profitMath.estimatedProfitAtTP1)} trend={plan.profitMath.estimatedProfitAtTP1} />
          <Metric label="Additional Profit to TP1" value={money(plan.profitMath.additionalProfitToTP1)} trend={plan.profitMath.additionalProfitToTP1} />
          <Metric label="Giveback to Protective Stop" value={money(plan.profitMath.givebackToProtectiveStop)} danger />
          <Metric label="Loss at Hard Invalidation" value={money(plan.profitMath.lossAtHardInvalidation)} danger />
        </div>
        <div className="management-plan-box">
          <h3>Soft Landing Impact</h3>
          <Metric label="Moon Status" value={plan.softLandingImpact.moonStatus} />
          <Metric label="Sun Status" value={plan.softLandingImpact.sunStatus} />
          <Metric label="Moon Daily Target" value={money(plan.softLandingImpact.moonDailyTargetDollars)} />
          <Metric label="Sun Daily Target" value={money(plan.softLandingImpact.sunDailyTargetDollars)} />
          <Metric label="Close Now → Moon" value={asPct(plan.softLandingImpact.closeNowMoonContributionPct)} />
          <Metric label="TP1 → Moon" value={asPct(plan.softLandingImpact.tp1MoonContributionPct)} />
          <p>{plan.softLandingImpact.summary}</p>
        </div>
      </div>
      <div className="do-not-do-list">
        <h3>Do Not Do</h3>
        <ul>{plan.doNotDo.map((item) => <li key={item}>{item}</li>)}</ul>
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
      <SeparatedStateBar snapshot={snapshot} compact />
      <p className="summary">{verdict.summary}</p>
      <div className="verdict-notes">
        <p><strong>What I would do:</strong> {verdict.whatIWouldDo}</p>
        <p><strong>Add guidance:</strong> {verdict.addGuidance}</p>
        <p><strong>Risk:</strong> {verdict.riskCommentary}</p>
      </div>
    </section>
  );
}

function SeparatedStateBar({ snapshot, compact = false }: { snapshot: TradingDeskSnapshot; compact?: boolean }) {
  const { technicalThesis, managementState } = snapshot.edwardVerdict;
  if (!technicalThesis && !managementState) return null;
  const reasons = [...(technicalThesis?.reasons ?? []), ...(managementState?.reasons ?? [])];
  return (
    <div className={`separated-state-bar ${compact ? "compact" : ""}`}>
      {technicalThesis && (
        <StateBadge label="Technical Thesis" value={`${technicalThesis.state} · ${technicalThesis.confidence}`} tone={technicalThesis.state} />
      )}
      {managementState && (
        <>
          <StateBadge label="Risk State" value={managementState.riskState} tone={managementState.riskState} />
          <StateBadge label="Data Confidence" value={managementState.dataConfidence} tone={managementState.dataConfidence} />
          <StateBadge label="Add Permission" value={managementState.addPermission} tone={managementState.addPermission} />
        </>
      )}
      {reasons.length > 0 && <div className="state-reasons"><span>State Reasons</span><strong>{reasons.join(" / ")}</strong></div>}
    </div>
  );
}

function StateBadge({ label, value, tone }: { label: string; value: string; tone: string }) {
  return <div className={`state-badge ${tone.toLowerCase().replace(/\s+/g, "-")}`}><span>{label}</span><strong>{value}</strong></div>;
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
        <Guardrail label="THORP invalidation" value={num(position?.thorpLevels?.hardInvalidation ?? (position?.stopSource === "hardInvalidation" ? position.stop : undefined))} danger />
        <Guardrail label="Broker stop" value={position?.brokerProtection?.stopLossPresent ? num(position.brokerProtection.stopLossPrice ?? undefined) : "Not found"} danger={!position?.brokerProtection?.stopLossPresent} />
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

export function derivePrimaryScanDisplay(item: WatchlistItem) {
  const hasRich = Boolean(item.latestRichScannerAt);
  const hasHud = Boolean(item.latestHudHeartbeatAt);
  const richFresh = hasRich && item.freshnessStatus === "fresh";
  const hudFresh = hasHud && item.latestLaneType === "hud_context" && item.freshnessStatus === "fresh";
  const hasLegacy = Boolean(item.latestLegacyScannerWakeupAt);
  const scanner = hasRich
    ? `Scanner: ${richFresh ? "rich fresh" : "rich stale"}`
    : hasLegacy || hasHud
      ? "Scanner: rich missing"
      : "Scanner: waiting for natural fire";
  const hud = hasHud ? `HUD: ${hudFresh ? "fresh" : "stale"}` : "HUD: missing";
  const freshness = `Freshness: ${derivePrimaryScanFreshness({ hasRich, hasHud, richFresh, hudFresh })}`;
  return {
    direction: `Direction: ${item.direction ?? "unavailable"}`,
    scanner,
    hud,
    freshness,
    decision: `Decision: ${derivePrimaryScanDecision(item.status)}`,
    decisionTone: derivePrimaryScanDecision(item.status),
    reason: derivePrimaryScanReason(item, { hasRich, hasHud, hasLegacy, richFresh, hudFresh }),
  };
}

function derivePrimaryScanFreshness({ hasRich, hasHud, richFresh, hudFresh }: { hasRich: boolean; hasHud: boolean; richFresh: boolean; hudFresh: boolean }) {
  if (richFresh && hudFresh) return "fresh";
  if (!hasRich && !hasHud) return "missing";
  if (hasRich && hasHud) return "stale";
  return "partial";
}

function derivePrimaryScanDecision(status: WatchlistItem["status"]) {
  if (status === "READY") return "READY";
  if (status === "WATCHLIST" || status === "CONDITIONAL") return "CONDITIONAL";
  if (status === "SKIP") return "NO ACTION";
  return "BLOCKED";
}

function derivePrimaryScanReason(
  item: WatchlistItem,
  evidence: { hasRich: boolean; hasHud: boolean; hasLegacy: boolean; richFresh: boolean; hudFresh: boolean },
) {
  const missing = new Set(item.missingEvidence ?? []);
  if (!evidence.hasRich && !evidence.hasHud && !evidence.hasLegacy) return "Waiting for natural fire";
  if (missing.has("HUD_CONTEXT_MISSING")) return "HUD context missing";
  if (evidence.hasRich && !evidence.richFresh) return "Rich proof stale";
  if (missing.has("RICH_SCANNER_MISSING") || item.duplicateStaleNoActionStatus?.some((status) => status.includes("richScanner:stale") || status.includes("SKIP_STALE"))) {
    return "No fresh rich scanner evidence";
  }
  if (evidence.richFresh && evidence.hudFresh) return "Fresh scanner + HUD evidence available";
  return item.note ?? "No fresh rich scanner evidence";
}

function WatchlistPanel({ snapshot, compact = false, prominent = false }: { snapshot: TradingDeskSnapshot; compact?: boolean; prominent?: boolean }) {
  const summary = snapshot.watchlistSummary;
  const noOpenPosition = !snapshot.activePositionFocus;
  return (
    <section className={`panel watchlist-panel ${prominent || noOpenPosition ? "prominent" : ""} ${compact ? "compact" : ""}`}>
      <PanelTitle icon={<ListChecks />} eyebrow="Active Basket Coverage" title={noOpenPosition ? "Primary Scan" : "Secondary Scan"} />
      <div className="watch-summary">
        <Metric label="Ready" value={summary.ready.toString()} />
        <Metric label="Conditional" value={summary.conditional.toString()} />
        <Metric label="Blocked" value={summary.blocked.toString()} />
        <Metric label="Total" value={summary.total.toString()} />
      </div>
      <p className="summary">{summary.summary}</p>
      <div className="watchlist-items">
        {snapshot.watchlist.map((item) => {
          const display = derivePrimaryScanDisplay(item);
          return (
            <div className="watch-item primary-scan-item" key={item.symbol}>
              <div className="primary-scan-header">
                <strong>{item.symbol}</strong>
                <StatusPill label={display.decision} tone={display.decisionTone} />
              </div>
              <div className="primary-scan-evidence">
                <span>{display.direction}</span>
                <span>{display.scanner}</span>
                <span>{display.hud}</span>
                <span>{display.freshness}</span>
              </div>
              <p><strong>Reason:</strong> {display.reason}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function EdwardBodyProgressPanel() {
  const progress = edwardBodyProgress;
  const nextMilestone = progress.nextMilestones[0] ?? "No next milestone published.";
  const reflex = progress.currentReflexStatus;
  return (
    <section className="panel body-progress-panel" aria-label="Edward Gets a Body completion">
      <div className="body-progress-header">
        <PanelTitle icon={<LockKeyhole />} eyebrow={progress.currentPhase} title={progress.projectName} />
        <div className={`body-execution-lock ${progress.executionAllowed ? "unlocked" : "locked"}`}>
          <span>Guardrail</span>
          <strong>{reflex.guardrailBadge}</strong>
        </div>
      </div>

      <div className="body-progress-summary">
        <Metric label="Current Chapter" value={progress.currentChapter} strong />
        <Metric label="Edward Gets a Body" value={`${progress.estimatedOverallPercent}% Complete`} />
        <Metric label="Next Proof" value={nextMilestone} />
      </div>

      <p className="body-progress-status">{progress.overallStatus}</p>

      <div className="body-status-grid">
        <div className="body-status-list">
          <span>Live</span>
          <ul>
            {progress.liveCapabilities.map((capability) => <li key={capability}>{capability}</li>)}
          </ul>
        </div>
        <div className="body-status-list pending-proof">
          <span>Pending proof</span>
          <ul>
            {progress.pendingProof.map((proof) => <li key={proof}>{proof}</li>)}
          </ul>
        </div>
        <div className="body-reflex-status">
          <span>Current Reflex Status</span>
          <strong>{reflex.summary}</strong>
          <p>{reflex.flatBehavior} {reflex.openTradeProof}</p>
          <small>Monitor active: {reflex.monitorJobId} · {reflex.monitorCadence}</small>
          <small>{reflex.monitorScope}</small>
        </div>
      </div>

      <div className="body-part-grid">
        {Object.entries(progress.bodyParts).map(([part, bodyPart]) => (
          <div className="body-part-card" key={part}>
            <div>
              <strong>{formatBodyPartName(part)}</strong>
              <StatusPill label={bodyPart.status} tone={bodyPart.status} />
            </div>
            <p>{bodyPart.summary}</p>
          </div>
        ))}
      </div>

      <p className="body-lock-reason">{progress.reasonExecutionLocked} {reflex.operatingPrinciple}</p>
    </section>
  );
}

function TradeJournalPanel({ snapshot }: { snapshot: TradingDeskSnapshot }) {
  const journal = buildTradeJournalSummary(snapshot);
  const [journalPage, setJournalPage] = useState(0);
  const journalPageCount = Math.max(1, Math.ceil(journal.tableRows.length / TRADE_JOURNAL_PAGE_SIZE));
  const safeJournalPage = Math.min(journalPage, journalPageCount - 1);
  const journalPageStart = safeJournalPage * TRADE_JOURNAL_PAGE_SIZE;
  const journalDetailRows = journal.tableRows.slice(journalPageStart, journalPageStart + TRADE_JOURNAL_PAGE_SIZE);

  return (
    <section className="panel trade-journal-panel">
      <div className="trade-journal-header">
        <h2>Trade Journal</h2>
        <span className="trade-journal-count">{journal.stats.trades} closed trades</span>
      </div>

      <div className="trade-journal-stats" aria-label="Trade journal summary">
        <JournalStat value={journal.stats.trades} label="TRADES" />
        <JournalStat value={journal.stats.wins} label="WINS" />
        <JournalStat value={journal.stats.losses} label="LOSSES" />
        <JournalStat value={journal.stats.winRate} label="WIN RATE" />
      </div>

      <details className="trade-journal-details">
        <summary className="trade-journal-detail-toggle">
          <span className="trade-journal-badge">See Detail</span>
        </summary>

        <div className="trade-journal-detail-body">
          <div className="trade-journal-pagination" aria-label="Trade journal pagination">
            <button type="button" aria-label="Previous journal page" disabled={safeJournalPage === 0} onClick={() => setJournalPage((page) => Math.max(0, page - 1))}>Previous</button>
            <span>Page {safeJournalPage + 1} of {journalPageCount}</span>
            <button type="button" aria-label="Next journal page" disabled={safeJournalPage >= journalPageCount - 1} onClick={() => setJournalPage((page) => Math.min(journalPageCount - 1, page + 1))}>Next</button>
          </div>

          <div className="trade-journal-mobile-cards" aria-label="Mobile trade journal cards">
            {journalDetailRows.map((row) => (
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
                {journalDetailRows.map((row) => (
                  <tr key={row.tradeId} className={row.tone}>
                    <td>{row.tradeId}</td><td>{row.date}</td><td>{row.symbol}</td><td><span className={`trade-side ${row.side.toLowerCase()}`}>{row.side}</span></td><td>{row.status}</td><td>{row.opened}</td><td>{row.closed}</td><td>{row.entry}</td><td>{row.exit}</td><td>{row.size}</td><td>{row.pnl}</td><td>{row.fees}</td><td>{row.funding}</td><td>{row.framework}</td><td>{row.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

function formatAlertSide(alert?: LatestAlert | null) {
  if (!alert?.side) return "Unavailable";
  if (alert.side === "none") return "None";
  return alert.side.toUpperCase();
}

function isAlertIntakeStale(alertIntake?: AlertIntakeResult) {
  const timestamp = alertIntake?.lastAlertAt ?? alertIntake?.latestAlert?.receivedAt ?? alertIntake?.generatedAt;
  if (!timestamp) return true;
  const timestampMs = new Date(timestamp).getTime();
  return !Number.isFinite(timestampMs) || Date.now() - timestampMs > LIVE_STALE_AFTER_MS;
}

function alertWarningText({
  unavailable,
  stale,
  status,
}: {
  unavailable: boolean;
  stale: boolean;
  status?: LatestAlert["status"];
}) {
  if (unavailable) return "Alert intake is unavailable; no recent alerts are trusted.";
  if (stale) return "Alert intake is stale; do not treat this alert as current.";
  if (status === "context_only") return "Latest alert is context_only and is not a trade signal.";
  if (status === "invalid") return "Latest alert is invalid and was rejected by intake validation.";
  if (status === "duplicate") return "Latest alert is a duplicate; wait for a new valid alert.";
  if (status === "fresh" || status === "accepted") return "Fresh context/setup review required before any action.";
  return "";
}


function isRichThorpScannerAlert(alert?: LatestAlert | null): alert is LatestAlert & { richScannerPayload: ThorpRichScannerPayload; scannerRecommendation: ThorpScannerRecommendation } {
  return Boolean(
    alert?.classification === "thorp_score_ready_rich_scanner_alert" &&
    alert.payloadCompleteness === "rich_scanner" &&
    alert.richScannerPayload &&
    alert.scannerRecommendation,
  );
}

function thorpRecommendationDisplay(recommendation?: ThorpScannerRecommendation) {
  switch (recommendation) {
    case "REVIEW_NOW": return { label: "REVIEW NOW", copy: "Review now. Confirm current price has not moved away from Scout." };
    case "WAIT_FOR_RETEST": return { label: "WAIT FOR RETEST", copy: "Wait for retest. Do not chase." };
    case "SKIP_STALE": return { label: "SKIP — STALE", copy: "Skip. Alert is stale." };
    case "SKIP_STRETCHED": return { label: "SKIP — STRETCHED", copy: "Skip or wait. Move is already extended." };
    case "DUPLICATE_NO_ACTION": return { label: "DUPLICATE — NO NEW ACTION", copy: "Duplicate scanner alert. No new action." };
    case "CONTEXT_INCOMPLETE":
    default:
      return { label: "REVIEW CHART — CONTEXT INCOMPLETE", copy: "Setup alert received, but required context is incomplete. Review chart manually." };
  }
}

function entryTacticDisplay(tactic: string) {
  switch (tactic) {
    case "TAKE_SCOUT": return "TAKE SCOUT";
    case "SCOUT_SMALL_ONLY": return "SCOUT SMALL ONLY";
    case "A1_A2_RETEST_ONLY": return "A1/A2 RETEST ONLY";
    case "A2_SNIPER_ONLY": return "A2 SNIPER ONLY";
    case "WAIT_FOR_RETEST": return "WAIT FOR RETEST";
    case "SKIP_CHASE": return "SKIP CHASE";
    case "NO_ACTION_STALE": return "NO ACTION — STALE";
    default: return tactic.replace(/_/g, " ");
  }
}

function setupRankingFocusDisplay(focus: string) {
  return focus.replace(/_/g, " ");
}

function formatSetupRankingSymbol(symbol: string) {
  return symbol.replace(/USDT\.P$/i, "");
}

function formatNullable(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "Unavailable";
  return typeof value === "number" ? num(value) : value;
}

function numOrUnavailable(value?: number | null) {
  return value === null || value === undefined ? "Unavailable" : num(value);
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

function formatBodyPartName(part: string) {
  return part.replace(/([A-Z])/g, " $1").replace(/^./, (first) => first.toUpperCase());
}

function formatTime(timestamp: string) {
  const parsedTimestamp = /^\d+(?:\.\d+)?$/.test(timestamp) ? Number(timestamp) * 1000 : Date.parse(timestamp);
  if (!Number.isFinite(parsedTimestamp)) return timestamp;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" }).format(new Date(parsedTimestamp));
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
