import { spawn } from "node:child_process";

export interface RunResult {
  passed: boolean;
  output: string;
  exit_code: number;
}

// ponytail: shell:true so callers pass a plain command string ("pytest", "npm test")
export function runCommand(cmdLine: string, cwd: string): Promise<RunResult> {
  return new Promise((resolve) => {
    const proc = spawn(cmdLine, { cwd, shell: true });
    const chunks: Buffer[] = [];
    proc.stdout.on("data", (d: Buffer) => chunks.push(d));
    proc.stderr.on("data", (d: Buffer) => chunks.push(d));
    proc.on("close", (code: number | null) => {
      resolve({ passed: code === 0, output: Buffer.concat(chunks).toString(), exit_code: code ?? 1 });
    });
  });
}
