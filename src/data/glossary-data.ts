export interface GlossaryTerm {
  term: string;
  definition: string;
  context: string;
  tracks: ("frontend" | "backend" | "infra" | "cross-repo")[];
}

export const glossaryTerms: GlossaryTerm[] = [
  {
    term: "API Gateway",
    definition: "A single entry point that handles routing, rate limiting, and auth token validation for all incoming API requests.",
    context: "Routes requests to the correct downstream microservice after validation.",
    tracks: ["backend", "infra"],
  },
  {
    term: "ArgoCD",
    definition: "A declarative GitOps continuous delivery tool for Kubernetes that syncs desired state from Git repos to clusters.",
    context: "Used for production deployments with manual approval gates.",
    tracks: ["infra"],
  },
  {
    term: "ClickHouse",
    definition: "A columnar database management system optimized for online analytical processing (OLAP) queries.",
    context: "Used for the analytics pipeline data store.",
    tracks: ["backend", "infra"],
  },
  {
    term: "CODEOWNERS",
    definition: "A GitHub file that defines which team members are automatically requested for review on PRs touching specific paths.",
    context: "Located at .github/CODEOWNERS; auto-assigns reviewers.",
    tracks: ["cross-repo"],
  },
  {
    term: "CSP (Content Security Policy)",
    definition: "A security header that restricts which resources the browser can load, preventing XSS and data injection attacks.",
    context: "Implemented on the frontend to control script/style sources.",
    tracks: ["frontend"],
  },
  {
    term: "DOMPurify",
    definition: "A library that sanitizes HTML input to prevent cross-site scripting (XSS) attacks.",
    context: "Used in the frontend for all user-generated content rendering.",
    tracks: ["frontend"],
  },
  {
    term: "EKS (Elastic Kubernetes Service)",
    definition: "AWS-managed Kubernetes service that runs containerized applications at scale.",
    context: "Our orchestration layer; infrastructure managed via Terraform.",
    tracks: ["infra"],
  },
  {
    term: "gRPC",
    definition: "A high-performance, open-source RPC framework using Protocol Buffers for serialization.",
    context: "Used for internal service-to-service communication; REST is used externally.",
    tracks: ["backend"],
  },
  {
    term: "HMR (Hot Module Replacement)",
    definition: "A development feature that updates modules in the browser without a full page refresh.",
    context: "Powered by Vite in the frontend dev server.",
    tracks: ["frontend"],
  },
  {
    term: "OTLP (OpenTelemetry Protocol)",
    definition: "A standard protocol for exporting telemetry data (traces, metrics, logs) from applications.",
    context: "Every service exports OTLP traces to the Tempo backend.",
    tracks: ["backend", "infra"],
  },
  {
    term: "Pact",
    definition: "A contract testing framework that verifies API interactions between services match agreed-upon contracts.",
    context: "Used for backend API contract tests to ensure service compatibility.",
    tracks: ["backend"],
  },
  {
    term: "PagerDuty",
    definition: "An incident management platform that routes alerts to on-call engineers with escalation policies.",
    context: "Receives alerts from Alertmanager; primary responder has 5-minute ack SLA.",
    tracks: ["infra"],
  },
  {
    term: "PKCE (Proof Key for Code Exchange)",
    definition: "An OAuth 2.0 extension that prevents authorization code interception attacks, critical for SPAs.",
    context: "Used in the frontend authentication flow.",
    tracks: ["frontend", "backend"],
  },
  {
    term: "RBAC (Role-Based Access Control)",
    definition: "An authorization model where permissions are assigned to roles, and users are assigned to roles.",
    context: "Our hierarchy: Owner → Admin → Editor → Viewer with resource:action permissions.",
    tracks: ["backend"],
  },
  {
    term: "Terraform",
    definition: "An Infrastructure as Code (IaC) tool for defining and provisioning cloud infrastructure declaratively.",
    context: "Manages all cloud infrastructure including EKS clusters.",
    tracks: ["infra"],
  },
  {
    term: "Trunk-based Development",
    definition: "A branching strategy where developers merge small, frequent changes to a single 'trunk' (main) branch.",
    context: "Our branching model with short-lived feature branches and squash merges.",
    tracks: ["frontend", "backend", "infra", "cross-repo"],
  },
  {
    term: "Vault (HashiCorp)",
    definition: "A secrets management tool for securely storing, accessing, and rotating credentials and API keys.",
    context: "Secrets are injected via Vault Agent sidecar in K8s pods; DB creds rotate every 24h.",
    tracks: ["infra", "backend"],
  },
  {
    term: "Zustand",
    definition: "A lightweight state management library for React that uses a simple hook-based API.",
    context: "Used for client-side state; TanStack Query handles server state.",
    tracks: ["frontend"],
  },
];
