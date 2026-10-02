import { pinyin } from "pinyin-pro";

const CJK_CHAR = /[一-鿿]/;
const NON_CJK = /[^一-鿿]/g;
const NON_WORD = /[^a-z0-9\u00c0-\u024f]/g;

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
  return text.toLowerCase().replace(NON_WORD, "");
}

function matchesChinese(target: string, alternatives: string[]): boolean {
  const targetChars = Array.from(target.replace(NON_CJK, ""));
  if (targetChars.length === 0) return false;

  let targetSyllables: string[] | null | undefined;
  return alternatives.some((alternative) => {
    const heardChars = Array.from(alternative.replace(NON_CJK, ""));
    if (heardChars.length !== targetChars.length) return false;
    if (heardChars.every((char, i) => char === targetChars[i])) return true;

    // Same conversion as Peek's Pinyin Annotation: the whole word at once.
    targetSyllables ??= wholeWordSyllables(targetChars.join(""));
    if (!targetSyllables) return false;
    return heardChars.every((char, i) => readingsOf(char).includes(targetSyllables![i]));
  });
}

function wholeWordSyllables(word: string): string[] | null {
  const syllables = pinyin(word, { toneType: "symbol", type: "array" }) as string[];
  return syllables.length === Array.from(word).length ? syllables : null;
}

/** Every reading pinyin-pro knows for one character; a non-Chinese or unknown character has none. */
function readingsOf(char: string): string[] {
  if (!CJK_CHAR.test(char)) return [];
  const all = pinyin(char, { toneType: "symbol", type: "array", multiple: true }) as string[];
  return all.filter((reading) => reading !== char);
}
