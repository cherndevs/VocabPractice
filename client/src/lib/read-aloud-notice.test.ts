import { describe, expect, it } from "vitest";
import { hasSeenReadAloudNotice, markReadAloudNoticeSeen } from "./read-aloud-notice";

function fakeStorage() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

describe("read aloud notice", () => {
  it("is unseen until marked, then seen", () => {
    const storage = fakeStorage();
    expect(hasSeenReadAloudNotice(storage)).toBe(false);
    markReadAloudNoticeSeen(storage);
    expect(hasSeenReadAloudNotice(storage)).toBe(true);
  });

  it("copes with blocked storage", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(hasSeenReadAloudNotice(blocked)).toBe(false);
    expect(() => markReadAloudNoticeSeen(blocked)).not.toThrow();
  });
});
