# Producer release lane proposal — separate thesis/risk state

Date: 2026-05-01

## Scope

This bundle controls the Edward-side producer patch required by app PR #5:

- App PR: https://github.com/sendcinc/edward-trading-desk/pull/5
- App branch: `fix/separate-thesis-risk-state`
- App commit: `64c21b82beca9f715ea3edbab0be0865b1b32012`

Producer file currently patched locally:

```text
/Users/sen/.hermes/profiles/edward/workspace/trader/tools/edward_trading_desk_snapshot.py
```

Producer test currently patched locally:

```text
/Users/sen/.hermes/profiles/edward/workspace/trader/tests/test_edward_trading_desk_snapshot.py
```

## Release-control finding

`/Users/sen/.hermes/profiles/edward/workspace/trader` is not a git repository, and neither are its parent directories. That makes direct production release from that workspace unsafe: it has no normal PR, merge, tag, rollback, or branch discipline.

Nearby evidence:

- `/Users/sen/.hermes/profiles/edward/workspace/trader`: not git-backed
- `/Users/sen/.hermes/profiles/edward/workspace/thorp`: not git-backed
- `/Users/sen/.hermes/profiles/edward/workspace/trading-desk-snapshot`: output-only directory; not a code repo
- `/Users/sen/.hermes/profiles/neo/workspace/edward-trading-desk`: git-backed app repo

## Recommendation

Safest long-term option: **C) create a dedicated `edward-producer` / `edward-runtime` repository** and move the snapshot producer there with tests, wrapper documentation, and release tags.

Why not A:

- Converting the whole `trader` workspace into git would sweep in a large operational workspace with logs, state, memories, archives, and runtime artifacts. That is too easy to commit noise or sensitive data from.

Why not B alone:

- Copying this one file into the UI app repo creates a boundary problem. The UI repo should own the public contract and rendering; the producer repo should own private Edward/Phemex/HUD integration.

Why C:

- Small repo, clear ownership, private runtime boundary.
- Can version producer code, tests, wrappers, and release notes without dragging in Edward workspace state.
- Enables PR review before producer deployment.
- Enables tagged rollback to the last known-good producer.

Temporary option D is represented by this tracked bundle. It is **not** a permanent fix.

## Temporary tracked patch bundle

Backup path created before release-lane report:

```text
/Users/sen/.hermes/profiles/edward/backups/trading-desk-producer/20260501T135047Z
```

Current patched file checksums:

```text
2543c1ae25e0a3d61612aebba2cf90b28cc42a131d4cf0431632706b68793dc5  tools/edward_trading_desk_snapshot.py
a67ed2aad90be429fe8acb5a3d639cfe10e60006d15dc0d97c07c8dc47b74cb3  tests/test_edward_trading_desk_snapshot.py
```

Backed-up copies:

```text
/Users/sen/.hermes/profiles/edward/backups/trading-desk-producer/20260501T135047Z/tools/edward_trading_desk_snapshot.py
/Users/sen/.hermes/profiles/edward/backups/trading-desk-producer/20260501T135047Z/tests/test_edward_trading_desk_snapshot.py
/Users/sen/.hermes/profiles/edward/backups/trading-desk-producer/20260501T135047Z/SHA256SUMS
```

## Before / after semantic diff

The exact bug was this producer branch:

```diff
 elif exposure in {"OVEREXPOSED", "CRITICAL"} and not has_plan:
     action = "REDUCE"
-    movement = "THESIS WEAKENING"
-    summary = f"{symbol} {direction} is live, overexposed, and has no matching active THORP plan. This is management-only risk, not a fresh setup."
+    movement = "STALLING"
+    summary = f"{symbol} {direction} is live, overexposed, and has no matching active THORP plan. This is management-only risk, not proof of technical thesis weakening."
     what = "Reduce exposure or hold only with a manual protective plan; do not add."
     confidence = "LOW"
```

Additional producer changes:

```diff
+def hud_number(structure_read, section, key):
+    # Reads HUD risk/target numeric levels from 15m, 1H, then 4H context.
+
+def derive_technical_thesis(structure_read):
+    # Emits VALID / WEAKENING / FAILED / UNKNOWN from fresh HUD technical evidence.
+
+def build_management_state(exposure, plan, review, technical_thesis):
+    # Emits riskState, dataConfidence, addPermission, and management reasons.
```

```diff
-warning_level = safe_level(levels.get("Warning Stop"))
-hard_invalidation = safe_level(levels.get("Hard Stop")) or safe_level(review_pos.get("sl"))
-tp1 = safe_level(levels.get("T1")) or safe_level(review_pos.get("tp"))
+warning_level = safe_level(levels.get("Warning Stop")) or hud_number(structure_read, "risk", "warning")
+hard_invalidation = safe_level(levels.get("Hard Stop")) or safe_level(review_pos.get("sl")) or hud_number(structure_read, "risk", "hardInvalidation")
+tp1 = safe_level(levels.get("T1")) or safe_level(review_pos.get("tp")) or hud_number(structure_read, "targets", "tp1")
```

```diff
+"technicalThesis": {
+  "state": "VALID | WEAKENING | FAILED | UNKNOWN",
+  "confidence": "HIGH | MEDIUM | LOW",
+  "reasons": []
+}
+
+"managementState": {
+  "riskState": "SAFE | ELEVATED | OVEREXPOSED | CRITICAL",
+  "dataConfidence": "HIGH | MEDIUM | LOW",
+  "addPermission": "ALLOWED | RETEST_ONLY | BLOCKED | UNKNOWN",
+  "reasons": []
+}
```

Producer validation was also extended to reject malformed optional `technicalThesis` and `managementState` objects.

## Validation commands

Producer:

```bash
cd /Users/sen/.hermes/profiles/edward/workspace/trader
python3 -m pytest tests/test_edward_trading_desk_snapshot.py -q
python3 tools/edward_trading_desk_snapshot.py --summary --output /tmp/edward-trading-desk-patched-inspect.json
```

App:

```bash
cd /Users/sen/.hermes/profiles/neo/workspace/edward-trading-desk
npm run typecheck
npm run lint
npm test
npm run build
```

## Deployment plan after Edwin approval

1. Create/choose the producer repo/lane.
2. Add producer file, tests, wrapper docs, and this contract dependency to that repo.
3. Open producer PR and run producer tests there.
4. Confirm app PR #5 head SHA and mergeability.
5. Merge only the approved app PR and approved producer PR/commit.
6. Back up production Trading Desk static route and producer file before release.
7. Deploy producer patch through controlled lane.
8. Generate `latest.json` using the controlled producer.
9. Deploy app static build only after producer output is controlled.
10. Smoke-test live route and live snapshot fields.

## Rollback plan

Producer rollback:

```bash
cp /Users/sen/.hermes/profiles/edward/backups/trading-desk-producer/20260501T135047Z/tools/edward_trading_desk_snapshot.py \
  /Users/sen/.hermes/profiles/edward/workspace/trader/tools/edward_trading_desk_snapshot.py
```

If test file rollback is needed:

```bash
cp /Users/sen/.hermes/profiles/edward/backups/trading-desk-producer/20260501T135047Z/tests/test_edward_trading_desk_snapshot.py \
  /Users/sen/.hermes/profiles/edward/workspace/trader/tests/test_edward_trading_desk_snapshot.py
```

Then rerun producer validation.

App rollback:

- Do not merge app PR #5 until producer lane is controlled.
- If merged later and rollback is needed, revert PR #5 in git and redeploy the previous known-good static build backup.

## Live validation plan

After producer lane is controlled and Edwin approves release:

1. Generate fresh producer snapshot.
2. Confirm `latest.json` includes:
   - `edwardVerdict.technicalThesis`
   - `edwardVerdict.managementState`
3. For BCH-style live state, verify:
   - Technical Thesis is `VALID` or `UNKNOWN`, not `WEAKENING`, unless HUD/structure proves weakening.
   - Risk State is `OVEREXPOSED` or `CRITICAL` when account risk warrants it.
   - Data Confidence is `LOW` or `MEDIUM` when plan/review linkage is incomplete.
   - Add Permission is `BLOCKED` when overexposed or missing active plan.
   - Movement Classification is not `THESIS WEAKENING` unless technical evidence supports it.
   - Stop/TP1 populate from HUD fallback when review levels are missing.
4. Validate generated snapshot against the app Zod schema.
5. Smoke the live Trading Desk UI and verify separated state renders in the Trade Decision card.
6. Confirm no trading execution behavior changed.
