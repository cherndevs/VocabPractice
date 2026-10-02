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
  return matchKind(target, alternatives) !== null;
}

/** How a match was made: the very same text, or (Chinese only) the same tone-marked pinyin. Null if none. */
export type MatchKind = "same-text" | "same-pinyin";

export function matchKind(target: string, alternatives: string[]): MatchKind | null {
  if (recognitionLang(target) === "zh-CN") {
    return matchKindChinese(target, alternatives);
  }
  const want = normalizeEnglish(target);
  return alternatives.some((heard) => normalizeEnglish(heard) === want) ? "same-text" : null;
}

function normalizeEnglish(text: string): string {
  return text.toLowerCase().replace(EDGE_NON_WORD, "");
}

function matchKindChinese(target: string, alternatives: string[]): MatchKind | null {
  const targetChars = Array.from(target.replace(NON_CJK, ""));
  if (targetChars.length === 0) return null;

  // Same conversion as Peek's Pinyin Annotation: the whole word at once.
  const targetSyllables = wholeWordSyllables(targetChars.join(""));
  let kind: MatchKind | null = null;
  for (const alternative of alternatives) {
    const heardChars = Array.from(alternative.replace(NON_CJK, ""));
    if (heardChars.length !== targetChars.length) continue;
    if (heardChars.every((char, i) => char === targetChars[i])) return "same-text";
    if (targetSyllables && heardChars.every((char, i) => knownReadings(char).includes(targetSyllables[i]))) {
      kind = "same-pinyin";
    }
  }
  return kind;
}

/** Every reading pinyin-pro knows for one character; a non-Chinese or unknown character has none. */
function knownReadings(char: string): string[] {
  if (!CJK_CHAR.test(char)) return [];
  const all = pinyin(char, { toneType: "symbol", type: "array", multiple: true }) as string[];
  return all.filter((reading) => reading !== char);
}
