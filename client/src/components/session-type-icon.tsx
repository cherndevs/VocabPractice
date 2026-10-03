import { BookOpen, SquarePen } from "lucide-react";

// The Reading / Spelling icon shared by every session card.
export default function SessionTypeIcon({
  sessionType,
  className = "",
  "data-testid": testId,
}: {
  sessionType: string;
  className?: string;
  "data-testid"?: string;
}) {
  return sessionType === "reading" ? (
    <BookOpen className={`shrink-0 text-skill-reading ${className}`} aria-label="Reading session" data-testid={testId} />
  ) : (
    <SquarePen className={`shrink-0 text-skill-writing ${className}`} aria-label="Spelling session" data-testid={testId} />
  );
}
