import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import fs from "fs";
import os from "os";
import path from "path";
import type { AddressInfo } from "net";
import type { Server } from "http";
import { serveStatic } from "./vite";

// A refresh must reach the latest deploy: the HTML shell and the service worker
// are revalidated on every load, while the hashed bundles cache normally.
describe("serveStatic caching", () => {
  let server: Server;
  let url: string;
  let dist: string;

  beforeAll(async () => {
    dist = fs.mkdtempSync(path.join(os.tmpdir(), "dist-"));
    fs.writeFileSync(path.join(dist, "index.html"), "<html></html>");
    fs.writeFileSync(path.join(dist, "sw.js"), "");
    fs.mkdirSync(path.join(dist, "assets"));
    fs.writeFileSync(path.join(dist, "assets", "index-abc123.js"), "");

    const app = express();
    serveStatic(app, dist);
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dist, { recursive: true, force: true });
  });

  const cacheControl = async (p: string) => (await fetch(url + p)).headers.get("cache-control");

  it("revalidates the HTML shell at / and on SPA routes", async () => {
    expect(await cacheControl("/")).toBe("no-cache");
    expect(await cacheControl("/index.html")).toBe("no-cache");
    expect(await cacheControl("/practice/42")).toBe("no-cache");
  });

  it("revalidates the service worker", async () => {
    expect(await cacheControl("/sw.js")).toBe("no-cache");
  });

  it("leaves hashed bundles on default caching", async () => {
    expect(await cacheControl("/assets/index-abc123.js")).not.toBe("no-cache");
  });
});
