// Applies an approved diff in an isolated git worktree so the user's
// working branch is never modified. Satisfies CLAUDE.md constraint #5.

import simpleGit from "simple-git";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCommand } from "../verify/index.js";

export interface WorktreeResult {
  success: boolean;
  branch: string;
  worktreePath: string;
  output: string;
}

export async function applyInWorktree(
  repoPath: string,
  alertId: string,
  diff: string
): Promise<WorktreeResult> {
  const git = simpleGit(repoPath);
  const branch = `fieldfix/fix-${alertId}`;
  const worktreePath = await mkdtemp(join(tmpdir(), "fieldfix-"));

  try {
    await git.raw(["worktree", "add", worktreePath, "-b", branch]);
    await simpleGit(worktreePath).applyPatch(diff, ["--index"]);
    return { success: true, branch, worktreePath, output: "patch applied" };
  } catch (err: any) {
    await git.raw(["worktree", "remove", worktreePath, "--force"]).catch(() => {});
    return { success: false, branch, worktreePath, output: err.message as string };
  }
}

export interface ApplyTestPushResult {
  applied: boolean;
  passed: boolean;
  pushed: boolean;
  branch: string;
  test_output: string;
}

export async function applyTestAndPush(
  repoPath: string,
  alertId: string,
  diff: string,
  testCmd: string
): Promise<ApplyTestPushResult> {
  const branch = `fieldfix/fix-${alertId}`;
  const base: ApplyTestPushResult = { applied: false, passed: false, pushed: false, branch, test_output: "" };

  const wt = await applyInWorktree(repoPath, alertId, diff);
  if (!wt.success) return { ...base, test_output: wt.output };
  base.applied = true;

  const run = await runCommand(testCmd, wt.worktreePath);
  base.passed = run.passed;
  base.test_output = run.output;

  if (run.passed) {
    try {
      const wtGit = simpleGit(wt.worktreePath);
      await wtGit.add("-A");
      await wtGit.commit(`fix: FieldFix automated fix for alert ${alertId}`);
      await wtGit.push("origin", branch);
      base.pushed = true;
    } catch (err: any) {
      base.test_output += `\npush failed: ${err.message}`;
    }
  }

  await simpleGit(repoPath).raw(["worktree", "remove", wt.worktreePath, "--force"]).catch(() => {});
  return base;
}

export async function removeWorktree(repoPath: string, worktreePath: string): Promise<void> {
  await simpleGit(repoPath).raw(["worktree", "remove", worktreePath, "--force"]);
}
