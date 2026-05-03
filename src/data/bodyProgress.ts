import progressJson from "../../public/data/body-progress.json";

export type BodyPartProgress = {
  status: "online" | "planned" | "locked" | "partial";
  summary: string;
};

export type EdwardBodyProgress = {
  projectName: string;
  overallStatus: string;
  estimatedOverallPercent: number;
  currentPhase: string;
  currentChapter: string;
  liveCapabilities: string[];
  pendingProof: string[];
  currentReflexStatus: {
    summary: string;
    flatBehavior: string;
    openTradeProof: string;
    monitorJobId: string;
    monitorCadence: string;
    monitorScope: string;
    guardrailBadge: string;
    operatingPrinciple: string;
  };
  completedMilestones: string[];
  nextMilestones: string[];
  blockers: string[];
  bodyParts: Record<string, BodyPartProgress>;
  executionAllowed: boolean;
  reasonExecutionLocked: string;
};

export const edwardBodyProgress = progressJson as EdwardBodyProgress;
