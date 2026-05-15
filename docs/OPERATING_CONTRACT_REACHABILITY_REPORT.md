# Operating Contract Reachability Report

## Verdict

The new Hermes Operating Contract docs exist in this repository, but they are **not globally reachable by normal Hermes/Neo/Edward/Richard/Doc Brown sessions** from this repo alone.

This repository does not currently contain a safe existing profile instruction file (`AGENTS.md`, `.hermes.md`, `HERMES.md`, `CLAUDE.md`, `.cursorrules`, or profile `SOUL.md`) that can reference the new docs for all relevant profiles. Adding a new repo-local instruction file would only affect sessions whose working directory is this repository; it would not make the contract reachable by Hermes, Edward, Richard, or Doc Brown in their normal profile lanes.

Because the requested integration is instruction-layer only and must not fake reachability, no runtime/config/provider/trading/deploy/automation files were changed.

## Current docs

Created on this branch:

- `docs/CORE_OPERATOR_CONTRACT.md`
- `docs/HERMES_SOUL.md`
- `docs/NEO_SOUL.md`
- `docs/EDWARD_SOUL.md`
- `docs/RICHARD_SOUL.md`
- `docs/DOC_BROWN_SOUL.md`
- `docs/MISSION_MAP_TEMPLATE.md`

## Hermes instruction-loading path found

Source inspection of Hermes Agent shows this loading order for the system prompt:

1. Profile identity from `SOUL.md` under `HERMES_HOME`.
2. User/gateway system prompt, if provided.
3. Persistent memory/user profile.
4. Skills guidance when skills tools are enabled.
5. Project context files discovered from the active working directory.
6. Current timestamp and platform formatting hints.

Relevant source evidence:

- `/Users/sen/.hermes/hermes-agent/run_agent.py`
  - `AIAgent._build_system_prompt()` documents the system-prompt layers.
  - It calls `load_soul_md()` and `build_context_files_prompt()`.
- `/Users/sen/.hermes/hermes-agent/agent/prompt_builder.py`
  - `load_soul_md()` loads `get_hermes_home() / "SOUL.md"`.
  - `build_context_files_prompt()` loads only one project context source by priority:
    1. `.hermes.md` / `HERMES.md` by walking to git root.
    2. `AGENTS.md` / `agents.md` from current working directory only.
    3. `CLAUDE.md` / `claude.md` from current working directory only.
    4. `.cursorrules` / `.cursor/rules/*.mdc` from current working directory only.

## Existing profile instruction surfaces found

Profile-level `SOUL.md` files:

- Hermes: `/Users/sen/.hermes/SOUL.md`
- Neo: `/Users/sen/.hermes/profiles/neo/SOUL.md`
- Edward: `/Users/sen/.hermes/profiles/edward/SOUL.md`
- Richard: `/Users/sen/.hermes/profiles/richard/SOUL.md`
- Doc Brown: `/Users/sen/.hermes/profiles/doc-brown/SOUL.md`

Workspace `AGENTS.md` files currently used as project/workspace context:

- Neo workspace: `/Users/sen/.hermes/profiles/neo/workspace/AGENTS.md`
- Edward workspace: `/Users/sen/.hermes/profiles/edward/workspace/AGENTS.md`
- Richard workspace: `/Users/sen/.hermes/profiles/richard/workspace/AGENTS.md`
- Doc Brown workspace: `/Users/sen/.hermes/profiles/doc-brown/workspace/AGENTS.md`

These files live outside this repository, so updating them would not be represented by this branch/PR.

## Repository-local reachability check

This repository currently has no instruction file at the repo root:

- No `AGENTS.md`
- No `.hermes.md`
- No `HERMES.md`
- No `CLAUDE.md`
- No `.cursorrules`

Normal Hermes project-context discovery therefore will not automatically load the new `docs/*_SOUL.md` files from this repo. Markdown files under `docs/` are only reachable if an already-loaded instruction file points to them or a user/agent explicitly reads them.

The currently loaded Neo project context for work in this path comes from the parent workspace instruction file:

- `/Users/sen/.hermes/profiles/neo/workspace/AGENTS.md`

That parent file does not reference these new docs.

## Why this repo is not the correct global integration location

The repo is `sendcinc/edward-trading-desk`, an Edward Trading Desk application repo. The new contract is cross-profile doctrine for Hermes, Neo, Edward, Richard, and Doc Brown.

Keeping the canonical cross-profile contract only inside an Edward Trading Desk repo creates the wrong ownership boundary:

- Hermes and non-trading profiles would depend on an app repo they do not normally load.
- Richard and Doc Brown sessions would not naturally inspect this repo.
- Adding repo-local context would only help sessions launched inside this repo, not normal Telegram/profile operation.
- It risks turning a trading desk app repo into a global agent-governance source of truth.

## Smallest safe next integration target outside this repo

Use a profile-owned shared docs location outside this app repo, then add short references from existing profile instruction files.

Recommended canonical location:

- `/Users/sen/.hermes/operator-contract/CORE_OPERATOR_CONTRACT.md`
- `/Users/sen/.hermes/operator-contract/HERMES_SOUL.md`
- `/Users/sen/.hermes/operator-contract/NEO_SOUL.md`
- `/Users/sen/.hermes/operator-contract/EDWARD_SOUL.md`
- `/Users/sen/.hermes/operator-contract/RICHARD_SOUL.md`
- `/Users/sen/.hermes/operator-contract/DOC_BROWN_SOUL.md`
- `/Users/sen/.hermes/operator-contract/MISSION_MAP_TEMPLATE.md`

Then patch only the existing profile instruction surfaces with short pointers:

- `/Users/sen/.hermes/SOUL.md`
  - Reference `CORE_OPERATOR_CONTRACT.md` and `HERMES_SOUL.md`.
- `/Users/sen/.hermes/profiles/neo/SOUL.md`
  - Reference `CORE_OPERATOR_CONTRACT.md` and `NEO_SOUL.md`.
- `/Users/sen/.hermes/profiles/edward/SOUL.md`
  - Reference `CORE_OPERATOR_CONTRACT.md` and `EDWARD_SOUL.md`.
- `/Users/sen/.hermes/profiles/richard/SOUL.md`
  - Reference `CORE_OPERATOR_CONTRACT.md` and `RICHARD_SOUL.md`.
- `/Users/sen/.hermes/profiles/doc-brown/SOUL.md`
  - Reference `CORE_OPERATOR_CONTRACT.md` and `DOC_BROWN_SOUL.md`.

Optionally, workspace `AGENTS.md` files can add one short line pointing to the same profile-specific docs, but profile `SOUL.md` is the cleaner first integration point because Hermes loads it as the profile identity for normal sessions.

## Mission map handling

`MISSION_MAP_TEMPLATE.md` should be referenced as a template only. It should not be treated as current mission truth unless a populated mission map is explicitly created and maintained.

## Proposed reference wording

For each profile `SOUL.md`, add a short section like:

```md
## Operating contract references

For Edwin's agent-system operating contract, use:
- Core: `/Users/sen/.hermes/operator-contract/CORE_OPERATOR_CONTRACT.md`
- Profile: `/Users/sen/.hermes/operator-contract/<PROFILE>_SOUL.md`
- Mission map template only, not current truth: `/Users/sen/.hermes/operator-contract/MISSION_MAP_TEMPLATE.md`

These references are instruction-layer guidance only and do not change runtime behavior or loosen existing safety gates. If there is a conflict, follow the stricter safety rule.
```

## Do not change without explicit approval

The integration should not touch:

- Provider config.
- Credentials, secrets, auth, or token stores.
- LaunchAgents.
- Broker tools, trading execution, order paths, Pine, TradingView, or webhook behavior.
- Telegram/gateway behavior.
- Production deploy scripts.
- Live automation or schedulers.
