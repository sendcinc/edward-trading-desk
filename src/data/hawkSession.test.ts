import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  EDWARD_HAWK_LOCAL_SESSION_ENDPOINT,
  EDWARD_HAWK_SESSION_ENDPOINT,
  loadHawkSession,
  validateHawkSession,
} from "./hawkSession";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "..", "..");
const sample = JSON.parse(readFileSync(join(currentDir, "..", "..", "public", "data", "hawk-session-latest.json"), "utf8"));
const helperScript = join(repoRoot, "scripts", "load-local-hawk-artifact.mjs");

afterEach(() => {
  vi.unstubAllGlobals();
});

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
    expect(validation.session.live_management?.operator_message).toContain("Valid entry review");
    expect(validation.session.live_management?.action_type).toBe("review_only");
    expect(validation.session.live_management?.good_add_zone).toEqual([0.1988, 0.2005]);
  });

  it("accepts older Hawk artifacts without additive live_management fields", () => {
    const oldSample = { ...sample };
    delete oldSample.live_management;
    const validation = validateHawkSession(oldSample);

    expect(validation.ok).toBe(true);
    if (!validation.ok) return;
    expect(validation.session.live_management).toBeUndefined();
    expect(validation.session.current_state).toBe("VALID_ENTRY_REVIEW");
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

  it("loads the ignored local Hawk artifact before the checked-in sample endpoint", async () => {
    const localSession = {
      ...sample,
      session_id: "local-runtime-smoke",
      current_state: "WATCH_SUPPORT",
      latest_decision: {
        ...sample.latest_decision,
        state: "WATCH_SUPPORT",
        message: "Support touched at 0.1984. No entry yet; wait for seller failure and reclaim.",
        order_ticket_suggestion: null,
      },
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url === EDWARD_HAWK_LOCAL_SESSION_ENDPOINT) return new Response(JSON.stringify(localSession), { status: 200 });
      return new Response(JSON.stringify(sample), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadHawkSession();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(EDWARD_HAWK_LOCAL_SESSION_ENDPOINT, {
      headers: { Accept: "application/json" },
    });
    expect(result.status).toBe("available");
    expect(result.session?.session_id).toBe("local-runtime-smoke");
    expect(result.session?.current_state).toBe("WATCH_SUPPORT");
  });

  it("falls back to the checked-in sample when the local Hawk artifact is missing", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === EDWARD_HAWK_LOCAL_SESSION_ENDPOINT) return new Response("missing", { status: 404 });
      if (url === EDWARD_HAWK_SESSION_ENDPOINT) return new Response(JSON.stringify(sample), { status: 200 });
      return new Response("missing", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadHawkSession();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("available");
    expect(result.session?.current_state).toBe("VALID_ENTRY_REVIEW");
  });

  it("reports unavailable/no-action when both Hawk artifact endpoints are missing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("missing", { status: 404 })));

    const result = await loadHawkSession();

    expect(result.status).toBe("unavailable");
    expect(result.session).toBeNull();
    expect(result.message).toContain("unavailable");
  });

  it("copies a local Hawk artifact into the ignored dev path", () => {
    const dir = mkdtempSync(join(tmpdir(), "hawk-artifact-copy-"));
    const source = join(dir, "latest-session.json");
    const output = join(dir, "public", "data", "hawk", "latest-session.json");
    writeFileSync(source, JSON.stringify(sample, null, 2));

    const stdout = execFileSync("node", [helperScript, "--source", source, "--output", output], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    expect(stdout).toContain(output);
    expect(JSON.parse(readFileSync(output, "utf8")).current_state).toBe("VALID_ENTRY_REVIEW");
    rmSync(dir, { recursive: true, force: true });
  });

  it("refuses a missing local Hawk artifact source", () => {
    expect(() => {
      execFileSync("node", [helperScript, "--source", "/tmp/edward-hawk-review/does-not-exist.json"], {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: "pipe",
      });
    }).toThrow();
  });

  it("refuses stale schema-valid artifacts that still carry an advisory ticket", () => {
    const dir = mkdtempSync(join(tmpdir(), "hawk-artifact-stale-"));
    const source = join(dir, "unsafe-stale.json");
    const output = join(dir, "public", "data", "hawk", "latest-session.json");
    writeFileSync(source, JSON.stringify({
      ...sample,
      current_state: "VALID_ENTRY_REVIEW",
      latest_decision: {
        ...sample.latest_decision,
        data_confidence: "STALE_OR_UNAVAILABLE",
        order_ticket_suggestion: sample.latest_decision.order_ticket_suggestion,
      },
    }, null, 2));

    expect(() => {
      execFileSync("node", [helperScript, "--source", source, "--output", output], {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: "pipe",
      });
    }).toThrow();
    expect(existsSync(output)).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("keeps generated local Hawk artifacts ignored by git", () => {
    const gitignore = readFileSync(join(repoRoot, ".gitignore"), "utf8");

    expect(gitignore).toContain("public/data/hawk/*.json");
  });
});
