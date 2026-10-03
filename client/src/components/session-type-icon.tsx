import { BookOpen, Pencil } from "lucide-react";

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
    <BookOpen className={`shrink-0 text-purple-600 ${className}`} aria-label="Reading session" data-testid={testId} />
  ) : (
    <Pencil className={`shrink-0 text-blue-600 ${className}`} aria-label="Spelling session" data-testid={testId} />
  );
}
