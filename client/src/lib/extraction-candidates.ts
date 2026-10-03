import { dueDateSchema } from "@shared/schema";

export interface ExtractedCandidate {
  title: string;
  /** The Lesson (school unit) the sheet says this list belongs to, if any. */
  lesson: string | null;
  /** The day the sheet says the list is for (YYYY-MM-DD), if it names one. */
  dueDate: string | null;
  words: string[];
}

export interface SanitizeResult {
  candidates: ExtractedCandidate[];
  /** True when every candidate was dropped (or none arrived), so the caller
   * should offer a fallback to manual entry rather than showing nothing. */
  isEmpty: boolean;
}

/**
 * Turns the model's raw extraction response into the candidates the UI should
 * show. The response arrives shape-checked by the extraction endpoint's JSON
 * schema, but this is the app's guard against a well-formed response carrying
 * junk (blank entries, wrong types) — it never throws.
 *
 * Rules: entries are trimmed, blanks and non-strings dropped individually; a
 * candidate is dropped only if nothing valid is left in it. Blank titles fall
 * back to `defaultTitle`, numbered — "(1)", "(2)", ... — only when more than
 * one candidate in the batch needs the fallback, so a single candidate's
 * title isn't needlessly decorated.
 */
export function sanitizeExtractedCandidates(
  raw: unknown,
  defaultTitle: string,
): SanitizeResult {
  const rawCandidates = isRecord(raw) && Array.isArray(raw.candidates) ? raw.candidates : [];

  const cleaned = rawCandidates
    .map((candidate) => sanitizeOne(candidate))
    .filter((candidate): candidate is Omit<ExtractedCandidate, "title"> & { title: string | null } =>
      candidate !== null,
    );

  const fallbackCount = cleaned.filter((c) => c.title === null).length;
  let fallbackIndex = 0;

  const candidates = cleaned.map(({ title, lesson, dueDate, words }) => {
    if (title !== null) return { title, lesson, dueDate, words };
    fallbackIndex += 1;
    return {
      title: fallbackCount > 1 ? `${defaultTitle} (${fallbackIndex})` : defaultTitle,
      lesson,
      dueDate,
      words,
    };
  });

  return { candidates, isEmpty: candidates.length === 0 };
}

/** Sanitizes one candidate, or returns null if it has no valid words left. */
function sanitizeOne(
  candidate: unknown,
): { title: string | null; lesson: string | null; dueDate: string | null; words: string[] } | null {
  if (!isRecord(candidate)) return null;

  const words = Array.isArray(candidate.words)
    ? candidate.words.filter((w): w is string => typeof w === "string").map((w) => w.trim()).filter((w) => w.length > 0)
    : [];

  if (words.length === 0) return null;

  const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
  const lesson = typeof candidate.lesson === "string" ? candidate.lesson.trim() : "";
  return {
    title: title.length > 0 ? title : null,
    lesson: lesson.length > 0 ? lesson : null,
    dueDate: cleanDueDate(candidate.dueDate),
    words,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** A real YYYY-MM-DD date, or null: the model's guess is only kept if the API would accept it. */
function cleanDueDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && dueDateSchema.safeParse(trimmed).success ? trimmed : null;
}
