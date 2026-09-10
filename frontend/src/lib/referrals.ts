import type { UIMessage } from "@langchain/langgraph-sdk/react-ui";

export const AGENT_SERVER_URL =
  process.env.NEXT_PUBLIC_LANGGRAPH_API_URL ?? "http://127.0.0.1:2024";

export const ASSISTANT_ID = "referral_intake";

export type Patient = {
  first_name: string;
  last_name: string;
  date_of_birth: string | [number, number, number];
  sex: string;
  phone?: string | null;
};

export type Insurance = {
  payer_name: string;
  member_id: string;
  group_number?: string | null;
};

export type Provider = {
  name?: string | null;
  npi?: string | null;
  organization?: string | null;
};

export type Requirement = {
  id: string;
  description: string;
  required: boolean;
  source: string;
};

export type Finding = {
  requirement_id: string;
  status: "documented" | "not_documented";
  value?: string | null;
};

export type WorkflowStep = {
  id: string;
  title: string;
  description: string;
  status: "active" | "complete" | "attention";
  order: number;
};

export type CoordinatorWorkflow = Record<string, WorkflowStep>;

export type ClinicalRequirements = {
  skill: string;
  references: {
    condition?: string | null;
    service?: string | null;
  };
  requirements: Requirement[];
  findings: Finding[];
  decision?: "approve" | "reject" | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
};

export type ReferralExtraction = {
  patient: Partial<Patient>;
  insurance: Partial<Insurance>;
  provider: Provider;
  referring_provider: Provider;
  specialty?: string | null;
  subspecialty?: string | null;
  service?: string | null;
  condition?: string | null;
  priority?: string | null;
  reason_for_referral?: string | null;
  referral_type?: string | null;
};

export type ReferralState = {
  pdf_path?: string;
  pdf_name?: string;
  markdown?: string;
  extracted?: ReferralExtraction;
  patient?: Patient;
  insurance?: Insurance;
  clinical_requirements?: ClinicalRequirements;
  outcome?: string;
  missing_fields?: string[];
  message?: string;
  workflow?: CoordinatorWorkflow;
  ui?: UIMessage[];
};

export type ReviewInterrupt = {
  type: "clinical_review" | "routing_review";
};

export type ReferralThread = {
  thread_id: string;
  created_at: string;
  updated_at: string;
  status: "idle" | "busy" | "interrupted" | "error";
  values: ReferralState | null;
  interrupts?: unknown[];
};

export function patientName(state?: ReferralState | null): string {
  if (!state) return "Processing referral";

  const patient = state.patient ?? state.extracted?.patient;
  const name = [patient?.first_name, patient?.last_name]
    .filter(Boolean)
    .join(" ");

  return name || fileName(state.pdf_path) || "Referral record";
}

export function fileName(path?: string): string {
  return path?.split(/[\\/]/).at(-1) ?? "";
}

export function formatDate(value?: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function statusLabel(thread: ReferralThread): string {
  if (thread.status === "busy") return "Running";
  if (thread.status === "interrupted") return "Review needed";
  if (thread.status === "error") return "Needs attention";
  if (thread.values?.outcome === "referral_approved") return "Approved";
  if (thread.values?.outcome === "referral_rejected") return "Rejected";
  return "Completed";
}

export function formatBirthDate(value?: Patient["date_of_birth"] | null): string | undefined {
  if (!value) return undefined;
  const iso = Array.isArray(value)
    ? value.map((part) => String(part).padStart(2, "0")).join("-")
    : value;
  return iso.replace(/^(\d{4})-?(\d{2})-?(\d{2})$/, "$2-$3-$1");
}
