import Anthropic from "@anthropic-ai/sdk";

/**
 * Relays a worksheet photo to Claude and returns the spelling sessions it reads
 * off the page. Nothing here is persisted — the image lives in memory for the
 * duration of the request and is never written to Postgres or to disk (ADR-0002).
 */

// Validated against real worksheets. The pinyin rule is load-bearing: without it
// the model let the printed romanization steer which character it read, and
// transcribed 考一考 as its homophone 烤一烤.
const EXTRACTION_PROMPT = `You extract spelling-list content from a photo of a worksheet or study sheet.
The image may contain one or more distinct spelling sessions/units (e.g. separate numbered lists, headed sections, or visually separated blocks). For each one you find, produce a candidate with a short title (use the worksheet's own heading/label if present, otherwise a brief descriptive title) and the list of words belonging to it, in the order they appear.
Rules:
- Only include actual vocabulary/spelling words. Ignore instructions, page numbers, dates, and other non-word text.
- Preserve original spelling and characters exactly as written, including non-English text (e.g. Chinese characters) — do not translate or romanize.
- Some words have small pinyin (romanized pronunciation) annotations printed above the Chinese characters. Ignore these pinyin annotations entirely — they are a reading aid, not the word. Transcribe only the Chinese character glyphs themselves. Since multiple different Chinese characters can share the same pinyin, do not let the pinyin influence which character you transcribe — read the actual character shape.
- If you cannot confidently read a word, omit it rather than guessing.
- If the image contains no discernible spelling list, return an empty array.`;

// Structured outputs, not a prompt instruction. Asking for "only JSON, no
// markdown fences" was tested and the model fenced the reply anyway.
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

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ExtractionServiceError(
      "Extraction is not configured on the server.",
      503,
    );
  }
  client ??= new Anthropic();
  return client;
}

export async function extractSpellingLists(
  image: Buffer,
  mediaType: SupportedMediaType,
): Promise<ExtractedCandidate[]> {
  let response;
  try {
    response = await getClient().messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 4096,
      output_config: { format: { type: "json_schema", schema: CANDIDATES_SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: image.toString("base64"),
              },
            },
            { type: "text", text: EXTRACTION_PROMPT },
          ],
        },
      ],
    });
  } catch (error) {
    if (error instanceof ExtractionServiceError) throw error;
    console.error("[extract] Anthropic request failed", error);
    // Surface rate limits and upstream outages as retryable; anything else is
    // ours to fix, but either way the client gets a distinguishable status.
    const status = error instanceof Anthropic.APIError ? error.status ?? 502 : 502;
    throw new ExtractionServiceError(
      "Could not reach the extraction service.",
      status === 429 ? 429 : 502,
    );
  }

  const text = response.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") {
    throw new ExtractionServiceError("Extraction returned no content.", 502);
  }

  try {
    return JSON.parse(text.text).candidates as ExtractedCandidate[];
  } catch (error) {
    console.error("[extract] Could not parse extraction response", error);
    throw new ExtractionServiceError("Extraction returned unreadable content.", 502);
  }
}
