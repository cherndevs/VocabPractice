import { describe, expect, it } from "vitest";
import type { RecogniserEvent } from "./read-flow";
import { createRecogniser, type RecognitionConstructor } from "./speech-recogniser";

// A stand-in for the browser's recogniser that the test drives by hand.
class FakeRecognition {
  static last: FakeRecognition;
  lang = "";
  maxAlternatives = 0;
  interimResults = true;
  continuous = true;
  onstart: (() => void) | null = null;
  onresult: ((e: { results: { transcript: string }[][] }) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  aborted = false;
  constructor() {
    FakeRecognition.last = this;
  }
  start() {}
  stop() {}
  abort() {
    this.aborted = true;
  }
}

function setup() {
  const events: RecogniserEvent[] = [];
  let fireTimer: (() => void) | null = null;
  let timerMs = 0;
  const recogniser = createRecogniser({
    api: FakeRecognition as unknown as RecognitionConstructor,
    setTimer: (fn, ms) => {
      fireTimer = fn;
      timerMs = ms;
      return () => {
        fireTimer = null;
      };
    },
  });
  return {
    recogniser,
    events,
    begin: (lang: "zh-CN" | "en-US" = "en-US") => recogniser.start(lang, (e) => events.push(e)),
    fire: () => fireTimer?.(),
    timerMs: () => timerMs,
    fake: () => FakeRecognition.last,
  };
}

describe("speech recogniser adapter", () => {
  it("asks for the language, five alternatives and no interim results", () => {
    const t = setup();
    t.begin("zh-CN");
    expect(t.fake()).toMatchObject({ lang: "zh-CN", maxAlternatives: 5, interimResults: false });
  });

  it("reports the heard alternatives and releases the microphone", () => {
    const t = setup();
    t.begin();
    t.fake().onstart?.();
    t.fake().onresult?.({ results: [[{ transcript: "two", confidence: 0.9 }, { transcript: "too", confidence: 0.2 }]] });
    expect(t.events).toEqual([{ kind: "heard", alternatives: ["two", "too"], confidences: [0.9, 0.2] }]);
    expect(t.fake().aborted).toBe(true);
  });

  it("reports no-speech, aborted and other errors as silence", () => {
    for (const error of ["no-speech", "aborted", "audio-capture"]) {
      const t = setup();
      t.begin();
      t.fake().onerror?.({ error });
      expect(t.events).toEqual([{ kind: "silence" }]);
    }
  });

  it("reports errors that mean it can't run", () => {
    for (const error of ["not-allowed", "service-not-allowed", "network", "language-not-supported"]) {
      const t = setup();
      t.begin();
      t.fake().onerror?.({ error });
      expect(t.events).toEqual([{ kind: "error", error }]);
    }
  });

  it("reports silence when it ends having heard nothing", () => {
    const t = setup();
    t.begin();
    t.fake().onstart?.();
    t.fake().onend?.();
    expect(t.events).toEqual([{ kind: "silence" }]);
  });

  it("reports a hang, and aborts, if it hasn't started listening in about 3 seconds", () => {
    const t = setup();
    t.begin();
    expect(t.timerMs()).toBe(3000);
    const instance = t.fake();
    t.fire();
    expect(t.events).toEqual([{ kind: "hang" }]);
    expect(instance.aborted).toBe(true);
  });

  it("doesn't call it a hang once listening has started", () => {
    const t = setup();
    t.begin();
    t.fake().onstart?.();
    t.fire();
    expect(t.events).toEqual([]);
  });

  it("reports silence if the browser never answers a stop", () => {
    const t = setup();
    t.begin();
    t.fake().onstart?.();
    t.recogniser.stop();
    expect(t.timerMs()).toBe(5000);
    t.fire();
    expect(t.events).toEqual([{ kind: "silence" }]);
    expect(t.fake().aborted).toBe(true);
  });

  it("reports nothing after an abort", () => {
    const t = setup();
    t.begin();
    const instance = t.fake();
    t.recogniser.abort();
    instance.onresult?.({ results: [[{ transcript: "late" }]] });
    expect(t.events).toEqual([]);
    expect(instance.aborted).toBe(true);
  });

  it("reports unsupported when the browser has no recogniser", () => {
    const events: RecogniserEvent[] = [];
    const recogniser = createRecogniser({ api: null });
    expect(recogniser.supported).toBe(false);
    recogniser.start("en-US", (e) => events.push(e));
    expect(events).toEqual([{ kind: "error", error: "unsupported" }]);
  });
});
