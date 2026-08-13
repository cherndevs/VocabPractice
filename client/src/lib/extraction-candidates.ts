export interface ExtractedCandidate {
  title: string;
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

  const candidates = cleaned.map(({ title, words }) => {
    if (title !== null) return { title, words };
    fallbackIndex += 1;
    return {
      title: fallbackCount > 1 ? `${defaultTitle} (${fallbackIndex})` : defaultTitle,
      words,
    };
  });

  return { candidates, isEmpty: candidates.length === 0 };
}

/** Sanitizes one candidate, or returns null if it has no valid words left. */
function sanitizeOne(candidate: unknown): { title: string | null; words: string[] } | null {
  if (!isRecord(candidate)) return null;

  const words = Array.isArray(candidate.words)
    ? candidate.words.filter((w): w is string => typeof w === "string").map((w) => w.trim()).filter((w) => w.length > 0)
    : [];

  if (words.length === 0) return null;

  const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
  return { title: title.length > 0 ? title : null, words };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
