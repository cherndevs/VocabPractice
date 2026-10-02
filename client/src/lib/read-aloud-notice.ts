// The "Before you read aloud" notice shows once per device (ADR-0009).

const KEY = "readAloudNoticeSeen";

export function hasSeenReadAloudNotice(storage: Pick<Storage, "getItem"> = window.localStorage): boolean {
  try {
    return storage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function markReadAloudNoticeSeen(storage: Pick<Storage, "setItem"> = window.localStorage): void {
  try {
    storage.setItem(KEY, "1");
  } catch {
    // Storage blocked: the notice will show again next time.
  }
}
