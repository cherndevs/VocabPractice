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
