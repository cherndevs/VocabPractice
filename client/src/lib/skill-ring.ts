export type RingState = "fresh" | "aging" | "due" | "new";

/** Colour bucket for a session's retrievability (0–1); null means nothing graded yet. */
export function ringState(retrievability: number | null | undefined): RingState {
  if (retrievability == null) return "new";
  if (retrievability >= 0.8) return "fresh";
  if (retrievability >= 0.5) return "aging";
  return "due";
}

/** Share of the ring to fill, as a 0–100 percentage. */
export function ringPercent(retrievability: number | null | undefined): number {
  if (retrievability == null) return 0;
  return Math.round(Math.min(1, Math.max(0, retrievability)) * 100);
}
