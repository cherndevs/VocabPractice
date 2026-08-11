import { describe, expect, it } from "vitest";
import { resolveSessionViewMode } from "./session-mode";

describe("resolveSessionViewMode", () => {
  it("keeps the current mode when the word has pinyin to peek at", () => {
    expect(resolveSessionViewMode("peek", true)).toBe("peek");
    expect(resolveSessionViewMode("read", true)).toBe("read");
    expect(resolveSessionViewMode("write", true)).toBe("write");
  });

  it("falls back to read when on peek for a word with no pinyin", () => {
    expect(resolveSessionViewMode("peek", false)).toBe("read");
  });

  it("leaves write and read alone regardless of pinyin availability", () => {
    expect(resolveSessionViewMode("write", false)).toBe("write");
    expect(resolveSessionViewMode("read", false)).toBe("read");
  });
});
