import { pinyin } from "pinyin-pro";
import { CJK_CHAR, wholeWordSyllables } from "./pinyin";

const NON_CJK = /[^一-鿿]/g;
const EDGE_NON_WORD = /^[^a-z0-9\u00c0-\u024f]+|[^a-z0-9\u00c0-\u024f]+$/g;

export type RecognitionLang = "zh-CN" | "en-US";

/** The recogniser `lang` for a target word: Chinese if it has CJK characters, else English. */
export function recognitionLang(target: string): RecognitionLang {
  return CJK_CHAR.test(target) ? "zh-CN" : "en-US";
}

/**
 * Decides whether any of the recogniser's alternatives counts as reading
 * `target` correctly (ADR-0009). Pure: no UI, no browser APIs.
 */
export function matchesTarget(target: string, alternatives: string[]): boolean {
  if (recognitionLang(target) === "zh-CN") {
    return matchesChinese(target, alternatives);
  }
  const want = normalizeEnglish(target);
  return alternatives.some((heard) => normalizeEnglish(heard) === want);
}

function normalizeEnglish(text: string): string {
  return text.toLowerCase().replace(EDGE_NON_WORD, "");
}

function matchesChinese(target: string, alternatives: string[]): boolean {
  const targetChars = Array.from(target.replace(NON_CJK, ""));
  if (targetChars.length === 0) return false;

  // Same conversion as Peek's Pinyin Annotation: the whole word at once.
  const targetSyllables = wholeWordSyllables(targetChars.join(""));
  return alternatives.some((alternative) => {
    const heardChars = Array.from(alternative.replace(NON_CJK, ""));
    if (heardChars.length !== targetChars.length) return false;
    if (heardChars.every((char, i) => char === targetChars[i])) return true;

    if (!targetSyllables) return false;
    return heardChars.every((char, i) => knownReadings(char).includes(targetSyllables[i]));
  });
}

/** Every reading pinyin-pro knows for one character; a non-Chinese or unknown character has none. */
function knownReadings(char: string): string[] {
  if (!CJK_CHAR.test(char)) return [];
  const all = pinyin(char, { toneType: "symbol", type: "array", multiple: true }) as string[];
  return all.filter((reading) => reading !== char);
}
