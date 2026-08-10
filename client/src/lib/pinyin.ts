import { pinyin } from "pinyin-pro";

const CJK_CHAR = /[一-鿿]/;
const RUN_PATTERN = /[一-鿿]+|[^一-鿿]+/g;

/**
 * Returns the pinyin annotation line for a word, or null if the word
 * contains no Chinese characters (no annotation should be shown at all).
 * Non-Chinese runs pass through untouched; unresolved CJK characters
 * (outside pinyin-pro's dictionary) are marked with "?" instead of being
 * silently echoed back, so dictionary gaps stay visible.
 */
export function getPinyinAnnotation(word: string): string | null {
  if (!CJK_CHAR.test(word)) return null;

  const runs = word.match(RUN_PATTERN) ?? [];
  const pieces = runs.map((run) => (CJK_CHAR.test(run) ? annotateChineseRun(run) : run.trim()));

  return pieces.filter((piece) => piece.length > 0).join(" ");
}

function annotateChineseRun(run: string): string {
  const syllables = pinyin(run, { toneType: "symbol", type: "array" }) as string[];
  const chars = Array.from(run);
  if (syllables.length !== chars.length) {
    return chars.map(() => "?").join(" ");
  }
  return syllables.map((syllable, i) => (syllable === chars[i] ? "?" : syllable)).join(" ");
}
