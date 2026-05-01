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
