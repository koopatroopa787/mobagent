import type { GitHubAlert } from "../webhooks/github.js";

export interface FixProposal {
  alert_id: string;
  file: string;
  diff: string;
  explanation: string;
  generated_by: "daemon";
}

const LITELLM_URL = process.env.LITELLM_PROXY_URL ?? "http://localhost:4000";

const SYSTEM = `You are a coding assistant that fixes failing tests. Given a test failure log and the relevant source file(s), respond in exactly this format:

EXPLANATION: <one sentence — what was wrong and what the fix does>
DIFF:
<unified diff in git format, starting with --- and +++, for exactly one file>

Rules:
- Fix exactly one file (hard constraint).
- Output a syntactically valid unified diff — no markdown fences, no commentary.
- If you cannot determine a fix, respond with EXPLANATION: unable to determine a fix and omit the DIFF section.`;

export async function proposeFixForAlert(
  alert: GitHubAlert,
  fileContents: Record<string, string>
): Promise<FixProposal | null> {
  if (Object.keys(fileContents).length === 0) return null;

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
        {
          role: "user",
          content: `Test failure:\n${alert.raw_log_excerpt}\n\nSource files:\n${files}`,
        },
      ],
    }),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as any;
  const text = (data.choices[0].message.content as string).trim();

  const [headPart, diffPart] = text.split(/\nDIFF:\n/, 2);
  const explanation = headPart?.replace(/^EXPLANATION:\s*/m, "").trim() ?? "";
  if (!diffPart) return null;

  // Strip accidental markdown fences if the model disobeys the system prompt
  const diff = diffPart
    .trim()
    .replace(/^```(?:diff)?\n?/m, "")
    .replace(/\n?```\s*$/m, "");

  // Match +++ b/path (standard git diff) or +++ path (bare diff)
  const fileMatch = diff.match(/^\+\+\+ b\/(.+)$/m) ?? diff.match(/^\+\+\+ (.+)$/m);
  if (!fileMatch) return null;

  return {
    alert_id: alert.id,
    file: fileMatch[1].trim(),
    diff,
    explanation,
    generated_by: "daemon",
  };
}
