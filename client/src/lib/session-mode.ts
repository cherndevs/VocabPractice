import type { SessionType } from "@shared/schema";

export type SessionViewMode = "read" | "write" | "peek";

/**
 * Peek has nothing to show for a word with no pinyin, so if the current
 * word changes out from under an open Peek tab, fall back to Read.
 */
export function resolveSessionViewMode(
  mode: SessionViewMode,
  currentWordHasPinyin: boolean,
): SessionViewMode {
  if (mode === "peek" && !currentWordHasPinyin) return "read";
  return mode;
}

/**
 * A session's type decides which views it offers (ADR-0008): Spelling is
 * dictation only; Reading is Read, with Peek to check a guess.
 */
export function viewsForSessionType(type: SessionType): SessionViewMode[] {
  return type === "spelling" ? ["write"] : ["read", "peek"];
}

export function initialViewMode(type: SessionType): SessionViewMode {
  return viewsForSessionType(type)[0];
}
