#!/usr/bin/env node

import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DEFAULT_SOURCE = "/tmp/edward-hawk-review/latest-session.json";
const DEFAULT_DESTINATION = "public/data/hawk/latest-session.json";
const STALE_TOKENS = ["STALE", "UNAVAILABLE", "MISSING"];

function parseArgs(argv) {
  const args = {
    source: DEFAULT_SOURCE,
    output: DEFAULT_DESTINATION,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--source") {
      args.source = argv[index + 1];
      index += 1;
    } else if (arg === "--output") {
      args.output = argv[index + 1];
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function mustBe(value, expected, path) {
  if (value !== expected) throw new Error(`${path} must be ${String(expected)}`);
}

function staleConfidence(value) {
  const text = String(value ?? "").toUpperCase();
  return STALE_TOKENS.some((token) => text.includes(token));
}

function validateHawkArtifact(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("artifact must be a JSON object");
  mustBe(raw.contract, "edward_hawk_watch_session.v0.1", "contract");
  mustBe(raw.read_only, true, "read_only");
  mustBe(raw.manual_only, true, "manual_only");
  mustBe(raw.creates_trade_permission, false, "creates_trade_permission");
  mustBe(raw.entry_permission, false, "entry_permission");
  mustBe(raw.auto_execution, false, "auto_execution");
  mustBe(raw.execution_intent, "none", "execution_intent");
  if (typeof raw.symbol !== "string" || !raw.symbol) throw new Error("symbol must be present");
  if (typeof raw.current_state !== "string" || !raw.current_state) throw new Error("current_state must be present");

  const decision = raw.latest_decision;
  const ticket = decision && typeof decision === "object" ? decision.order_ticket_suggestion : null;
  if (ticket) {
    mustBe(ticket.approval_required, true, "latest_decision.order_ticket_suggestion.approval_required");
    mustBe(ticket.execution_enabled, false, "latest_decision.order_ticket_suggestion.execution_enabled");
  }

  const stale = raw.current_state === "STALE_NO_ACTION" || staleConfidence(decision?.data_confidence);
  if (stale && (raw.current_state !== "STALE_NO_ACTION" || ticket)) {
    throw new Error("stale/unavailable Hawk artifact must already be STALE_NO_ACTION with no advisory ticket");
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const source = resolve(args.source);
  const output = resolve(args.output);
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(source, "utf8"));
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    throw new Error(`Cannot read source Hawk artifact at ${source}: ${reason}`);
  }
  validateHawkArtifact(parsed);
  mkdirSync(dirname(output), { recursive: true });
  copyFileSync(source, output);
  console.log(`Copied Hawk artifact to ${output}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
