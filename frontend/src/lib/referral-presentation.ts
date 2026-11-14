import type { Message } from "@langchain/langgraph-sdk";
import type { UIMessage } from "@langchain/langgraph-sdk/react-ui";
import type {
  CoordinatorWorkflow,
  ReferralState,
  ReviewInterrupt,
} from "./referrals";

const MILESTONES = [
  [
    "referral_packet",
    "Referral packet",
    "Reading and organizing the uploaded clinical document.",
  ],
  [
    "intake_details",
    "Intake details",
    "Checking patient, insurance, and referral information.",
  ],
  [
    "clinical_review",
    "Clinical review",
    "Preparing relevant clinical requirements and findings.",
  ],
  ["coordinator_review", "Coordinator review", "Waiting for review."],
] as const;

export type ReferralProgress = {
  stage: (typeof MILESTONES)[number][0];
  status: "active" | "complete" | "attention";
};

export type CardRow = { label: string; value: string };

type Presentation = {
  type: "referral_presentation";
  component: "referral_summary" | "clinical_findings";
  rows: CardRow[];
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readProgress(value: unknown): ReferralProgress | undefined {
  if (!record(value)) return;
  if (
    MILESTONES.some(([id]) => id === value.stage) &&
    ["active", "complete", "attention"].includes(String(value.status))
  ) {
    return value as ReferralProgress;
  }
}

function readPresentation(value: unknown): Presentation | undefined {
  if (
    record(value) &&
    value.type === "referral_presentation" &&
    (value.component === "referral_summary" ||
      value.component === "clinical_findings") &&
    Array.isArray(value.rows) &&
    value.rows.length > 0 &&
    value.rows.every(
      (row) =>
        record(row) &&
        typeof row.label === "string" &&
        row.label.trim() &&
        typeof row.value === "string" &&
        row.value.trim(),
    )
  ) {
    return value as Presentation;
  }
}

function inferredProgress(
  state: ReferralState,
  review?: ReviewInterrupt,
): ReferralProgress {
  if (state.outcome === "not_referral_document")
    return { stage: "referral_packet", status: "attention" };
  if (
    review?.type === "routing_review" ||
    ["human_review_required", "human_reviewed", "needs_information"].includes(
      state.outcome ?? "",
    )
  )
    return { stage: "intake_details", status: "attention" };
  if (["referral_approved", "referral_rejected"].includes(state.outcome ?? ""))
    return { stage: "coordinator_review", status: "complete" };
  if (review?.type === "clinical_review" || state.clinical_requirements)
    return { stage: "coordinator_review", status: "active" };
  if (state.insurance) return { stage: "clinical_review", status: "active" };
  if (state.extracted || state.document_classification)
    return { stage: "intake_details", status: "active" };
  return { stage: "referral_packet", status: "active" };
}

function workflow(progress: ReferralProgress): CoordinatorWorkflow {
  const current = MILESTONES.findIndex(([id]) => id === progress.stage);
  return Object.fromEntries(
    MILESTONES.slice(0, current + 1).map(([id, title, description], order) => [
      id,
      {
        id,
        title,
        description,
        order,
        status: order < current ? "complete" : progress.status,
      },
    ]),
  );
}

function uiMessage(
  name: string,
  props: Record<string, unknown>,
  id = name,
): UIMessage {
  return { type: "ui", id, name, props, metadata: {} };
}

export function automaticReferralUI(
  state: ReferralState,
  review?: ReviewInterrupt,
  liveProgress?: ReferralProgress,
): UIMessage[] {
  // Read older saved UI messages, but never require them for new referrals.
  const legacy = state.ui ?? [];
  const messages = [
    uiMessage("referral_progress", {
      workflow:
        state.workflow ??
        workflow(
          review
            ? inferredProgress(state, review)
            : (liveProgress ?? inferredProgress(state)),
        ),
    }),
  ];
  if (review?.type === "clinical_review" && state.clinical_requirements) {
    messages.push(uiMessage("clinical_review", state.clinical_requirements));
  } else if (review?.type === "routing_review") {
    messages.push(
      uiMessage("routing_review", {
        reason: state.message ?? "Review the referral routing.",
        editable: true,
      }),
    );
  }
  for (const message of legacy) {
    if (!messages.some((item) => item.name === message.name))
      messages.push(message);
  }
  return messages;
}

export function presentationMessages(
  messages: Message[],
): Map<string, UIMessage> {
  const result = new Map<string, UIMessage>();
  for (const message of messages) {
    if (
      message.type !== "tool" ||
      message.status === "error" ||
      message.name !== "present_referral"
    ) {
      continue;
    }

    const presentation = readPresentation(message.artifact);
    if (presentation) {
      result.set(
        message.id ?? message.tool_call_id,
        uiMessage(
          presentation.component,
          { rows: presentation.rows },
          message.tool_call_id,
        ),
      );
    }
  }
  return result;
}
