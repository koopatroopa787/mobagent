export interface GitHubAlert {
  id: string;
  source: "github_actions";
  repo: string;
  branch: string;
  workflow: string;
  raw_log_excerpt: string;
  candidate_files: string[];
  received_at: Date;
}

export function extractCandidateFiles(text: string): string[] {
  const matches = new Set<string>();
  for (const m of text.matchAll(/(?:^|\s)([\w./\\-]+\.(ts|js|py|dart|go|rs|java))/gm)) {
    matches.add(m[1]);
    if (matches.size >= 5) break;
  }
  return [...matches];
}

export function parseWorkflowRunPayload(body: unknown): GitHubAlert | null {
  const p = body as any;
  if (p?.action !== "completed") return null;
  if (p?.workflow_run?.conclusion !== "failure") return null;

  const run = p.workflow_run;
  return {
    id: String(run.id),
    source: "github_actions",
    repo: run.repository?.full_name ?? "",
    branch: run.head_branch ?? "",
    workflow: run.name ?? "",
    raw_log_excerpt: run.jobs_url ?? "",
    candidate_files: extractCandidateFiles(run.head_commit?.message ?? ""),
    received_at: new Date(),
  };
}

export class AlertStore {
  private alerts = new Map<string, GitHubAlert>();

  add(alert: GitHubAlert): void {
    this.alerts.set(alert.id, alert);
  }

  get(id: string): GitHubAlert | undefined {
    return this.alerts.get(id);
  }

  pending(): GitHubAlert[] {
    return [...this.alerts.values()];
  }

  remove(id: string): void {
    this.alerts.delete(id);
  }
}

// ponytail: fetches job/step names only. For actual test output (stack traces,
// pytest logs), download the ZIP via run.logs_url — add if the agent needs
// more context to propose accurate fixes.
export async function fetchJobSummary(jobsUrl: string, token: string): Promise<string> {
  const res = await fetch(jobsUrl, {
    headers: { Authorization: `Bearer ${token}`, "User-Agent": "FieldFix/0.1" },
  });
  if (!res.ok) return `(jobs fetch failed: ${res.status})`;
  const { jobs = [] } = (await res.json()) as { jobs: any[] };
  const failed = jobs.find((j) => j.conclusion === "failure");
  if (!failed) return "(no failed job found in run)";
  const steps = (failed.steps as any[])
    .filter((s) => s.conclusion === "failure")
    .map((s) => `  step "${s.name as string}" failed`)
    .join("\n");
  return `job: ${failed.name as string}\n${steps}`;
}
