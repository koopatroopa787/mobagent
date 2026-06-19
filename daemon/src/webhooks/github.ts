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

function extractCandidateFiles(text: string): string[] {
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
