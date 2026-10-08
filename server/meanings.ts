import type { Subject } from "@shared/schema";
import type { IStorage } from "./storage";

// Meanings (CONTEXT.md, ADR-0011): a child-level English rendering of each
// list item, generated once per word by one cheap text-only call. Chinese only
// for now.
export const MEANING_SUBJECTS: readonly Subject[] = ["chinese"];

/**
 * The AI call: given the whole list (context for picking the right sense) and
 * the items still missing a meaning, returns a meaning per missing item.
 * Injected so tests never reach the network.
 */
export type GenerateMeanings = (items: string[], missing: string[]) => Promise<Record<string, string>>;

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
): Promise<number> {
  if (!MEANING_SUBJECTS.includes(subject)) return 0;
  const items = Array.from(new Set(list.map((w) => w.trim()).filter(Boolean)));
  const known = new Set((await storage.getWords(subject, items)).map((r) => r.word));
  const missing = items.filter((w) => !known.has(w));
  if (missing.length === 0) return 0;

  const generated = await generate(items, missing);
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

You get the whole list as context, and the items that need a meaning. For each item that needs a meaning, write it in simple English a 7-year-old understands:
- a word or phrase: a short gloss, a few words at most (e.g. 长城 → "the Great Wall"). If it has several senses, give the one that fits this list.
- a sentence: a natural, full English translation.

Reply with JSON only: {"meanings": {"<item exactly as given>": "<meaning>"}}`;

/** The real GenerateMeanings, over OpenRouter. */
export const generateMeaningsWithOpenRouter: GenerateMeanings = async (items, missing) => {
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
        { role: "user", content: JSON.stringify({ list: items, needMeaning: missing }) },
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
