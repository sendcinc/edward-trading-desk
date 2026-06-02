# Edward Hawk Panel v0.1

The Edward Hawk panel displays the discretionary entry-watch session produced by Edward Hawk v0.1. It is an operator read model for the Trading Desk, not an execution surface.

## Data Source

The panel loads:

```text
/trading-desk/data/hawk-session-latest.json
```

The expected contract is:

```text
edward_hawk_watch_session.v0.1
```

The v0.1 sample artifact lives at:

```text
public/data/hawk-session-latest.json
```

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
