import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { Session } from "@shared/schema";

export default function EditSession() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [sessionTitle, setSessionTitle] = useState("");
  const [words, setWords] = useState<string[]>([""]);
  const [isSaved, setIsSaved] = useState(false);

  // Fetch the existing session
  const { data: session, isLoading } = useQuery<Session>({
    queryKey: [`/api/sessions/${id}`],
    enabled: !!id,
  });

  // Pre-populate form once session loads
  useEffect(() => {
    if (session) {
      setSessionTitle(session.title);
      setWords(session.words.length > 0 ? session.words : [""]);
    }
  }, [session]);

  const updateSessionMutation = useMutation({
    mutationFn: async (payload: { title: string; words: string[]; wordCount: number }) => {
      const response = await fetch(`/api/sessions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Failed to update session");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${id}`] });
      setIsSaved(true);
      setTimeout(() => {
        navigate("/sessions");
      }, 1500);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save changes. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAddWord = () => {
    setWords([...words, ""]);
  };

  const handleRemoveWord = (index: number) => {
    setWords(words.filter((_, i) => i !== index));
  };

  const handleWordChange = (index: number, value: string) => {
    const updated = [...words];
    updated[index] = value;
    setWords(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (index === words.length - 1 && words[index].trim().length > 0) {
        handleAddWord();
        setTimeout(() => {
          const newInput = document.querySelector(
            `[data-testid="edit-input-word-${words.length}"]`
          ) as HTMLInputElement;
          if (newInput) newInput.focus();
        }, 50);
      } else if (index < words.length - 1) {
        const nextInput = document.querySelector(
          `[data-testid="edit-input-word-${index + 1}"]`
        ) as HTMLInputElement;
        if (nextInput) nextInput.focus();
      }
    }
  };

  const handleSave = () => {
    const filteredWords = words.filter((w) => w.trim().length > 0);
    if (filteredWords.length === 0) {
      toast({
        title: "No words",
        description: "Please add at least one word before saving.",
        variant: "destructive",
      });
      return;
    }
    const title = sessionTitle.trim() || `Spelling Session ${new Date().toLocaleDateString()}`;
    updateSessionMutation.mutate({ title, words: filteredWords, wordCount: filteredWords.length });
  };

  if (isLoading) {
    return (
      <div className="fade-in">
        <div className="px-4 py-6 bg-card border-b border-border">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/sessions")} className="p-2">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold text-foreground">Edit Session</h1>
          </div>
        </div>
        <div className="px-4 py-6 space-y-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (isSaved) {
    return (
      <div className="fade-in px-4 py-12 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-6">
          <Check className="w-8 h-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Session Updated!</h1>
        <p className="text-muted-foreground mb-8 max-w-sm">
          Your changes have been saved. Returning to sessions list…
        </p>
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="px-4 py-6 bg-card border-b border-border">
        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/sessions")}
            className="p-2"
            data-testid="button-edit-go-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-semibold text-foreground">Edit Session</h1>
        </div>
      </div>

      {/* Form */}
      <div className="px-4 py-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-2">Session Details</h2>
          <p className="text-sm text-muted-foreground">
            Update the title and word list for this session.
          </p>
        </div>

        {/* Session Title */}
        <div className="mb-6">
          <Input
            placeholder="Session title"
            value={sessionTitle}
            onChange={(e) => setSessionTitle(e.target.value)}
            className="w-full"
            data-testid="edit-input-session-title"
          />
        </div>

        {/* Word List */}
        <div className="space-y-3 mb-6">
          {words.map((word, index) => (
            <div
              key={index}
              className="flex items-center space-x-3 p-3 bg-card rounded-lg border border-border"
            >
              <span className="w-6 text-sm text-muted-foreground">{index + 1}.</span>
              <Input
                value={word}
                onChange={(e) => handleWordChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                className="flex-1 bg-transparent border-none outline-none"
                placeholder="Enter word…"
                data-testid={`edit-input-word-${index}`}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveWord(index)}
                className="p-1 text-destructive hover:bg-destructive/10"
                data-testid={`edit-button-remove-word-${index}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          onClick={handleAddWord}
          className="w-full mb-4"
          data-testid="edit-button-add-word"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Word
        </Button>

        <Button
          onClick={handleSave}
          className="w-full"
          disabled={updateSessionMutation.isPending}
          data-testid="edit-button-save"
        >
          {updateSessionMutation.isPending ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
