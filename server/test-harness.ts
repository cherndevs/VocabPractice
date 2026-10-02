import express from "express";
import type { AddressInfo } from "net";
import type { Server } from "http";
import { registerRoutes } from "./routes";
import { MemStorage } from "./storage";

export interface TestApi {
  url: string;
  close(): Promise<void>;
  /** Moves the server's clock (it starts at a fixed instant). */
  setNow(now: Date): void;
  request(method: string, path: string, body?: unknown): Promise<{ status: number; body: any }>;
}

// Mounts the real routes on an ephemeral port over fresh in-memory storage.
// Tests drive it with fetch and assert only on status codes and bodies.
export async function startTestApi(): Promise<TestApi> {
  const app = express();
  app.use(express.json());
  let now = new Date("2026-01-05T09:00:00Z");
  const server: Server = await registerRoutes(app, new MemStorage(), { now: () => now });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    url,
    setNow: (next) => {
      now = next;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
    async request(method, path, body) {
      const res = await fetch(url + path, {
        method,
        headers: body === undefined ? {} : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : undefined };
    },
  };
}
