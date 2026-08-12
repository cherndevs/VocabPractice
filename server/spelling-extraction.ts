/**
 * Relays a worksheet photo to Gemini and returns the spelling sessions it
 * reads off the page. Nothing here is persisted — the image lives in memory
 * for the duration of the request and is never written to Postgres or to
 * disk (ADR-0002). See ADR-0003 for why Gemini rather than Claude: this
 * avoids a separate Anthropic Console billing account, and Google's free
 * tier (1,500 requests/day) comfortably covers a personal app's usage.
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

// Gemini's structured-output schema is an OpenAPI subset: uppercase type
// names, no additionalProperties support. Validated end-to-end against both
// test worksheets — every response came back as clean, directly parseable
// JSON.
const CANDIDATES_SCHEMA = {
  type: "OBJECT",
  properties: {
    candidates: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          words: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["title", "words"],
      },
    },
  },
  required: ["candidates"],
} as const;

const MODEL = "gemini-3.6-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

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

export async function extractSpellingLists(
  image: Buffer,
  mediaType: SupportedMediaType,
): Promise<ExtractedCandidate[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ExtractionServiceError(
      "Extraction is not configured on the server.",
      503,
    );
  }

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: mediaType,
                  data: image.toString("base64"),
                },
              },
              { text: EXTRACTION_PROMPT },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: CANDIDATES_SCHEMA,
        },
      }),
    });
  } catch (error) {
    console.error("[extract] Gemini request failed", error);
    throw new ExtractionServiceError(
      "Could not reach the extraction service.",
      502,
    );
  }

  if (!res.ok) {
    console.error("[extract] Gemini returned an error status", res.status, await res.text());
    throw new ExtractionServiceError(
      "Could not reach the extraction service.",
      res.status === 429 ? 429 : 502,
    );
  }

  const body = await res.json();
  const candidate = body.candidates?.[0];
  const finishReason = candidate?.finishReason;
  if (finishReason && finishReason !== "STOP") {
    console.error("[extract] Gemini did not finish normally", finishReason, body.promptFeedback);
    throw new ExtractionServiceError("Extraction returned no content.", 502);
  }

  const part = candidate?.content?.parts?.find((p: { text?: string }) => typeof p.text === "string");
  if (!part) {
    throw new ExtractionServiceError("Extraction returned no content.", 502);
  }

  try {
    return JSON.parse(part.text).candidates as ExtractedCandidate[];
  } catch (error) {
    console.error("[extract] Could not parse extraction response", error);
    throw new ExtractionServiceError("Extraction returned unreadable content.", 502);
  }
}
