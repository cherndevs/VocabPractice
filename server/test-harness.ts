import express from "express";
import type { AddressInfo } from "net";
import type { Server } from "http";
import { registerRoutes } from "./routes";
import { MemStorage } from "./storage";
import type { GenerateMeanings, MeaningRequest } from "./meanings";

export interface TestApi {
  url: string;
  close(): Promise<void>;
  /** Moves the server's clock (it starts at a fixed instant). */
  setNow(now: Date): void;
  /**
   * Replaces the AI call behind Meanings. The default answers each missing
   * item with "meaning of <item>" and records what it was asked.
   */
  setGenerateMeanings(generate: GenerateMeanings): void;
  /** Every call made to the default meanings generator, oldest first. */
  meaningCalls: MeaningRequest[];
  request(method: string, path: string, body?: unknown): Promise<{ status: number; body: any }>;
}

// Mounts the real routes on an ephemeral port over fresh in-memory storage.
// Tests drive it with fetch and assert only on status codes and bodies.
export async function startTestApi(): Promise<TestApi> {
  const app = express();
  app.use(express.json());
  let now = new Date("2026-01-05T09:00:00Z");
  const meaningCalls: TestApi["meaningCalls"] = [];
  let generate: GenerateMeanings = async (request) => {
    meaningCalls.push(request);
    const { missing } = request;
    return Object.fromEntries(missing.map((m) => [m, `meaning of ${m}`]));
  };
  const server: Server = await registerRoutes(app, new MemStorage(), {
    now: () => now,
    generateMeanings: (request) => generate(request),
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    url,
    meaningCalls,
    setNow: (next) => {
      now = next;
    },
    setGenerateMeanings: (next) => {
      generate = next;
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
