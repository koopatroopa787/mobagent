// Applies an approved diff in an isolated git worktree so the user's
// working branch is never modified. Satisfies CLAUDE.md constraint #5.

import simpleGit from "simple-git";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

export async function removeWorktree(repoPath: string, worktreePath: string): Promise<void> {
  await simpleGit(repoPath).raw(["worktree", "remove", worktreePath, "--force"]);
}
