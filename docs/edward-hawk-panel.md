# Edward Hawk Panel v0.1

The Edward Hawk panel displays the discretionary entry-watch session produced by Edward Hawk v0.1. It is an operator read model for the Trading Desk, not an execution surface.

## Data Source

The panel loads:

```text
/trading-desk/data/hawk-session-latest.json
```

For local runtime smoke, the panel first checks an ignored dev artifact:

```text
/trading-desk/data/hawk/latest-session.json
```

If that local artifact is unavailable, it falls back to the checked-in sample path above.

The expected contract is:

```text
edward_hawk_watch_session.v0.1
```

The v0.1 sample artifact lives at:

```text
public/data/hawk-session-latest.json
```

The local dev runtime artifact path is:

```text
public/data/hawk/latest-session.json
```

That file is ignored by git. It can be loaded from the Edward Hawk runtime publisher review artifact with:

```bash
npm run hawk:load-local -- \
  --source /tmp/edward-hawk-review/latest-session.json \
  --output public/data/hawk/latest-session.json
```

The helper refuses missing sources, requires the Hawk v0.1 contract, requires disabled execution flags, and refuses stale/unavailable artifacts that still carry an advisory ticket.

If the artifact is missing, stale, malformed, or unavailable, the panel shows `HAWK DATA UNAVAILABLE` and `Hawk data stale/unavailable. No action.`

## What The Panel Shows

- Top decision state and required action wording.
- Symbol, direction, timeframe, playbook, support zone, reclaim level, review zone, hard failure, and chase cutoff.
- Next required condition.
- Timeline/story events in order.
- Advisory ticket details when Hawk produces one.
- Safety flags from the Hawk artifact.

## Safety

Edward Hawk v0.1 is advisory only:

- No broker mutation.
- No exchange write access.
- No order placement.
- No execution controls.
- No Pine indicator changes.
- No deployment behavior.
- `approval_required: true`
- `execution_enabled: false`
- `auto_execution: false`
- `execution_intent: none`

The panel intentionally has no confirm, send, place, or execute trade button.

## Local Smoke

1. Publish or provide a local Hawk artifact at `/tmp/edward-hawk-review/latest-session.json`.
2. Copy it into the ignored dev path with `npm run hawk:load-local -- --source /tmp/edward-hawk-review/latest-session.json`.
3. Run `npm run dev`.
4. Open `http://localhost:5173/trading-desk/#hawk`.
5. Confirm the Hawk panel displays the local artifact, keeps advisory tickets disabled/manual-only, and renders stale/unavailable data as no action.

This local flow does not deploy and does not write to production paths.
