import { describe, expect, it } from "vitest";
import { createGradeOutbox, type OutboxGrade, type OutboxStorage } from "./grade-outbox";

function setup({ online = true }: { online?: boolean } = {}) {
  const data = new Map<string, string>();
  const storage: OutboxStorage = {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
  const sent: OutboxGrade[][] = [];
  const timers: Array<{ fn: () => void; ms: number; cancelled: boolean }> = [];
  const state = { online, ids: 0, clock: 0 };
  const build = () =>
    createGradeOutbox({
      storage,
      send: async (grades) => {
        if (!state.online) throw new Error("offline");
        sent.push(grades);
      },
      newId: () => `id${++state.ids}`,
      now: () => new Date(Date.UTC(2026, 0, 5, 9, 0, state.clock++)),
      setTimer: (fn, ms) => {
        const t = { fn, ms, cancelled: false };
        timers.push(t);
        return () => {
          t.cancelled = true;
        };
      },
    });
  return { storage, sent, timers, state, outbox: build(), build };
}

const oops = (word: string) => ({ subject: "english" as const, word, skill: "spelling" as const, grade: "again" as const, sessionId: "s1" });
const got = (word: string) => ({ ...oops(word), grade: "good" as const });
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("grade outbox", () => {
  it("keeps grades queued while offline, in order, and sends them once back online", async () => {
    const { outbox, sent, state } = setup({ online: false });
    outbox.add(oops("apple"));
    outbox.add(got("pear"));
    await tick();
    expect(sent).toEqual([]);
    expect(outbox.pending()).toBe(2);

    state.online = true;
    await outbox.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0].map((g) => g.word)).toEqual(["apple", "pear"]);
    expect(sent[0].map((g) => g.grade)).toEqual(["again", "good"]);
    expect(outbox.pending()).toBe(0);
  });

  it("drops an entry only after the send succeeds", async () => {
    const { outbox, state } = setup({ online: false });
    outbox.add(oops("apple"));
    await outbox.flush();
    expect(outbox.pending()).toBe(1);

    state.online = true;
    await outbox.flush();
    expect(outbox.pending()).toBe(0);
  });

  it("persists across a reload and sends with the same ids", async () => {
    const first = setup({ online: false });
    const entry = first.outbox.add(oops("apple"));
    await tick();

    const reloaded = first.build();
    first.state.online = true;
    await reloaded.flush();
    expect(first.sent[0].map((g) => g.id)).toEqual([entry.id]);
  });

  it("gives each grade a client id and the time it was marked", () => {
    const { outbox } = setup({ online: false });
    const a = outbox.add(oops("apple"));
    const b = outbox.add(oops("pear"));
    expect(a.id).not.toBe(b.id);
    expect(new Date(a.gradedAt).getTime()).toBeLessThan(new Date(b.gradedAt).getTime());
  });

  it("retries with growing backoff after a failure", async () => {
    const { outbox, timers } = setup({ online: false });
    outbox.add(oops("apple"));
    await tick();
    expect(timers.map((t) => t.ms)).toEqual([2000]);

    await outbox.flush();
    await outbox.flush();
    expect(timers.filter((t) => !t.cancelled).map((t) => t.ms)).toEqual([8000]);
  });

  it("keeps grades added while a send is in flight", async () => {
    const { outbox, sent, storage } = setup();
    outbox.add(oops("apple"));
    outbox.add(oops("pear")); // queued behind the in-flight flush
    await tick();
    await outbox.flush();
    expect(sent.flat().map((g) => g.word)).toEqual(["apple", "pear"]);
    expect(JSON.parse(storage.getItem("gradeOutbox:v1")!)).toEqual([]);
  });

  it("copes with unreadable stored data", async () => {
    const { outbox, storage } = setup();
    storage.setItem("gradeOutbox:v1", "{not json");
    expect(outbox.pending()).toBe(0);
  });
});
