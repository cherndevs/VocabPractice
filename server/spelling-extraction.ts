/**
 * Relays a worksheet photo to Qwen3-VL-8B (via OpenRouter) and returns the
 * spelling sessions it reads off the page. Nothing here is persisted — the
 * image lives in memory for the duration of the request and is never
 * written to Postgres or to disk (ADR-0002). See ADR-0004 for why this
 * model and this two-call shape.
 */

// Validated against two real worksheets, one English and one Chinese. The
// pinyin rule is load-bearing: without it a model can let the printed
// romanization steer which character it reads (confirmed with Claude, where
// it produced the homophone 烤一烤 for 考一考 before this rule was added).
const EXTRACTION_PROMPT = `You extract spelling-list content from a photo of a worksheet or study sheet.
The image may contain one or more distinct spelling sessions/units (e.g. separate numbered lists, headed sections, or visually separated blocks). For each one you find, produce a candidate with a short title (use the worksheet's own heading/label if present, otherwise a brief descriptive title) and the list of words belonging to it, in the order they appear.
Rules:
- Only include actual vocabulary/spelling words. Ignore instructions, page numbers, dates, and other non-word text.
- Preserve original spelling and characters exactly as written, including non-English text (e.g. Chinese characters) — do not translate or romanize.
- Some words have small pinyin (romanized pronunciation) annotations printed above the Chinese characters. Ignore these pinyin annotations entirely — they are a reading aid, not the word. Transcribe only the Chinese character glyphs themselves. Since multiple different Chinese characters can share the same pinyin, do not let the pinyin influence which character you transcribe — read the actual character shape.
- If you cannot confidently read a word, omit it rather than guessing.
- If the image contains no discernible spelling list, return an empty array.`;

// A looser variant for the free-form extraction pass — same rules, no
// mention of JSON, since forcing structure on the vision call is exactly
// what was found to be unreliable on Chinese content with this model.
const FREEFORM_EXTRACTION_PROMPT = `List each spelling-list unit on this worksheet. For each unit, write its title on its own line, then each numbered word or sentence on its own line below it, exactly as printed.
Rules:
- Only include actual vocabulary/spelling words. Ignore instructions, page numbers, dates, and other non-word text.
- Preserve original spelling and characters exactly as written, including non-English text (e.g. Chinese characters) — do not translate or romanize.
- Some words have small pinyin (romanized pronunciation) annotations printed above the Chinese characters. Ignore these pinyin annotations entirely — they are a reading aid, not the word. Transcribe only the Chinese character glyphs themselves. Since multiple different Chinese characters can share the same pinyin, do not let the pinyin influence which character you transcribe — read the actual character shape.
- No commentary, no extra explanation, no translation — just the titles and the words/sentences.`;

const FORMAT_PROMPT_PREFIX =
  "Convert the following extracted worksheet content into structured data. " +
  "Each unit becomes a candidate with its title and its list of words/sentences. " +
  "Do not translate, alter, or reorder any text — pass every character through exactly as given.\n\n";

// OpenAI-compatible strict JSON schema, as OpenRouter expects it.
const CANDIDATES_SCHEMA = {
  type: "object",
  properties: {
    candidates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          words: { type: "array", items: { type: "string" } },
        },
        required: ["title", "words"],
        additionalProperties: false,
      },
    },
  },
  required: ["candidates"],
  additionalProperties: false,
} as const;

const RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "spelling_candidates",
    strict: true,
    schema: CANDIDATES_SCHEMA,
  },
} as const;

// Validated against real worksheets: cheap, accurate on English with a
// single structured-output call. On Chinese content specifically, a single
// call combining vision with a strict schema was found to silently return
// zero candidates rather than erroring — not a vision problem (the same
// model reads the same photo correctly with no schema attached), a
// structured-output problem. See ADR-0004. That's why extraction always
// tries the fast single-call path first, and falls back to a slower
// two-call path (free-form vision extraction, then a text-only formatting
// pass) whenever the fast path comes back empty — which also transparently
// covers the case where the photo genuinely has no spelling list on it, at
// the cost of one extra cheap call.
const MODEL = "qwen/qwen3-vl-8b-instruct";
const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export const SUPPORTED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

export type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number];

export type ExtractedCandidate = { title: string; words: string[] };

/** Upstream failure the caller can retry, as opposed to a bad request. */
export class ExtractionServiceError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ExtractionServiceError";
  }
}

function getApiKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new ExtractionServiceError(
      "Extraction is not configured on the server.",
      503,
    );
  }
  return apiKey;
}

async function callOpenRouter(
  apiKey: string,
  body: Record<string, unknown>,
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error("[extract] OpenRouter request failed", error);
    throw new ExtractionServiceError(
      "Could not reach the extraction service.",
      502,
    );
  }

  if (!res.ok) {
    console.error("[extract] OpenRouter returned an error status", res.status, await res.text());
    throw new ExtractionServiceError(
      "Could not reach the extraction service.",
      res.status === 429 ? 429 : 502,
    );
  }

  const parsed = await res.json();
  const content = parsed.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new ExtractionServiceError("Extraction returned no content.", 502);
  }
  return content;
}

function parseCandidates(json: string): ExtractedCandidate[] {
  try {
    return JSON.parse(json).candidates as ExtractedCandidate[];
  } catch (error) {
    console.error("[extract] Could not parse extraction response", error);
    throw new ExtractionServiceError("Extraction returned unreadable content.", 502);
  }
}

async function extractStructured(
  apiKey: string,
  image: Buffer,
  mediaType: SupportedMediaType,
): Promise<ExtractedCandidate[]> {
  const content = await callOpenRouter(apiKey, {
    model: MODEL,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mediaType};base64,${image.toString("base64")}` },
          },
          { type: "text", text: EXTRACTION_PROMPT },
        ],
      },
    ],
    response_format: RESPONSE_FORMAT,
  });
  return parseCandidates(content);
}

async function extractThenFormat(
  apiKey: string,
  image: Buffer,
  mediaType: SupportedMediaType,
): Promise<ExtractedCandidate[]> {
  const raw = await callOpenRouter(apiKey, {
    model: MODEL,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mediaType};base64,${image.toString("base64")}` },
          },
          { type: "text", text: FREEFORM_EXTRACTION_PROMPT },
        ],
      },
    ],
  });

  const formatted = await callOpenRouter(apiKey, {
    model: MODEL,
    messages: [{ role: "user", content: FORMAT_PROMPT_PREFIX + raw }],
    response_format: RESPONSE_FORMAT,
  });
  return parseCandidates(formatted);
}

export async function extractSpellingLists(
  image: Buffer,
  mediaType: SupportedMediaType,
): Promise<ExtractedCandidate[]> {
  const apiKey = getApiKey();

  const candidates = await extractStructured(apiKey, image, mediaType);
  if (candidates.length > 0) return candidates;

  // Empty here means either a genuinely blank photo or the structured-output
  // collapse — indistinguishable from the response alone, so always retry
  // via the slower path rather than trusting the fast path's empty result.
  return extractThenFormat(apiKey, image, mediaType);
}
