import type { AppDefinition, AccentColor } from "../types";

type Seed = {
  id: string;
  title: string;
  subtitle: string;
  accent: AccentColor;
  domain: string;
  toolNames: Array<[string, string[], string]>;
};

function buildApp(seed: Seed): AppDefinition {
  return {
    id: seed.id,
    title: seed.title,
    subtitle: seed.subtitle,
    accent: seed.accent,
    welcome: `This ${seed.domain} workspace is running on the shared mock TUI architecture shell. Every transcript, command, task, and tool call is mocked, but the runtime boundaries mirror the recovered architecture.`,
    quickCommands: ["/help", "/tasks", "/status", "/apps", `/variant ${seed.id}`],
    starterMessages: [
      {
        role: "system",
        kind: "status",
        title: "Architecture shell",
        content: `Loaded ${seed.title}. Provider shell, registries, query engine, transcript virtualization, mailbox bridge, and task watcher are active in mock mode.`,
      },
      {
        role: "assistant",
        kind: "text",
        title: "Welcome",
        content: `Use natural prompts or slash commands to explore the ${seed.domain} workflow. Background tasks and mailbox prompts will flow into the same runtime loop.`,
      },
    ],
    tasks: [
      {
        subject: `Review the current ${seed.domain} backlog`,
        description: `Summarize the three highest-priority items for ${seed.title}.`,
      },
      {
        subject: `Simulate an operator handoff`,
        description: `Generate a concise handoff note with risks, blockers, and next actions.`,
      },
    ],
    mailboxPrompts: [
      `Mailbox message: provide a 3-bullet operational summary for the ${seed.domain} team.`,
      `Mailbox message: identify the highest-leverage follow-up inside the ${seed.domain} workflow.`,
    ],
    notifications: [
      {
        title: `${seed.title} feed`,
        body: `New background event received for ${seed.domain}.`,
        tone: "info",
      },
      {
        title: `${seed.title} status`,
        body: `Mock sync cycle finished successfully.`,
        tone: "success",
      },
    ],
    tools: seed.toolNames.map(([name, keywords, description]) => ({
      name,
      keywords,
      description,
    })),
  };
}

export const APP_DEFINITIONS: AppDefinition[] = [
  buildApp({
    id: "coding-agent",
    title: "Coding Agent",
    subtitle: "Mock software delivery workspace",
    accent: "cyan",
    domain: "software delivery",
    toolNames: [
      ["workspace-map", ["codebase", "files", "modules"], "Map codebase structure"],
      ["task-router", ["task", "plan", "todo"], "Route work across mock teammates"],
      ["diff-lens", ["diff", "change", "patch"], "Summarize proposed code deltas"],
    ],
  }),
  buildApp({
    id: "incident-console",
    title: "Incident Console",
    subtitle: "Operational incident response cockpit",
    accent: "red",
    domain: "incident response",
    toolNames: [
      ["blast-radius", ["impact", "services", "blast"], "Estimate affected systems"],
      ["timeline", ["timeline", "sequence", "events"], "Assemble incident chronology"],
      ["status-brief", ["brief", "update", "stakeholders"], "Draft incident updates"],
    ],
  }),
  buildApp({
    id: "support-desk",
    title: "Support Desk",
    subtitle: "Customer ticket and resolution workspace",
    accent: "green",
    domain: "customer support",
    toolNames: [
      ["ticket-scan", ["ticket", "queue", "backlog"], "Prioritize incoming tickets"],
      ["reply-draft", ["reply", "customer", "response"], "Draft customer-safe replies"],
      ["kb-match", ["knowledge", "article", "faq"], "Match cases to KB articles"],
    ],
  }),
  buildApp({
    id: "data-pipeline",
    title: "Data Pipeline Operator",
    subtitle: "Pipeline and job health terminal",
    accent: "yellow",
    domain: "data operations",
    toolNames: [
      ["job-matrix", ["pipeline", "job", "dag"], "Inspect pipeline health"],
      ["sla-forecast", ["sla", "delay", "latency"], "Estimate SLA risk"],
      ["runbook", ["runbook", "recovery", "rerun"], "Suggest remediation steps"],
    ],
  }),
  buildApp({
    id: "research-assistant",
    title: "Research Assistant",
    subtitle: "Structured literature and evidence terminal",
    accent: "magenta",
    domain: "research synthesis",
    toolNames: [
      ["source-cluster", ["papers", "sources", "themes"], "Cluster source material"],
      ["evidence-grid", ["evidence", "compare", "matrix"], "Compare findings"],
      ["brief-writer", ["brief", "memo", "summary"], "Draft research briefs"],
    ],
  }),
  buildApp({
    id: "crm-workspace",
    title: "CRM Workspace",
    subtitle: "Account and relationship management shell",
    accent: "blue",
    domain: "customer relationship management",
    toolNames: [
      ["account-heatmap", ["account", "portfolio", "risk"], "Assess account health"],
      ["next-best-action", ["upsell", "renewal", "action"], "Recommend next action"],
      ["meeting-brief", ["meeting", "call", "prep"], "Prepare meeting context"],
    ],
  }),
  buildApp({
    id: "sales-copilot",
    title: "Sales Copilot",
    subtitle: "Pipeline coaching and deal execution shell",
    accent: "green",
    domain: "sales execution",
    toolNames: [
      ["deal-shape", ["deal", "stage", "pipeline"], "Evaluate deal posture"],
      ["objection-lab", ["objection", "buyer", "response"], "Draft buyer responses"],
      ["forecast-note", ["forecast", "quarter", "commit"], "Produce forecast notes"],
    ],
  }),
  buildApp({
    id: "planning-studio",
    title: "Planning Studio",
    subtitle: "Product and roadmap planning terminal",
    accent: "cyan",
    domain: "product planning",
    toolNames: [
      ["roadmap-weave", ["roadmap", "initiative", "sequence"], "Sequence initiatives"],
      ["tradeoff-matrix", ["tradeoff", "decision", "options"], "Compare options"],
      ["launch-plan", ["launch", "rollout", "milestone"], "Draft rollout plans"],
    ],
  }),
  buildApp({
    id: "logistics-dispatch",
    title: "Logistics Dispatch",
    subtitle: "Route planning and exception management shell",
    accent: "yellow",
    domain: "logistics dispatch",
    toolNames: [
      ["route-load", ["route", "fleet", "capacity"], "Inspect dispatch capacity"],
      ["delay-triage", ["delay", "shipment", "late"], "Triage delivery issues"],
      ["handoff-board", ["handoff", "driver", "warehouse"], "Prepare shift handoffs"],
    ],
  }),
  buildApp({
    id: "security-triage",
    title: "Security Triage",
    subtitle: "Alert review and response planning shell",
    accent: "red",
    domain: "security operations",
    toolNames: [
      ["alert-stack", ["alert", "signals", "severity"], "Cluster alert signals"],
      ["ioc-lens", ["ioc", "indicator", "artifact"], "Summarize indicators"],
      ["containment", ["contain", "mitigate", "response"], "Draft containment plan"],
    ],
  }),
  buildApp({
    id: "healthcare-intake",
    title: "Healthcare Intake",
    subtitle: "Mock intake coordination and scheduling shell",
    accent: "blue",
    domain: "healthcare intake",
    toolNames: [
      ["intake-check", ["intake", "forms", "eligibility"], "Validate intake flow"],
      ["schedule-grid", ["schedule", "appointment", "slots"], "Review scheduling posture"],
      ["care-summary", ["care", "summary", "handoff"], "Draft intake handoff"],
    ],
  }),
  buildApp({
    id: "knowledge-terminal",
    title: "Knowledge Terminal",
    subtitle: "Personal and team knowledge workspace",
    accent: "white",
    domain: "knowledge management",
    toolNames: [
      ["topic-weaver", ["topic", "notes", "cluster"], "Connect notes into themes"],
      ["recall-brief", ["recall", "summary", "context"], "Summarize recalled context"],
      ["action-extract", ["actions", "next steps", "follow-up"], "Extract follow-up actions"],
    ],
  }),
];

export function getAppDefinition(appId: string): AppDefinition {
  const found = APP_DEFINITIONS.find(app => app.id === appId);
  return found ?? APP_DEFINITIONS[0]!;
}
