import { MEANING_SUBJECTS, type Subject } from "@shared/schema";
import type { IStorage } from "./storage";

// Meanings (CONTEXT.md, ADR-0011): a child-level English rendering of each
// list item, generated once per word by one cheap text-only call.

/** Word → Meaning. */
export type Meanings = Record<string, string>;

/** What the AI call is asked: the whole list and its Lesson's topic as context, and the items needing a meaning. */
export type MeaningRequest = { items: string[]; missing: string[]; topic: string | null };

/**
 * The AI call: returns a meaning per missing item. Injected so tests never
 * reach the network.
 */
export type GenerateMeanings = (request: MeaningRequest) => Promise<Meanings>;

/** The words of a list as stored and keyed: trimmed, blanks dropped, each once. */
export const normalizeWords = (words: string[]) => Array.from(new Set(words.map((w) => w.trim()).filter(Boolean)));

/**
 * Generates meanings for the items in one list that have no word row yet.
 * Returns how many it added. Throws if the AI call fails; callers on the save
 * path swallow that, so a list always saves.
 */
export async function fillMeanings(
  storage: IStorage,
  generate: GenerateMeanings,
  subject: Subject,
  list: string[],
  topic: string | null = null,
): Promise<number> {
  if (!MEANING_SUBJECTS.includes(subject)) return 0;
  const items = normalizeWords(list);
  const known = new Set((await storage.getWords(subject, items)).map((r) => r.word));
  const missing = items.filter((w) => !known.has(w));
  if (missing.length === 0) return 0;

  const generated = await generate({ items, missing, topic });
  const wanted = new Set(missing);
  const meanings = Object.fromEntries(
    Object.entries(generated)
      .map(([word, meaning]) => [word.trim(), typeof meaning === "string" ? meaning.trim() : ""] as const)
      .filter(([word, meaning]) => wanted.has(word) && meaning),
  );
  await storage.addGeneratedMeanings(subject, meanings);
  return Object.keys(meanings).length;
}

// Text-only, no thinking step, strong at Chinese (chosen in CHE-32). Pin the
// exact id: a floating alias could change the output under us.
const MODEL = "qwen/qwen3-30b-a3b-instruct-2507";
const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

const PROMPT = `You help a young child learning to read Chinese understand a school word list.

You get the whole list (and its topic, if known) as context, and the items that need a meaning. For each item that needs a meaning, write it in simple English a 7-year-old understands:
- a word or phrase: a short gloss, a few words at most (e.g. 长城 → "the Great Wall"). If it has several senses, give the one that fits this list.
- a sentence: a natural, full English translation.

Reply with JSON only: {"meanings": {"<item exactly as given>": "<meaning>"}}`;

/** The real GenerateMeanings, over OpenRouter. */
export const generateMeaningsWithOpenRouter: GenerateMeanings = async ({ items, missing, topic }) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PROMPT },
        { role: "user", content: JSON.stringify({ topic, list: items, needMeaning: missing }) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter returned ${res.status}: ${await res.text()}`);

  const content = (await res.json()).choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("OpenRouter returned no content");
  const meanings = JSON.parse(content).meanings;
  if (!meanings || typeof meanings !== "object") throw new Error("OpenRouter returned no meanings");
  return meanings;
};
