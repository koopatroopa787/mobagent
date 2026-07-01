import { randomUUID } from "node:crypto";

export type DiffStatus = "pending" | "applying" | "passed" | "failed" | "rejected";

export interface DiffEntry {
  id: string;
  alert_id: string;
  file: string;
  diff: string;
  explanation: string;
  generated_by: "daemon" | "on_device";
  status: DiffStatus;
  test_output?: string;
  branch?: string;
  created_at: Date;
}

export class DiffStore {
  private store = new Map<string, DiffEntry>();

  add(entry: Omit<DiffEntry, "id" | "status" | "created_at">): DiffEntry {
    const d: DiffEntry = { ...entry, id: randomUUID(), status: "pending", created_at: new Date() };
    this.store.set(d.id, d);
    return d;
  }

  get(id: string): DiffEntry | undefined {
    return this.store.get(id);
  }

  list(): DiffEntry[] {
    return [...this.store.values()];
  }

  // ponytail: no query API, scan is fine at prototype scale
  findPending(alertId: string): DiffEntry | undefined {
    return [...this.store.values()].find(d => d.alert_id === alertId && d.status === "pending");
  }

  update(id: string, patch: Partial<Pick<DiffEntry, "status" | "test_output" | "branch">>): boolean {
    const d = this.store.get(id);
    if (!d) return false;
    Object.assign(d, patch);
    return true;
  }
}
