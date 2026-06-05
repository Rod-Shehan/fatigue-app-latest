import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  OFFLINE_AUTH_MAX_AGE_MS,
  clearOfflineAuth,
  getOfflineAuth,
  isDriverOfflineSnapshot,
  saveOfflineAuth,
} from "@/lib/offline-auth";

describe("offline-auth", () => {
  beforeEach(() => {
    const storage = {
      store: {} as Record<string, string>,
      getItem(k: string) {
        return this.store[k] ?? null;
      },
      setItem(k: string, v: string) {
        this.store[k] = v;
      },
      removeItem(k: string) {
        delete this.store[k];
      },
    };
    vi.stubGlobal("window", { localStorage: storage });
    vi.stubGlobal("localStorage", storage);
    clearOfflineAuth();
  });

  it("saves and reads driver snapshot", () => {
    saveOfflineAuth({
      id: "u1",
      email: "driver@fleet.com",
      name: "Alex",
      role: null,
    });
    const snap = getOfflineAuth();
    expect(snap?.email).toBe("driver@fleet.com");
    expect(isDriverOfflineSnapshot(snap)).toBe(true);
  });

  it("rejects manager snapshot for driver offline", () => {
    saveOfflineAuth({
      id: "m1",
      email: "mgr@fleet.com",
      name: "Boss",
      role: "manager",
    });
    expect(isDriverOfflineSnapshot(getOfflineAuth())).toBe(false);
  });

  it("rejects owner snapshot for driver offline", () => {
    saveOfflineAuth({
      id: "o1",
      email: "owner@fleet.com",
      name: "IT",
      role: "owner",
    });
    expect(isDriverOfflineSnapshot(getOfflineAuth())).toBe(false);
  });

  it("expires old snapshots", () => {
    saveOfflineAuth({ id: "u1", email: "a@b.com", name: "A", role: null });
    const raw = localStorage.getItem("fatigue-offline-auth");
    const parsed = JSON.parse(raw!);
    parsed.expiresAt = Date.now() - 1000;
    localStorage.setItem("fatigue-offline-auth", JSON.stringify(parsed));
    expect(getOfflineAuth()).toBeNull();
  });

  it("max age is 30 days", () => {
    expect(OFFLINE_AUTH_MAX_AGE_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });
});
