import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Plus, FileText, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SwipeableCard } from "@/components/swipeable-card";
import { usePinSession } from "@/hooks/use-pin-session";
import SkillRing from "@/components/skill-ring";
import SessionTypeIcon from "@/components/session-type-icon";
import { useActiveSubject } from "@/hooks/use-active-subject";
import { SUBJECT_META } from "@/lib/subjects";
import WorkspaceSwitcher from "@/components/workspace-switcher";
import { formatDueDate } from "@/lib/due-date";
import type { SessionWithLesson } from "@shared/schema";
import { groupLibrary, type SessionGroup } from "@/lib/group-sessions";

// The list endpoint adds how many of a session's words have ever been graded.
type SessionWithTested = SessionWithLesson & { needsReviewCount: number; retrievability: number | null };

export default function Library() {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { subject } = useActiveSubject();
  // Only the active Workspace's sessions are listed (ADR-0005). The list waits
  // for settings so it never flashes the wrong Workspace on startup.
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<SessionWithTested[]>({
    queryKey: ["/api/sessions", { subject }],
    queryFn: async () => {
      const response = await fetch(`/api/sessions?subject=${subject}`);
      if (!response.ok) {
        throw new Error("Failed to fetch sessions");
      }
      return response.json();
    },
    enabled: !!subject,
  });
  const isLoading = !subject || sessionsLoading;
  const active = subject ? SUBJECT_META[subject] : undefined;

  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete session');
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch sessions
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/practice"] });
    },
  });

  const handleDeleteSession = (sessionId: string) => {
    deleteSessionMutation.mutate(sessionId);
  };

  const pinSession = usePinSession();

  const handleTogglePin = (e: React.MouseEvent, session: SessionWithTested) => {
    e.preventDefault();
    e.stopPropagation();
    pinSession.mutate(session);
  };

  // Pinned first, then a section per Year holding its Lessons, then Other.
  const library = groupLibrary(sessions);

  const renderSession = (session: SessionWithTested) => (
    <SwipeableCard
      key={session.id}
      className="word-card hover:shadow-md transition-shadow cursor-pointer"
      data-testid={`card-session-${session.id}`}
      onDelete={() => handleDeleteSession(session.id)}
      onEdit={() => navigate(`/edit-session/${session.id}`)}
    >
      <Link href={`/practice/${session.id}`}>
        <CardContent className="flex items-center gap-3 px-3.5 py-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              session.sessionType === "reading" ? "bg-skill-reading-bg" : "bg-skill-writing-bg"
            }`}
          >
            <SessionTypeIcon sessionType={session.sessionType} className="w-[18px] h-[18px]" data-testid={`icon-session-type-${session.id}`} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-medium text-foreground" data-testid={`text-session-title-${session.id}`}>
              {session.title}
            </h3>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              <span data-testid={`text-session-date-${session.id}`}>{formatDueDate(session.dueDate)}</span>
              {" · "}
              <span data-testid={`text-session-needs-review-${session.id}`}>{session.needsReviewCount} due to review</span>
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className={session.pinnedAt ? 'text-primary' : 'text-muted-foreground'}
            aria-label={session.pinnedAt ? 'Unpin session' : 'Pin session'}
            onClick={(e) => handleTogglePin(e, session)}
            data-testid={`button-pin-${session.id}`}
          >
            <Pin className="w-4 h-4" />
          </Button>
          <SkillRing retrievability={session.retrievability} data-testid={`ring-session-${session.id}`} />
        </CardContent>
      </Link>
    </SwipeableCard>
  );

  const renderLessonGroup = (group: SessionGroup<SessionWithTested>) => (
    <section
      key={group.lesson?.id ?? "untagged"}
      className="space-y-3"
      data-testid={group.lesson ? `group-lesson-${group.lesson.id}` : "group-untagged"}
    >
      {group.lesson && (
        <h3
          className="pt-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground"
          data-testid={`heading-lesson-${group.lesson.id}`}
        >
          {group.lesson.name}
        </h3>
      )}
      {group.sessions.map(renderSession)}
    </section>
  );

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="px-4 py-6 bg-card">
        <div className="mb-4">
          <WorkspaceSwitcher />
        </div>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-foreground">Library</h1>
          <Button
            asChild
            variant="default"
            size="icon"
            aria-label="Create New Session"
            data-testid="button-create-session"
          >
            <Link href="/create-session">
              <Plus className="w-4 h-4" />
            </Link>
          </Button>
        </div>

      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No sessions yet</h3>
                  <p className="text-muted-foreground text-sm">
                    Create your first {active?.shortName} spelling session to get started
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {library.pinned.length > 0 && (
                  <section className="space-y-3" data-testid="group-pinned">
                    <h2 className="pt-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pinned</h2>
                    {library.pinned.map(renderSession)}
                  </section>
                )}
                {library.years.map((yearGroup) => (
                  // Each Year's header sticks while its section scrolls by, and
                  // the next Year's header pushes it out at the section's end.
                  <section key={yearGroup.year ?? "other"} data-testid={`group-year-${yearGroup.year ?? "other"}`}>
                    {/* With no Years at all, an "Other" heading would label nothing. */}
                    {(yearGroup.year !== null || library.years.length > 1) && <h2
                      className="sticky top-0 z-10 -mx-4 bg-background/95 px-4 py-2 text-base font-bold text-foreground backdrop-blur"
                      data-testid={`heading-year-${yearGroup.year ?? "other"}`}
                    >
                      {yearGroup.year ?? "Other"}
                    </h2>}
                    <div className="space-y-3">{yearGroup.lessons.map(renderLessonGroup)}</div>
                  </section>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
