import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateHawkSession } from "./hawkSession";

const currentDir = dirname(fileURLToPath(import.meta.url));
const sample = JSON.parse(readFileSync(join(currentDir, "..", "..", "public", "data", "hawk-session-latest.json"), "utf8"));

describe("Edward Hawk session contract", () => {
  it("accepts the v0.1 sample artifact and preserves disabled execution flags", () => {
    const validation = validateHawkSession(sample);

    expect(validation.ok).toBe(true);
    if (!validation.ok) return;
    expect(validation.session.current_state).toBe("VALID_ENTRY_REVIEW");
    expect(validation.session.read_only).toBe(true);
    expect(validation.session.manual_only).toBe(true);
    expect(validation.session.creates_trade_permission).toBe(false);
    expect(validation.session.entry_permission).toBe(false);
    expect(validation.session.auto_execution).toBe(false);
    expect(validation.session.execution_intent).toBe("none");
    expect(validation.session.latest_decision?.order_ticket_suggestion?.approval_required).toBe(true);
    expect(validation.session.latest_decision?.order_ticket_suggestion?.execution_enabled).toBe(false);
  });

  it("rejects malformed or execution-enabled Hawk artifacts", () => {
    const validation = validateHawkSession({
      ...sample,
      auto_execution: true,
      latest_decision: {
        ...sample.latest_decision,
        order_ticket_suggestion: {
          ...sample.latest_decision.order_ticket_suggestion,
          execution_enabled: true,
        },
      },
    });

    expect(validation.ok).toBe(false);
    if (validation.ok) return;
    expect(validation.issues.join(" ")).toContain("auto_execution");
    expect(validation.issues.join(" ")).toContain("execution_enabled");
  });
});
