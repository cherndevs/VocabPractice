import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Plus, ChevronRight, Calendar, FileText, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SwipeableCard } from "@/components/swipeable-card";
import type { Session } from "@shared/schema";
import { format } from "date-fns";

export default function Sessions() {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { data: sessions = [], isLoading } = useQuery<Session[]>({
    queryKey: ["/api/sessions"],
  });

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
    },
  });

  const handleDeleteSession = (sessionId: string) => {
    deleteSessionMutation.mutate(sessionId);
  };

  const pinMutation = useMutation({
    mutationFn: async ({ id, pinnedAt }: { id: string; pinnedAt: string | null }) => {
      const response = await fetch(`/api/sessions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinnedAt }),
      });
      if (!response.ok) {
        throw new Error('Failed to update pin state');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
    },
  });

  const handleTogglePin = (e: React.MouseEvent, session: Session) => {
    e.preventDefault();
    e.stopPropagation();
    const nextPinnedAt = session.pinnedAt ? null : new Date().toISOString();
    pinMutation.mutate({ id: session.id, pinnedAt: nextPinnedAt });
  };

  // Ensure pinned items render first on the client as well (safety against 304/caching)
  const sortedSessions = [...sessions].sort((a, b) => {
    const aPinned = a.pinnedAt ? new Date(a.pinnedAt as unknown as string).getTime() : -Infinity;
    const bPinned = b.pinnedAt ? new Date(b.pinnedAt as unknown as string).getTime() : -Infinity;
    if (aPinned !== bPinned) return bPinned - aPinned; // pinned first, latest pinned first

    const aCreated = a.createdAt ? new Date(a.createdAt as unknown as string).getTime() : 0;
    const bCreated = b.createdAt ? new Date(b.createdAt as unknown as string).getTime() : 0;
    return bCreated - aCreated; // newest created first
  });

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="px-4 py-6 bg-card">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Mber Spelling Pro</h1>
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
                  <p className="text-muted-foreground text-sm">Create your first spelling session to get started</p>
                </CardContent>
              </Card>
            ) : (
              sortedSessions.map((session) => (
                <SwipeableCard
                  key={session.id}
                  className="word-card hover:shadow-md transition-shadow cursor-pointer"
                  data-testid={`card-session-${session.id}`}
                  onDelete={() => handleDeleteSession(session.id)}
                  onEdit={() => navigate(`/edit-session/${session.id}`)}
                >
                  <Link href={`/practice/${session.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-foreground" data-testid={`text-session-title-${session.id}`}>
                          {session.title}
                        </h3>
                        <div className="flex items-center gap-2">
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
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center space-x-3">
                          <span className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span data-testid={`text-session-date-${session.id}`}>
                              {session.createdAt ? format(new Date(session.createdAt), 'MMM d, yyyy') : 'Unknown date'}
                            </span>
                          </span>
                          <span data-testid={`text-session-word-count-${session.id}`}>
                            {session.wordCount} Words
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </CardContent>
                  </Link>
                </SwipeableCard>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
