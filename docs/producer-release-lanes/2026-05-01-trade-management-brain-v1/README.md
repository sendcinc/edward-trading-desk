# Producer release lane note — Trade Management Brain v1

Date: 2026-05-01

## Scope

This note tracks the Edward-side producer changes required by the app branch:

- App branch: `feat/trade-management-brain-v1`
- App commit: `521d35c75c741ada972be9c0428be3a5e8eeef98`
- Producer file patched locally: `/Users/sen/.hermes/profiles/edward/workspace/trader/tools/edward_trading_desk_snapshot.py`
- Producer test file patched locally: `/Users/sen/.hermes/profiles/edward/workspace/trader/tests/test_edward_trading_desk_snapshot.py`

The producer workspace is still not a git repo. This producer patch is validated locally but is not release-controlled as source code yet.

## Current patched checksums

```text
db2ecab44c467851f24f71ab42b7e0c2fab41bb2aa4ff04202b2a53a9d4a7047  tools/edward_trading_desk_snapshot.py
6db031bb7f70bc6938366c01c0888cd4aba518b67c58438043bd118667d80ca1  tests/test_edward_trading_desk_snapshot.py
```

## Semantic producer changes

- Added `build_trade_management_plan(...)`.
- Added helper math:
  - `directional_profit(...)`
  - `contribution_pct(...)`
- Added constants for producer validation:
  - `TRADE_MANAGEMENT_RECOMMENDATIONS`
  - `PROTECTION_METHODS`
  - `ADD_PERMISSIONS`
  - `EXIT_PRESSURES`
- Snapshot now includes optional top-level `tradeManagementPlan`.
- Producer validation now validates `tradeManagementPlan` shape when present.
- Existing execution behavior remains unchanged. No order placement. No exchange mutation.

## Behavior rules implemented

- Technical thesis, management risk, and trade-management recommendation remain separated.
- `OVEREXPOSED + no active plan` does not become `THESIS WEAKENING`.
- Green + valid thesis prefers protected hold / trail unless exposure requires reduction.
- Overexposed green valid trade recommends `REDUCE_PARTIAL_AND_TRAIL`.
- Overexposed unknown thesis recommends `REDUCE_PARTIAL` instead of blind full exit.
- Missing stop/hard invalidation makes protection mandatory in the plan summary/reason.
- Add permission is inherited from management state and remains blocked when exposure/plan/data do not permit adding.
- Soft Landing contribution math is emitted when position size/target data supports it.

## Validation commands

```bash
cd /Users/sen/.hermes/profiles/edward/workspace/trader
source /Users/sen/.hermes/hermes-agent/venv/bin/activate
python3 -m pytest tests/test_edward_trading_desk_snapshot.py -q
python3 tools/edward_trading_desk_snapshot.py --summary --output /tmp/edward-trading-desk-brain-v1-inspect.json
```

Expected producer tests:

```text
5 passed
```

## Current BCH-style generated result

From `/tmp/edward-trading-desk-brain-v1-inspect.json` during validation:

```json
{
  "movementClassification": "STALLING",
  "technicalThesis": {
    "state": "UNKNOWN",
    "confidence": "LOW"
  },
  "managementState": {
    "riskState": "OVEREXPOSED",
    "dataConfidence": "LOW",
    "addPermission": "BLOCKED"
  },
  "tradeManagementPlan": {
    "recommendation": "REDUCE_PARTIAL",
    "confidence": "MEDIUM",
    "exitPressure": "HIGH",
    "addPermission": "BLOCKED",
    "technicalThesisState": "UNKNOWN",
    "protectionPlan": {
      "preferredMethod": "HARD_STOP",
      "suggestedProtectiveStop": 453.0,
      "warningLevel": 440.17,
      "hardInvalidation": 453.0
    }
  }
}
```

This result is correct for the currently available inputs: BCH remains not labeled `THESIS WEAKENING`; exposure/data/plan problems drive risk management and add blocking.

## Release-control recommendation

Do not deploy this producer patch from the untracked local workspace.

Safest release lane remains a dedicated private producer/runtime repo, e.g. `sendcinc/edward-producer` or `sendcinc/edward-runtime`, containing only:

```text
tools/edward_trading_desk_snapshot.py
tests/test_edward_trading_desk_snapshot.py
README.md
RELEASE.md
scripts/validate_trading_desk_snapshot.sh
```

Do not import the full Edward `trader` workspace into git.

## Rollback plan if this local patch must be reverted before a controlled release

Use a backup made before applying future production release, or restore from the last approved producer repo/tag once the release lane exists.

Until then, this local patch should be treated as experimental validated work, not production source of truth.
