const DIGITS: Record<string, number> = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

// Reads a Chinese numeral up to 99 (e.g. 十七, 二十, 三十五).
function chineseNumber(text: string): number | null {
  if (text.includes("十")) {
    const [tens, ones] = text.split("十");
    const t = tens === "" ? 1 : DIGITS[tens];
    const o = ones === "" ? 0 : DIGITS[ones];
    return t === undefined || o === undefined ? null : t * 10 + o;
  }
  return text.length === 1 && text in DIGITS ? DIGITS[text] : null;
}

/** The lesson number in a name like "第十七课·好孩子" or "Unit 3", or null. */
export function lessonNumber(name: string): number | null {
  const chinese = name.match(/第([零一二两三四五六七八九十]+)[课单元]/);
  if (chinese) return chineseNumber(chinese[1]);
  const digits = name.match(/\d+/);
  return digits ? Number(digits[0]) : null;
}

/** Orders Lesson names by lesson number (numbered first), then by name. */
export function compareLessonNames(a: string, b: string): number {
  const na = lessonNumber(a);
  const nb = lessonNumber(b);
  if (na !== nb) {
    if (na === null) return 1;
    if (nb === null) return -1;
    return na - nb;
  }
  return a.localeCompare(b);
}

/** Lesson names ordered by `compareLessonNames`. */
export function sortLessonNames(names: string[]): string[] {
  return [...names].sort(compareLessonNames);
}

// Drops punctuation and spaces so "第十七课《好孩子》" matches "第十七课·好孩子".
const normalize = (text: string) => text.toLowerCase().replace(/[\s.,:;!?·•\-_'"“”‘’()（）《》〈〉「」【】，。、：；！？]/g, "");

/** Lessons whose name appears in (or contains) the session title. */
export function lessonsMatchingTitle(title: string, names: string[]): string[] {
  const t = normalize(title);
  if (!t) return [];
  return names.filter((name) => {
    const n = normalize(name);
    return n !== "" && (t.includes(n) || n.includes(t));
  });
}
