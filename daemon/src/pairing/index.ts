import { randomBytes, randomUUID } from "node:crypto";

export interface PairedDevice {
  session_id: string;
  device_name: string;
  paired_at: Date;
}

export class PairingRegistry {
  private readonly TOKEN_TTL_MS = 5 * 60 * 1000;
  private pending = new Map<string, Date>();
  private devices = new Map<string, PairedDevice>();

  generateToken(): string {
    const token = randomBytes(16).toString("hex");
    this.pending.set(token, new Date(Date.now() + this.TOKEN_TTL_MS));
    return token;
  }

  confirm(token: string, deviceName: string): PairedDevice | null {
    const expires = this.pending.get(token);
    if (!expires || expires < new Date()) {
      this.pending.delete(token);
      return null;
    }
    this.pending.delete(token);
    const device: PairedDevice = {
      session_id: randomUUID(),
      device_name: deviceName,
      paired_at: new Date(),
    };
    this.devices.set(device.session_id, device);
    return device;
  }

  isValid(sessionId: string): boolean {
    return this.devices.has(sessionId);
  }

  list(): PairedDevice[] {
    return [...this.devices.values()];
  }

  revoke(sessionId: string): boolean {
    return this.devices.delete(sessionId);
  }
}
