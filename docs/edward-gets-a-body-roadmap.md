# Edward Gets a Body Roadmap

## Mission

Give Edward a progressively richer body around the Trading Desk without changing execution authority. The body is a state, planning, perception, memory, and guarded-assistance layer that helps Edwin understand what Edward can see, remember, and safely do.

## North Star

Edward can explain the current trade state, his own capability state, and the next safe action clearly. He can observe markets and context, maintain memory, prepare orders, and eventually execute only behind explicit guardrails and Edwin-controlled authorization.

## Phase map

### Phase 0 Foundation

Define the roadmap, static progress state, capability locks, and safety rules. Keep all body progress informational and below the decision-first trading cockpit.

### Phase 1 Cockpit

Make the Trading Desk a reliable command surface for open-position management, risk, portfolio state, soft landing pace, watchlist context, and journal review.

### Phase 1.1 Cockpit hardening

Protect the snapshot contract with strict validation, stale/unavailable fallbacks, and tests for ordering and safety behavior.


### Phase 2.0 Nervous System Health v1

Status: **Complete / live**.

What changed:
- `health.json` is live beside `latest.json`.
- Producer status, source freshness, snapshot validity, and audit JSONL are visible.
- Missing/stale sources are surfaced as nervous-system issues instead of fake thesis failure.
- Execution remains locked.

Next: **Phase 2.1 Alert Intake / Alert Nerves** — build TradingView webhook alert intake as a first-class event stream.

### Phase 1.2 Trade Management Brain v1

Status: complete and live. Edward now emits and renders advisory trade-management reasoning: `tradeManagementPlan`, protection plan, add permission, exit pressure, profit/giveback math, Soft Landing impact, and do-not-do list. Execution remains locked.

### Phase 2 Live State Engine / Nervous System

Build a live state engine that can ingest validated Edward snapshots, normalize state, report freshness, and keep the cockpit aware of system health without weakening fallback behavior.

### Phase 2.2 Entry Tactics Brain v1

Status: source-control complete; deployment remains gated until runtime publisher validation is clean and Edwin approves promotion.

Goal: turn each fresh rich scanner alert plus HUD/price context into one read-only entry tactic for that symbol. Edward should say whether to take scout, wait for A1/A2 retest, use A2 sniper only, skip chase, or no-action stale.

Output: optional `entryTactics` on alert objects, with `contractVersion: entry-tactics-brain.v1`, `entryTactic`, `positionSplit`, `nextActionSentence`, `riskReason`, `autoExecution: false`, and `executionIntent: none`.

Placement: render the advisory line near Scanner Recommendation. No buttons, no order links, no execution affordances.

Guardrails:
- No order placement.
- No exchange mutation.
- No TradingView/Pine/alert changes.
- No webhook/auth/token changes.
- No `active_trades.json` mutation.
- Execution remains locked: `autoExecution=false`, `executionIntent=none`.

### Phase 2.3 Setup Ranking Brain v1

Status: planned after Entry Tactics Brain v1.

Problem: Edward currently evaluates each scanner alert mostly in isolation. Edwin needs Edward to compare a fresh alert against other current setups in the active basket so he can choose the cleanest opportunity instead of reacting to whichever alert fired last.

Goal: when a fresh rich scanner alert lands, rank current setup candidates across the active basket and surface which setup is most worth attention.

Inputs:
- latest rich scanner alerts from `latest-alert.json` / `recentAlerts`
- `latestBySymbol`
- `activeBasketCoverage`
- Entry Tactics Brain output per symbol
- HUD context for `15m`, `1H`, and `4H` where available
- live/mark price when available
- alert price, Scout, A1, A2, warning/hard invalidation, T1/T2/T3
- alert age/freshness, direction, score, trigger, action, battlefield
- existing open position state, if any

Runtime output:
- `setupRanking`: ranked candidates.
- `bestSetup`: highest ranked setup, or `null` if none qualifies.
- `rankingSummary`: one plain-English sentence.

Candidate contract:
- `rank`
- `symbol`
- `direction`
- `setupGrade`: `A`, `B`, `C`, or `SKIP`
- `recommendedFocus`: `PRIMARY`, `SECONDARY`, `WATCH_ONLY`, or `SKIP`
- `entryTactic`
- `positionSplit`
- `freshnessStatus`
- `mtfAlignment`
- `rrQuality`
- `chaseRisk`
- `riskReason`
- `nextActionSentence`
- `autoExecution: false`
- `executionIntent: none`

Ranking rules:
- Fresh rich scanner evidence beats stale evidence.
- Multi-timeframe alignment beats isolated 15m strength.
- Entry tactic quality matters: A1/A2 retest with strong RR can outrank scout chase; A2 sniper can outrank market/scout when RR is materially better.
- If 4H says `WAIT`, downgrade full-entry confidence.
- If 1H says `IGNORE`, `LATE`, or `NO FRESH ENTRY`, downgrade heavily.
- If price has already moved too close to T1, downgrade as chase risk.
- If live price is unavailable, the candidate cannot become `PRIMARY`.
- If an active position exists, ranking must not encourage a new trade unless explicit exposure rules allow it.
- If all candidates are weak, output wait/no-trade.

Example BNB/BCH/LINK ranking:

```json
{
  "setupRanking": [
    {
      "rank": 1,
      "symbol": "BNBUSDT.P",
      "direction": "SHORT",
      "setupGrade": "B",
      "recommendedFocus": "PRIMARY",
      "entryTactic": "A1_A2_RETEST_ONLY",
      "positionSplit": "0/40/60",
      "freshnessStatus": "fresh",
      "mtfAlignment": "15m and 1H align; 4H waits",
      "rrQuality": "better_on_retest",
      "chaseRisk": "avoid_chase",
      "riskReason": "15m and 1H align; 4H waits. Retest entries improve RR.",
      "nextActionSentence": "Wait for BNB A1/A2 retest. Do not chase.",
      "autoExecution": false,
      "executionIntent": "none"
    },
    {
      "rank": 2,
      "symbol": "BCHUSDT.P",
      "direction": "LONG",
      "setupGrade": "C",
      "recommendedFocus": "WATCH_ONLY",
      "entryTactic": "WAIT_FOR_RETEST",
      "positionSplit": "0/0/0",
      "freshnessStatus": "fresh",
      "mtfAlignment": "15m strong; 1H waits; 4H ignores",
      "rrQuality": "tactical_only",
      "chaseRisk": "moderate",
      "riskReason": "Strong 15m, but higher timeframes do not confirm.",
      "nextActionSentence": "Watch BCH only; require fresh 1H/4H proof before focus.",
      "autoExecution": false,
      "executionIntent": "none"
    },
    {
      "rank": 3,
      "symbol": "LINKUSDT.P",
      "direction": "SHORT",
      "setupGrade": "C",
      "recommendedFocus": "WATCH_ONLY",
      "entryTactic": "A1_A2_RETEST_ONLY",
      "positionSplit": "0/40/60",
      "freshnessStatus": "fresh",
      "mtfAlignment": "15m only; 1H late/no fresh entry; 4H waits",
      "rrQuality": "retest_only",
      "chaseRisk": "high_if_chasing",
      "riskReason": "15m is strong, but 1H is late/no fresh entry and 4H waits.",
      "nextActionSentence": "Do not chase LINK; only reconsider on clean retest and fresh higher-timeframe proof.",
      "autoExecution": false,
      "executionIntent": "none"
    }
  ],
  "bestSetup": {
    "symbol": "BNBUSDT.P",
    "direction": "SHORT",
    "recommendedFocus": "PRIMARY"
  },
  "rankingSummary": "BNB short is cleaner than BCH long and LINK short because 15m and 1H align while BCH and LINK are mostly 15m-only."
}
```

UI placement:

```text
SETUP RANKING
1. BNB SHORT — PRIMARY — A1/A2 retest only
2. BCH LONG — WATCH ONLY — 15m-only
3. LINK SHORT — LOWER QUALITY — 1H late

BEST ACTION
Wait for BNB A1/A2 retest. Do not chase BCH/LINK.
```

Validation requirements:
- Unit test BNB outranks BCH/LINK due to 15m+1H alignment.
- Unit test 15m-only READY loses to lower-score MTF-aligned setup.
- Unit test stale setup downgrades.
- Unit test chase-risk setup downgrades.
- Unit test no valid candidates returns wait/no-trade.
- Unit test active open position blocks `PRIMARY` unless explicitly allowed by exposure rules.
- Existing runtime tests pass.
- Existing UI tests pass if UI renders the panel.
- Snapshot validation passes if runtime producer changes.

Guardrails:
- Read-only advisory only.
- No order placement.
- No exchange mutation.
- No execution affordances.
- No TradingView/Pine/alert changes.
- No webhook/auth/token changes.
- No deploy without Edwin approval.
- Preserve `autoExecution=false` and `executionIntent=none`.

### Phase 3 Watcher Body

Add durable market watching behavior that tracks active positions and watchlist conditions while keeping position management above opportunity scanning.

### Phase 4 Chart Eyes

Add chart-reading capability for market structure, levels, trend, invalidation, and execution context. Chart eyes inform decisions but do not place orders.

### Phase 5 News/X/Internet Ears

Add external context ingestion for news, X, and internet sources with source quality, recency, and relevance controls.

### Phase 6 Journal/Memory Loop

Turn the trade journal into a memory loop that captures decisions, outcomes, mistakes, lessons, and recurring behavior patterns.

### Phase 7 Semi-autonomous Order Assistant

Allow Edward to prepare order drafts, risk checks, and execution plans for Edwin review. Edward may suggest and stage; Edwin remains the approving authority.

### Phase 8 Guarded Execution

Enable tightly guarded execution only after explicit capability unlocks, audit trails, risk gates, dry-run verification, and Edwin authorization. Execution remains locked until every guardrail is proven.

## Current status

Edward has completed Phase 2.0 Nervous System Health v1 and is entering Phase 2.1 Alert Intake / Alert Nerves. The Trading Desk can render validated snapshots, reject invalid contracts, degrade to stale/unavailable safe states, keep Trade Decision as the first meaningful cockpit section, show advisory trade-management reasoning through `tradeManagementPlan`, and surface producer/source health through `health.json`.

## Completed milestones

- Standalone Edward Trading Desk app exists.
- Snapshot contract is documented.
- Runtime Zod validation protects the desk.
- Demo, stale, unavailable, and validation-error paths exist.
- Decision-first cockpit ordering is tested.
- Trade journal summary and full-field table are present.
- Body-progress roadmap and static state layer are introduced.
- Body-progress panel placement and locked-execution state are covered by targeted tests.
- Nervous System Health v1 live with health.json, source freshness, producer status, and audit log.

## Next sprint

- Build TradingView webhook alert intake as first-class event stream.
- Route latest alert state into health/provenance and the Trading Desk without changing execution behavior.
- Document capability unlock criteria for eyes, ears, memory, hands, conscience, and guarded execution.

## Locked capabilities

- Direct order placement.
- Autonomous position sizing.
- Autonomous leverage changes.
- Stop movement without Edwin confirmation.
- Exchange account mutation.
- External source ingestion without recency and reliability controls.
- Memory-driven trade decisions without current validated snapshot context.

## Non-negotiable safety rules

- Edwin is the final command authority.
- Trade Decision remains the first meaningful cockpit section.
- Body-progress UI is informational and lower priority.
- Zod validation must not be weakened.
- Stale, unavailable, and validation-error fallbacks must remain conservative.
- Snapshot contracts must remain explicit and tested.
- No execution behavior changes ship through body-progress work.
- Execution stays locked until guarded execution is intentionally implemented and validated.

## Expected answer wording for "Edward, how far until you get a body?"

"I have the cockpit foundation, Trade Management Brain v1, and Nervous System Health v1 live now. I am entering Phase 2.1: Alert Intake / Alert Nerves. My body is about 31% complete overall. I can provide advisory trade-management reasoning and surface producer/source health through health.json, source freshness, producer status, and audit logs. I still cannot execute trades. Execution remains locked. Next I need TradingView webhook alerts as a first-class event stream so alerts can be captured, normalized, deduped, checked for freshness, and routed into Edward review without becoming execution commands."
