import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkingWord } from "./marking-word";

const render = (word: string, index = 0) =>
  renderToStaticMarkup(<MarkingWord word={word} index={index} onHear={() => {}} />);

describe("MarkingWord", () => {
  it("shows the pinyin below a Chinese word", () => {
    const html = render("你好");

    expect(html).toContain("nǐ hǎo");
    expect(html.indexOf("你好")).toBeLessThan(html.indexOf("nǐ hǎo"));
  });

  it("shows no pinyin line for a word with no Chinese characters", () => {
    const html = render("hello", 3);

    expect(html).toContain("hello");
    expect(html).not.toContain("text-marking-pinyin-3");
  });

  it("keeps the word as the tap-to-hear label, unaffected by the pinyin", () => {
    expect(render("你好", 2)).toContain('aria-label="Hear 你好"');
  });
});
