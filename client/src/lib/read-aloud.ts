import { pinyin } from "pinyin-pro";
import { CJK_CHAR, getPinyinAnnotation } from "./pinyin";

const NON_CJK = /[^一-鿿]/g;
const SURROUNDING_NON_WORD = /^[\s!-/:-@\[-`{-~\u2000-\u206f\u3000-\u303f\uff00-\uff0f\uff1a-\uff20\uff3b-\uff40\uff5b-\uff65]+|[\s!-/:-@\[-`{-~\u2000-\u206f\u3000-\u303f\uff00-\uff0f\uff1a-\uff20\uff3b-\uff40\uff5b-\uff65]+$/g;
const NON_WORD = /[\s!-/:-@\[-`{-~\u2000-\u206f\u3000-\u303f\uff00-\uff0f\uff1a-\uff20\uff3b-\uff40\uff5b-\uff65]/g;

export type ReadAloudLang = "zh-CN" | "en-US";

/** The recogniser `lang` for a target word: CJK characters mean Chinese. */
export function readAloudLang(target: string): ReadAloudLang {
  return CJK_CHAR.test(target) ? "zh-CN" : "en-US";
}

/**
 * Whether any of the recogniser's alternatives counts as reading `target`
 * correctly (ADR-0009).
 */
export function matchesReadAloud(target: string, alternatives: string[]): boolean {
  return readAloudLang(target) === "zh-CN"
    ? matchesChinese(target, alternatives)
    : matchesEnglish(target, alternatives);
}

function matchesEnglish(target: string, alternatives: string[]): boolean {
  const wanted = normalizeEnglish(target);
  return alternatives.some((heard) => normalizeEnglish(heard) === wanted);
}

function normalizeEnglish(text: string): string {
  return text.trim().replace(SURROUNDING_NON_WORD, "").toLowerCase();
}

function matchesChinese(target: string, alternatives: string[]): boolean {
  const targetChars = Array.from(target.replace(NON_WORD, ""));
  const heardList = alternatives.map((alt) => Array.from(alt.replace(NON_WORD, "")));

  if (heardList.some((heard) => sameChars(heard, targetChars))) return true;

  const syllables = targetSyllables(target);
  if (!syllables) return false;
  return heardList.some((heard) => soundsLike(heard, syllables));
}

function sameChars(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((ch, i) => ch === b[i]);
}

/** The target's tone-marked syllables, as Peek shows them; null if unresolved. */
function targetSyllables(target: string): string[] | null {
  const cjkOnly = target.replace(NON_CJK, "");
  const annotation = getPinyinAnnotation(cjkOnly);
  if (!annotation) return null;
  const syllables = annotation.split(" ");
  if (syllables.length !== Array.from(cjkOnly).length || syllables.includes("?")) return null;
  return syllables;
}

function soundsLike(heard: string[], syllables: string[]): boolean {
  return (
    heard.length === syllables.length &&
    heard.every((ch, i) => charReadings(ch).includes(syllables[i]))
  );
}

function charReadings(ch: string): string[] {
  if (!CJK_CHAR.test(ch)) return [];
  return pinyin(ch, { toneType: "symbol", type: "array", multiple: true }) as string[];
}
