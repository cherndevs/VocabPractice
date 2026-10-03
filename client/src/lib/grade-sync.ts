import { createGradeOutbox } from "./grade-outbox";
import { queryClient } from "./queryClient";

// The app's one outbox, posting to the real API.
export const gradeOutbox = createGradeOutbox({
  storage: window.localStorage,
  async send(grades) {
    const res = await fetch("/api/grades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grades }),
    });
    if (!res.ok) throw new Error(`Grades not saved: ${res.status}`);
  },
  newId: () => crypto.randomUUID(),
  now: () => new Date(),
  setTimer: (fn, ms) => {
    const handle = setTimeout(fn, ms);
    return () => clearTimeout(handle);
  },
  onSent: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
    queryClient.invalidateQueries({ queryKey: ["/api/practice"] });
  },
});

/** Flushes anything left from an earlier visit, and again whenever the network returns. */
export function startGradeSync() {
  void gradeOutbox.flush();
  window.addEventListener("online", () => void gradeOutbox.flush());
}
