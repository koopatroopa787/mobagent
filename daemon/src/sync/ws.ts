// WebSocket session manager. Routes incoming protocol messages
// (see shared/protocol.md) to registered handlers and exposes
// broadcast/send helpers used by webhook and approval flows.

export interface Socket {
  readyState: number;
  OPEN: number;
  send(data: string): void;
  on(event: string, cb: (...args: any[]) => void): void;
}

type Handler = (msg: Record<string, unknown>, socket: Socket) => void | Promise<void>;

export class SyncSession {
  private sockets = new Set<Socket>();
  private handlers = new Map<string, Handler>();

  on(type: string, handler: Handler): void {
    this.handlers.set(type, handler);
  }

  add(socket: Socket): void {
    this.sockets.add(socket);
    socket.on("message", (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
        const handler = this.handlers.get(msg.type as string);
        if (handler) void handler(msg, socket);
      } catch {
        this.send(socket, { type: "ERROR", detail: "invalid JSON" });
      }
    });
    socket.on("close", () => this.sockets.delete(socket));
  }

  broadcast(msg: Record<string, unknown>): void {
    const payload = JSON.stringify(msg);
    for (const s of this.sockets) {
      if (s.readyState === s.OPEN) s.send(payload);
    }
  }

  send(socket: Socket, msg: Record<string, unknown>): void {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg));
  }
}
