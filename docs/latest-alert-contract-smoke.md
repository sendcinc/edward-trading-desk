# Latest-alert contract smoke

Before promoting Trading Desk UI/runtime artifacts, validate the UI adapter against both curated regression fixtures and a freshly generated runtime artifact.

## Curated regression smoke

```bash
npm run test:contract-smoke
```

This covers:

- `src/data/__fixtures__/latest-alert-fresh-review-blocked.json`
- `src/data/__fixtures__/latest-alert-fresh-review-history-timeframes.json`

The history-timeframes fixture is generated from runtime `latest-alert.json` shape and covers `freshAlertReviewHistory.recent[].timeframes.{15m,1H,4H}` rows.

## Fresh runtime artifact smoke

From a clean runtime checkout, generate `latest-alert.json` into a temporary directory without promoting live files. Then point the UI smoke at that directory:

```bash
# Example: replace this with the normal local runtime snapshot generation command.
TMPDIR="$(mktemp -d /tmp/edward-contract-smoke.XXXXXX)"
# Runtime command should write: "$TMPDIR/latest-alert.json"

EDWARD_CONTRACT_SMOKE_DIR="$TMPDIR" npm run test:contract-smoke
```

Promotion is blocked if the UI adapter cannot parse the freshly generated `latest-alert.json`.

Guardrails for this smoke:

- no deploy or runtime promotion
- no TradingView alert create/edit/delete
- no Pine edit/save/publish
- no webhook/auth/token changes
- no broker/exchange/order mutation
- `autoExecution` remains `false`
- `executionIntent` remains `none`
