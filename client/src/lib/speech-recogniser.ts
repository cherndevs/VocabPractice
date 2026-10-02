import { isUnavailableError, type RecogniserEvent } from "./read-flow";
import type { RecognitionLang } from "./read-aloud-matcher";

// The only code that touches SpeechRecognition / webkitSpeechRecognition (ADR-0009).
// It reports what one attempt heard as a RecogniserEvent and nothing else.

const START_TIMEOUT_MS = 3000;
// After "done", how long the browser gets to deliver a result before the attempt counts as unheard.
const RESULT_TIMEOUT_MS = 5000;
const MAX_ALTERNATIVES = 5;

// The slice of the browser API this adapter uses.
interface RecognitionResultAlternative {
  transcript: string;
  confidence?: number;
}
interface RecognitionInstance {
  lang: string;
  maxAlternatives: number;
  interimResults: boolean;
  continuous: boolean;
  onstart: (() => void) | null;
  onresult: ((event: { results: ArrayLike<ArrayLike<RecognitionResultAlternative>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
export type RecognitionConstructor = new () => RecognitionInstance;

export interface Recogniser {
  /** False where the browser has no recogniser at all. */
  supported: boolean;
  /** Starts one attempt; `onEvent` is called once with how it ended. */
  start(lang: RecognitionLang, onEvent: (event: RecogniserEvent) => void): void;
  /** Asks the recogniser to finish and report what it has heard. */
  stop(): void;
  /** Cancels the attempt and releases the microphone, reporting nothing. */
  abort(): void;
}

export interface RecogniserOptions {
  api?: RecognitionConstructor | null;
  /** Returns a function that cancels the timer. Injectable for tests. */
  setTimer?: (fn: () => void, ms: number) => () => void;
  startTimeoutMs?: number;
}

function browserApi(): RecognitionConstructor | null {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isRecogniserSupported(): boolean {
  return browserApi() !== null;
}

export function createRecogniser(options: RecogniserOptions = {}): Recogniser {
  const api = options.api === undefined ? browserApi() : options.api;
  const setTimer =
    options.setTimer ??
    ((fn, ms) => {
      const handle = setTimeout(fn, ms);
      return () => clearTimeout(handle);
    });
  const startTimeoutMs = options.startTimeoutMs ?? START_TIMEOUT_MS;
  let finishAttempt: ((event: RecogniserEvent | null) => void) | null = null;
  let current: RecognitionInstance | null = null;
  let stopTimer: (() => void) | null = null;

  function release(instance: RecognitionInstance) {
    instance.onstart = instance.onresult = instance.onerror = instance.onend = null;
    try {
      instance.abort();
    } catch {
      // Already stopped.
    }
  }

  function abort() {
    finishAttempt?.(null);
  }

  return {
    supported: api !== null,

    start(lang, onEvent) {
      abort();
      if (!api) {
        onEvent({ kind: "error", error: "unsupported" });
        return;
      }
      const instance = new api();
      current = instance;
      let started = false;
      let finished = false;
      const cancelTimer = setTimer(() => {
        if (started) return;
        finish({ kind: "hang" });
      }, startTimeoutMs);

      // Ends the attempt exactly once, always releasing the microphone.
      function finish(event: RecogniserEvent | null) {
        if (finished) return;
        finished = true;
        cancelTimer();
        stopTimer?.();
        stopTimer = null;
        release(instance);
        if (current === instance) current = null;
        finishAttempt = null;
        if (event) onEvent(event);
      }
      finishAttempt = finish;

      instance.lang = lang;
      instance.maxAlternatives = MAX_ALTERNATIVES;
      instance.interimResults = false;
      instance.continuous = false;
      instance.onstart = () => {
        started = true;
        cancelTimer();
      };
      instance.onresult = (event) => {
        const heard = Array.from(event.results[0] ?? []);
        finish(
          heard.length > 0
            ? { kind: "heard", alternatives: heard.map((alt) => alt.transcript), confidences: heard.map((alt) => alt.confidence ?? 0) }
            : { kind: "silence" },
        );
      };
      instance.onerror = (event) => {
        // Only errors that mean it can't run here are reported as such; the rest
        // (no-speech, aborted, anything before audio) are just an unheard attempt.
        finish(isUnavailableError(event.error) ? { kind: "error", error: event.error } : { kind: "silence" });
      };
      instance.onend = () => finish({ kind: "silence" });
      try {
        instance.start();
      } catch {
        finish({ kind: "silence" });
      }
    },

    stop() {
      const instance = current;
      if (!instance) return;
      try {
        instance.stop();
      } catch {
        // Not running.
      }
      // Safari may never answer a stop; don't leave the word waiting.
      stopTimer?.();
      stopTimer = setTimer(() => {
        if (current === instance) finishAttempt?.({ kind: "silence" });
      }, RESULT_TIMEOUT_MS);
    },

    abort,
  };
}
