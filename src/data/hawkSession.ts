import { z } from "zod";
import type { Direction } from "../domain/tradingDesk";

export const EDWARD_HAWK_SESSION_ENDPOINT = "/trading-desk/data/hawk-session-latest.json";
export const EDWARD_HAWK_LOCAL_SESSION_ENDPOINT = "/trading-desk/data/hawk/latest-session.json";
export const EDWARD_HAWK_SESSION_ENDPOINTS = [
  EDWARD_HAWK_LOCAL_SESSION_ENDPOINT,
  EDWARD_HAWK_SESSION_ENDPOINT,
] as const;

export const HAWK_DECISION_STATES = [
  "WAIT",
  "WATCH_SUPPORT",
  "WAITING_FOR_RECLAIM",
  "RECLAIM_CONFIRMED",
  "ENTRY_REVIEW",
  "VALID_ENTRY_REVIEW",
  "INVALIDATED",
  "SKIP_CHASE",
  "STALE_NO_ACTION",
] as const;

export type HawkDecisionState = (typeof HAWK_DECISION_STATES)[number];

export type HawkOrderTicketSuggestion = {
  proposed_action: string;
  symbol: string;
  direction: Direction;
  entry_zone: number[];
  invalidation: number;
  hard_failure: number;
  chase_cutoff: number;
  approval_required: true;
  execution_enabled: false;
};

export type HawkDecision = {
  state: HawkDecisionState;
  message: string;
  next_required_condition: string;
  thesis: string;
  risk: string;
  data_confidence: string;
  order_ticket_suggestion?: HawkOrderTicketSuggestion | null;
};

export type HawkLiveManagement = {
  operator_message?: string;
  current_decision_plain?: string;
  next_checkpoint?: {
    at?: string | null;
    label?: string | null;
    reason?: string | null;
  } | null;
  next_checkpoint_reason?: string | null;
  higher_timeframe_checkpoint?: {
    at?: string | null;
    label?: string | null;
    timeframe?: string | null;
  } | null;
  good_entry_zone?: number[] | null;
  good_add_zone?: number[] | null;
  soft_invalidation?: {
    level?: number | null;
    condition?: string | null;
  } | number | string | null;
  hard_failure?: number | null;
  chase_cutoff?: number | null;
  reset_zone?: number | null;
  decision_deadline?: string | null;
  action_allowed?: boolean | "review_only" | string | null;
  action_type?: string | null;
  no_action_reason?: string | null;
  time_context?: {
    as_of?: string | null;
    candle_minutes?: number | null;
    higher_timeframe?: string | null;
    timezone_source?: string | null;
  } | null;
};

export type HawkWatchSession = {
  contract: "edward_hawk_watch_session.v0.1";
  session_id: string;
  symbol: string;
  direction: Direction;
  timeframe: string;
  playbook: {
    name: string;
    display_name: string;
    version: string;
  };
  level_plan: {
    current_area: number;
    support_zone: number[];
    reclaim_level: number;
    entry_review_zone: number[];
    hard_failure: number;
    deep_edge: number;
    chase_cutoff: number;
    market_state: string;
    rule: string;
  };
  current_state: HawkDecisionState;
  next_required_condition: string;
  timeline: {
    at: string;
    state: HawkDecisionState;
    summary: string;
    price?: number | null;
  }[];
  latest_decision: HawkDecision | null;
  read_only: true;
  manual_only: true;
  creates_trade_permission: false;
  entry_permission: false;
  auto_execution: false;
  execution_intent: "none";
  live_management?: HawkLiveManagement | null;
  updated_at?: string;
};

export type HawkLoadStatus = "available" | "unavailable" | "stale" | "malformed";

export type HawkLoadResult = {
  status: HawkLoadStatus;
  session: HawkWatchSession | null;
  message: string;
  validationIssues: string[];
  loadedAt: string;
};

const hawkDecisionStateSchema = z.enum(HAWK_DECISION_STATES);
const directionSchema = z.enum(["LONG", "SHORT"]);

const hawkOrderTicketSuggestionSchema = z.object({
  proposed_action: z.string().min(1),
  symbol: z.string().min(1),
  direction: directionSchema,
  entry_zone: z.array(z.number().finite()).length(2),
  invalidation: z.number().finite(),
  hard_failure: z.number().finite(),
  chase_cutoff: z.number().finite(),
  approval_required: z.literal(true),
  execution_enabled: z.literal(false),
}).strict();

const hawkDecisionSchema = z.object({
  state: hawkDecisionStateSchema,
  message: z.string().min(1),
  next_required_condition: z.string().min(1),
  thesis: z.string().min(1),
  risk: z.string().min(1),
  data_confidence: z.string().min(1),
  order_ticket_suggestion: hawkOrderTicketSuggestionSchema.nullable().optional(),
}).strict();

const hawkCheckpointSchema = z.object({
  at: z.string().min(1).nullable().optional(),
  label: z.string().min(1).nullable().optional(),
  reason: z.string().min(1).nullable().optional(),
  timeframe: z.string().min(1).nullable().optional(),
}).passthrough();

const hawkSoftInvalidationSchema = z.union([
  z.object({
    level: z.number().finite().nullable().optional(),
    condition: z.string().min(1).nullable().optional(),
  }).passthrough(),
  z.number().finite(),
  z.string().min(1),
]);

const hawkLiveManagementSchema = z.object({
  operator_message: z.string().min(1).optional(),
  current_decision_plain: z.string().min(1).optional(),
  next_checkpoint: hawkCheckpointSchema.nullable().optional(),
  next_checkpoint_reason: z.string().min(1).nullable().optional(),
  higher_timeframe_checkpoint: hawkCheckpointSchema.nullable().optional(),
  good_entry_zone: z.array(z.number().finite()).length(2).nullable().optional(),
  good_add_zone: z.array(z.number().finite()).length(2).nullable().optional(),
  soft_invalidation: hawkSoftInvalidationSchema.nullable().optional(),
  hard_failure: z.number().finite().nullable().optional(),
  chase_cutoff: z.number().finite().nullable().optional(),
  reset_zone: z.number().finite().nullable().optional(),
  decision_deadline: z.string().min(1).nullable().optional(),
  action_allowed: z.union([z.boolean(), z.literal("review_only"), z.string()]).nullable().optional(),
  action_type: z.string().min(1).nullable().optional(),
  no_action_reason: z.string().nullable().optional(),
  time_context: z.object({
    as_of: z.string().min(1).nullable().optional(),
    candle_minutes: z.number().finite().nullable().optional(),
    higher_timeframe: z.string().min(1).nullable().optional(),
    timezone_source: z.string().min(1).nullable().optional(),
  }).passthrough().nullable().optional(),
}).passthrough();

const hawkWatchSessionSchema = z.object({
  contract: z.literal("edward_hawk_watch_session.v0.1"),
  session_id: z.string().min(1),
  symbol: z.string().min(1),
  direction: directionSchema,
  timeframe: z.string().min(1),
  playbook: z.object({
    name: z.string().min(1),
    display_name: z.string().min(1),
    version: z.string().min(1),
  }).strict(),
  level_plan: z.object({
    current_area: z.number().finite(),
    support_zone: z.array(z.number().finite()).length(2),
    reclaim_level: z.number().finite(),
    entry_review_zone: z.array(z.number().finite()).length(2),
    hard_failure: z.number().finite(),
    deep_edge: z.number().finite(),
    chase_cutoff: z.number().finite(),
    market_state: z.string().min(1),
    rule: z.string().min(1),
  }).strict(),
  current_state: hawkDecisionStateSchema,
  next_required_condition: z.string().min(1),
  timeline: z.array(z.object({
    at: z.string().min(1),
    state: hawkDecisionStateSchema,
    summary: z.string().min(1),
    price: z.number().finite().nullable().optional(),
  }).passthrough()).default([]),
  latest_decision: hawkDecisionSchema.nullable(),
  read_only: z.literal(true),
  manual_only: z.literal(true),
  creates_trade_permission: z.literal(false),
  entry_permission: z.literal(false),
  auto_execution: z.literal(false),
  execution_intent: z.literal("none"),
  live_management: hawkLiveManagementSchema.nullable().optional(),
  updated_at: z.string().min(1).optional(),
}).passthrough();

export type HawkValidationResult =
  | { ok: true; session: HawkWatchSession; issues: [] }
  | { ok: false; issues: string[] };

export function validateHawkSession(raw: unknown): HawkValidationResult {
  const result = hawkWatchSessionSchema.safeParse(raw);
  if (result.success) return { ok: true, session: result.data as HawkWatchSession, issues: [] };
  return {
    ok: false,
    issues: result.error.issues.map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "hawkSession";
      return `${path}: ${issue.message}`;
    }),
  };
}

export function safeUnavailableHawkSession(message: string, status: Exclude<HawkLoadStatus, "available"> = "unavailable"): HawkLoadResult {
  return {
    status,
    session: null,
    message,
    validationIssues: [message],
    loadedAt: new Date().toISOString(),
  };
}

async function loadHawkSessionFromEndpoint(endpoint: string): Promise<HawkLoadResult> {
  try {
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return safeUnavailableHawkSession(`${endpoint} unavailable: HTTP ${response.status}`);
    const raw = await response.json();
    const validation = validateHawkSession(raw);
    if (!validation.ok) return safeUnavailableHawkSession(`${endpoint} validation failed: ${validation.issues.join("; ")}`, "malformed");
    const stale = validation.session.current_state === "STALE_NO_ACTION" || validation.session.latest_decision?.data_confidence.toUpperCase().includes("STALE");
    return {
      status: stale ? "stale" : "available",
      session: validation.session,
      message: stale ? "Hawk data stale/unavailable. No action." : "Hawk session available.",
      validationIssues: [],
      loadedAt: new Date().toISOString(),
    };
  } catch (error) {
    return safeUnavailableHawkSession(error instanceof Error ? error.message : `${endpoint} unavailable`);
  }
}

export async function loadHawkSession(endpoint: string | readonly string[] = EDWARD_HAWK_SESSION_ENDPOINTS): Promise<HawkLoadResult> {
  const endpoints = Array.isArray(endpoint) ? endpoint : [endpoint];
  let lastResult: HawkLoadResult | null = null;
  for (const candidate of endpoints) {
    const result = await loadHawkSessionFromEndpoint(candidate);
    if (result.status === "available" || result.status === "stale" || result.status === "malformed") return result;
    lastResult = result;
  }
  return lastResult ?? safeUnavailableHawkSession("Hawk data stale/unavailable. No action.");
}
