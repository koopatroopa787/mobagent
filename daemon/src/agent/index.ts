// Agent loop: maps a failing-test alert to a single-file diff proposal.
// Phase 1 hard constraint: exactly one file per fix (CLAUDE.md #1).
// Result is broadcast to the phone as a FIX_PROPOSAL for user approval.

import type { GitHubAlert } from "../webhooks/github.js";

export interface FixProposal {
  alert_id: string;
  file: string;
  diff: string;
  explanation: string;
  generated_by: "daemon";
}

const LITELLM_URL = process.env.LITELLM_PROXY_URL ?? "http://localhost:4000";

const SYSTEM = `You are a coding assistant. Given a failing test log and one source file, output a unified diff (git diff format) that fixes exactly that one file. Output the raw diff only — no explanation, no markdown fences.`;

export async function proposeFixForAlert(
  alert: GitHubAlert,
  fileContents: Record<string, string>
): Promise<FixProposal | null> {
  const files = Object.entries(fileContents)
    .map(([p, c]) => `### ${p}\n\`\`\`\n${c}\n\`\`\``)
    .join("\n\n");

  const res = await fetch(`${LITELLM_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "local-fast",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Failure:\n${alert.raw_log_excerpt}\n\nFiles:\n${files}` },
      ],
    }),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as any;
  const diff = (data.choices[0].message.content as string).trim();

  const fileMatch = diff.match(/^\+\+\+ b\/(.+)$/m);
  if (!fileMatch) return null;

  return {
    alert_id: alert.id,
    file: fileMatch[1],
    diff,
    explanation: "",
    generated_by: "daemon",
  };
}
