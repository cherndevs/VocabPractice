import { ringPercent, ringState, type RingState } from "@/lib/skill-ring";

const STROKE: Record<RingState, string> = {
  fresh: "stroke-success",
  aging: "stroke-warning",
  due: "stroke-destructive",
  new: "stroke-muted-foreground",
};

const RADIUS = 10;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// How well a session's words are retained, drawn as a ring (design canvas).
export default function SkillRing({
  retrievability,
  "data-testid": testId,
}: {
  retrievability: number | null | undefined;
  "data-testid"?: string;
}) {
  const state = ringState(retrievability);
  const percent = ringPercent(retrievability);
  return (
    <svg
      viewBox="0 0 26 26"
      className="h-[26px] w-[26px] shrink-0"
      role="img"
      aria-label={state === "new" ? "Not tested yet" : `${percent}% remembered`}
      data-testid={testId}
      data-state={state}
    >
      <circle cx="13" cy="13" r={RADIUS} fill="none" strokeWidth="3" className="stroke-border" />
      {percent > 0 && (
        <circle
          cx="13"
          cy="13"
          r={RADIUS}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${((percent / 100) * CIRCUMFERENCE).toFixed(1)} ${CIRCUMFERENCE.toFixed(1)}`}
          transform="rotate(-90 13 13)"
          className={STROKE[state]}
        />
      )}
    </svg>
  );
}
