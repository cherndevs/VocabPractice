import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { BookOpen, SquarePen, Plus, Trash2, Check, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useActiveSubject } from "@/hooks/use-active-subject";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { LessonPicker } from "@/components/lesson-picker";
import { DueDateField } from "@/components/due-date-field";
import CameraCapture from "@/components/camera-capture";
import { prepareWorksheetImage } from "@/lib/prepare-worksheet-image";
import { extractSpellingLists } from "@/lib/extract-spelling-lists";
import { sanitizeExtractedCandidates, type ExtractedCandidate } from "@/lib/extraction-candidates";
import type { InsertSession, SessionType } from "@shared/schema";

type CreateSessionStep = "type" | "camera" | "selection" | "processing" | "edit-words" | "session-created";

const SESSION_TYPE_OPTIONS: {
  type: SessionType;
  title: string;
  description: string;
  Icon: typeof SquarePen;
  iconClass: string;
}[] = [
  {
    type: "spelling",
    title: "Spelling",
    description: "Practice writing words from dictation.",
    Icon: SquarePen,
    iconClass: "bg-skill-writing-bg text-skill-writing",
  },
  {
    type: "reading",
    title: "Reading",
    description: "Practice recognizing words and their meanings.",
    Icon: BookOpen,
    iconClass: "bg-skill-reading-bg text-skill-reading",
  },
];

function defaultSessionTitle(type: SessionType): string {
  const label = type === "reading" ? "Reading" : "Spelling";
  return `${label} Session ${new Date().toLocaleDateString()}`;
}

/** Splits a candidate into the pieces of state the edit-words screen edits. */
function loadCandidateFields(candidate: ExtractedCandidate): { words: string[]; title: string; lesson: string | null; dueDate: string | null } {
  return { words: candidate.words, title: candidate.title, lesson: candidate.lesson, dueDate: candidate.dueDate };
}

export default function CreateSession() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  // Sessions are filed under the active Workspace. The switcher isn't
  // reachable from this flow, so the Subject can't change while it runs.
  const { subject } = useActiveSubject();
  const [currentStep, setCurrentStep] = useState<CreateSessionStep>("type");
  // Chosen at step 1 and applied to every session this run creates (ADR-0008).
  const [sessionType, setSessionType] = useState<SessionType | null>(null);
  const [words, setWords] = useState<string[]>([""]); // Initialize with one empty word
  const [sessionTitle, setSessionTitle] = useState("");
  // Optional Lesson tag, filled from the sheet when it names one and loaded
  // afresh for each candidate in a multi-unit batch.
  const [lessonName, setLessonName] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(null);

  // Multi-candidate selection state. `queue` holds the candidates the user
  // chose to create, one at a time through the same edit-words screen used
  // for a single candidate — non-empty exactly while working through a
  // multi-unit batch. `multiCandidates`/`selected` back the selection
  // screen's checkboxes and are only read while currentStep is "selection".
  const [multiCandidates, setMultiCandidates] = useState<ExtractedCandidate[]>([]);
  const [selected, setSelected] = useState<boolean[]>([]);
  const [queue, setQueue] = useState<ExtractedCandidate[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  // What the Created screen reports: the last session saved, and how many this run made.
  const [created, setCreated] = useState<{ title: string; wordCount: number; sessions: number } | null>(null);

  // The most recently captured photo, kept so a failed extraction can be
  // retried without asking the user to recapture. Cleared on retake.
  const [lastCapturedImage, setLastCapturedImage] = useState<string | null>(null);
  // Which recoverable extraction outcome to prompt the user about, if any —
  // "api-error" for a failed call (network/rate-limit/5xx/prep failure),
  // "empty" for a call that succeeded but found no usable word list.
  const [extractionError, setExtractionError] = useState<"api-error" | "empty" | null>(null);

  const createSessionMutation = useMutation({
    mutationFn: async (sessionData: InsertSession & { lessonName: string | null; dueDate: string | null }) => {
      const response = await apiRequest("POST", "/api/sessions", sessionData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/practice"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lessons"] });
    },
  });
  const handleImageCapture = async (imageData: string) => {
    setLastCapturedImage(imageData);
    setExtractionError(null);
    setCurrentStep("processing");

    try {
      const prepared = await prepareWorksheetImage(imageData);
      const raw = await extractSpellingLists(prepared);
      const { candidates, isEmpty } = sanitizeExtractedCandidates(raw, defaultSessionTitle(sessionType ?? "spelling"));

      if (isEmpty) {
        // Read fine, but nothing usable came back — ask before dropping the
        // user into a blank form rather than doing it silently.
        setCurrentStep("camera");
        setExtractionError("empty");
        return;
      }

      if (candidates.length === 1) {
        const { words, title, lesson, dueDate: due } = loadCandidateFields(candidates[0]);
        setWords(words);
        setSessionTitle(title);
        setLessonName(lesson);
        setDueDate(due);
        setCurrentStep("edit-words");
        return;
      }

      // Several units detected — let the user pick which to create before
      // any of them reach the edit-words screen.
      setMultiCandidates(candidates);
      setSelected(candidates.map(() => true));
      setCurrentStep("selection");
    } catch (error) {
      // Covers both a failed call (network/rate-limit/5xx) and a failure to
      // prepare the image — either way the photo is likely fine and worth
      // retrying as-is, so land on "camera" (behind the dialog) rather than
      // routing straight to manual entry.
      console.error("Extraction failed:", error);
      setCurrentStep("camera");
      setExtractionError("api-error");
    }
  };

  const handleRetryExtraction = () => {
    setExtractionError(null);
    if (lastCapturedImage) handleImageCapture(lastCapturedImage);
  };

  const handleEnterWordsManually = () => {
    setWords([""]);
    setSessionTitle("");
    setLessonName(null);
    setDueDate(null);
    setExtractionError(null);
    setCurrentStep("edit-words");
  };

  const handleSkipCamera = () => {
    setCurrentStep("edit-words");
  };

  /** Discards any extraction result in progress and returns to the camera for a fresh capture. */
  const handleRetake = () => {
    setWords([""]);
    setSessionTitle("");
    setLessonName(null);
    setDueDate(null);
    setMultiCandidates([]);
    setSelected([]);
    setQueue([]);
    setQueueIndex(0);
    setLastCapturedImage(null);
    setExtractionError(null);
    setCurrentStep("camera");
  };

  const handleToggleCandidate = (index: number) => {
    setSelected((prev) => prev.map((value, i) => (i === index ? !value : value)));
  };

  const handleConfirmSelection = () => {
    const chosen = multiCandidates.filter((_, i) => selected[i]);
    if (chosen.length === 0) return;

    const { words, title, lesson, dueDate: due } = loadCandidateFields(chosen[0]);
    setQueue(chosen);
    setQueueIndex(0);
    setWords(words);
    setSessionTitle(title);
    setLessonName(lesson);
    setDueDate(due);
    setCurrentStep("edit-words");
  };

  const handleAddWord = () => {
    setWords([...words, ""]);
  };

  const handleRemoveWord = (index: number) => {
    setWords(words.filter((_, i) => i !== index));
  };

  const handleWordChange = (index: number, value: string) => {
    const newWords = [...words];
    newWords[index] = value;
    setWords(newWords);
  };

  // NEW: Handle Enter key press in word inputs
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Prevent form submission
      
      // If this is the last input and has content, add a new word
      if (index === words.length - 1 && words[index].trim().length > 0) {
        handleAddWord();
        
        // Focus the new input field after it's created
        setTimeout(() => {
          const newInput = document.querySelector(`[data-testid="input-word-${words.length}"]`) as HTMLInputElement;
          if (newInput) {
            newInput.focus();
          }
        }, 50);
      } else if (index < words.length - 1) {
        // Move to next input field if not the last one
        const nextInput = document.querySelector(`[data-testid="input-word-${index + 1}"]`) as HTMLInputElement;
        if (nextInput) {
          nextInput.focus();
        }
      }
    }
  };

  const handleConfirmWordList = async () => {
    const filteredWords = words.filter(word => word.trim().length > 0);
    if (filteredWords.length === 0) {
      toast({
        title: "No words",
        description: "Please add at least one word to create a session.",
        variant: "destructive",
      });
      return;
    }

    if (!subject || !sessionType) {
      toast({
        title: "Still loading",
        description: "Your workspace hasn't loaded yet. Please try again in a moment.",
        variant: "destructive",
      });
      return;
    }

    const title = sessionTitle.trim() || defaultSessionTitle(sessionType);

    try {
      await createSessionMutation.mutateAsync({
        title,
        subject,
        sessionType,
        lessonName,
        dueDate,
        words: filteredWords,
        wordCount: filteredWords.length,
        status: "new",
        progress: 0,
        timeSpent: 0,
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to create session. Please try again.",
        variant: "destructive",
      });
      return;
    }

    // Mid-batch: move on to the next selected candidate's word list rather
    // than treating this one creation as the end of the flow.
    const nextIndex = queueIndex + 1;
    if (nextIndex < queue.length) {
      const { words: nextWords, title: nextTitle, lesson: nextLesson, dueDate: nextDue } = loadCandidateFields(queue[nextIndex]);
      setQueueIndex(nextIndex);
      setWords(nextWords);
      setSessionTitle(nextTitle);
      setLessonName(nextLesson);
      setDueDate(nextDue);
      return;
    }

    setCreated({ title, wordCount: filteredWords.length, sessions: Math.max(queue.length, 1) });
    setQueue([]);
    setQueueIndex(0);
    setCurrentStep("session-created");
  };

  const goBack = () => {
    if (currentStep === "type") {
      navigate("/library");
    } else if (currentStep === "camera") {
      setCurrentStep("type");
    } else if (currentStep === "selection") {
      setMultiCandidates([]);
      setSelected([]);
      setCurrentStep("camera");
    } else if (currentStep === "edit-words") {
      if (queue.length > 0) {
        // Mid-batch: back goes to reselecting rather than to the camera.
        // Sessions already created earlier in this batch stay created —
        // there's no way to undo a save that already landed — so they're
        // dropped from the list entirely rather than left checked, or
        // Continue would recreate them as duplicates.
        const alreadyCreated = queue.slice(0, queueIndex);
        const remaining = multiCandidates.filter((c) => !alreadyCreated.includes(c));
        setMultiCandidates(remaining);
        setSelected(remaining.map(() => true));
        setQueue([]);
        setQueueIndex(0);
        setCurrentStep("selection");
      } else {
        setCurrentStep("camera");
      }
    }
  };

  // Numbering follows the design canvas ("Step N/6"); the last step, Created, has no header.
  const STEP_LABELS: Partial<Record<CreateSessionStep, string>> = {
    type: "Step 1/6 · Session type",
    camera: "Step 2/6 · Capture",
    selection: "Step 3/6 · Select lists",
    processing: "Step 4/6 · Processing",
    "edit-words": "Step 5/6 · Review",
  };

  const stepLabel = STEP_LABELS[currentStep];
  const canGoBack = currentStep !== "processing";
  // One pinned footer per step, so the primary action never scrolls away.
  const footer = "flex shrink-0 flex-col gap-2 border-t border-border p-4";
  const fieldLabel = "mb-2 block text-xs font-semibold text-muted-foreground";

  return (
    <div className="fade-in flex h-[100dvh] flex-col">
      {stepLabel && (
        <div className="flex shrink-0 items-center px-3 pt-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={goBack}
            disabled={!canGoBack}
            aria-label={currentStep === "type" ? "Cancel" : "Back"}
            className="h-11 w-11 text-muted-foreground"
            data-testid="button-go-back"
          >
            <X className="h-4 w-4" />
          </Button>
          <h1 className="ml-1 text-xs font-bold uppercase tracking-wider text-muted-foreground" data-testid="text-step-label">
            {stepLabel}
          </h1>
        </div>
      )}

      {currentStep === "type" && (
        <>
          <div className="flex-1 overflow-y-auto">
            <h2 className="mx-5 mb-1 mt-2 text-xl font-bold text-foreground">What are you creating?</h2>
            <p className="mx-5 mb-5 text-[13px] leading-snug text-muted-foreground">This decides which list the words go into.</p>
            <div role="radiogroup" aria-label="Session type" className="space-y-3 px-5">
              {SESSION_TYPE_OPTIONS.map(({ type, title, description, Icon, iconClass }) => {
                const isSelected = sessionType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setSessionType(type)}
                    data-testid={`option-session-type-${type}`}
                    className={`flex w-full items-center gap-3.5 rounded-xl border-[1.5px] p-4 text-left ${
                      isSelected ? "border-primary bg-primary-tint" : "border-input bg-card"
                    }`}
                  >
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] ${iconClass}`}>
                      <Icon className="h-[22px] w-[22px]" />
                    </span>
                    <span className="flex-1">
                      <span className="block text-[15px] font-semibold text-foreground">{title}</span>
                      <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{description}</span>
                    </span>
                    <span
                      className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                        isSelected ? "border-primary" : "border-input"
                      }`}
                    >
                      {isSelected && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className={footer}>
            <Button className="h-[46px] w-full" disabled={!sessionType} onClick={() => setCurrentStep("camera")} data-testid="button-continue-session-type">
              Continue
            </Button>
          </div>
        </>
      )}

      {currentStep === "camera" && <CameraCapture onImageCapture={handleImageCapture} onSkip={handleSkipCamera} />}

      {currentStep === "selection" && (
        <>
          <h2 className="mx-5 mb-1 mt-3 shrink-0 text-xl font-bold text-foreground">
            We found {multiCandidates.length} {multiCandidates.length === 1 ? "list" : "lists"} in this photo
          </h2>
          <p className="mx-5 mb-4 shrink-0 text-[13px] leading-snug text-muted-foreground">
            Pick which ones to add. Each is processed one at a time in the next steps.
          </p>
          <div className="flex-1 space-y-2.5 overflow-y-auto px-5">
            {multiCandidates.map((candidate, index) => {
              const checked = selected[index] ?? false;
              const meta = [candidate.lesson, `${candidate.words.length} ${candidate.words.length === 1 ? "word" : "words"}`]
                .filter(Boolean)
                .join(" · ");
              return (
                <div
                  key={index}
                  role="checkbox"
                  aria-checked={checked}
                  tabIndex={0}
                  onClick={() => handleToggleCandidate(index)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleToggleCandidate(index);
                    }
                  }}
                  className={`flex cursor-pointer items-center gap-3 rounded-[10px] border-[1.5px] p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    checked ? "border-primary bg-primary-tint" : "border-input bg-card"
                  }`}
                  data-testid={`candidate-${index}`}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <FileText className="h-5 w-5" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-foreground">{candidate.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{meta}</div>
                  </div>
                  <div
                    className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border-[1.5px] ${
                      checked ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card"
                    }`}
                    data-testid={`checkbox-candidate-${index}`}
                  >
                    {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                  </div>
                </div>
              );
            })}
          </div>
          <div className={footer}>
            <Button onClick={handleConfirmSelection} className="h-[46px] w-full" disabled={!selected.some(Boolean)} data-testid="button-confirm-selection">
              Continue with {selected.filter(Boolean).length}
            </Button>
            <Button variant="outline" onClick={handleRetake} className="h-[46px] w-full" data-testid="button-retake-photo">
              Retake Photo
            </Button>
          </div>
        </>
      )}

      {currentStep === "processing" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3.5 px-8">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-border border-t-primary" />
          <div className="text-lg font-semibold text-foreground">Reading the worksheet…</div>
          <div className="text-sm text-muted-foreground">This usually takes a few seconds.</div>
        </div>
      )}

      {currentStep === "edit-words" && (
        <>
          <div className="flex-1 space-y-6 overflow-y-auto px-5 pb-6 pt-3">
            {queue.length > 0 && (
              <p className="-mb-2 text-xs text-muted-foreground">
                Session {queueIndex + 1} of {queue.length}
              </p>
            )}

            <div>
              <label htmlFor="session-title" className={fieldLabel}>
                Session title (optional)
              </label>
              <Input
                id="session-title"
                placeholder={sessionType ? `e.g. ${defaultSessionTitle(sessionType)}` : "Session title"}
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                className="h-[42px] w-full border-[1.5px] text-[15px]"
                data-testid="input-session-title"
              />
            </div>

            {subject && <LessonPicker subject={subject} value={lessonName} onChange={setLessonName} />}

            <DueDateField value={dueDate} onChange={setDueDate} />

            <div>
              <div className={fieldLabel}>Words ({words.length})</div>
              <div className="space-y-3">
                {words.map((word, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="w-5 shrink-0 text-right text-[13px] font-semibold text-muted-foreground">{index + 1}</span>
                    <Input
                      value={word}
                      onChange={(e) => handleWordChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, index)}
                      className="h-[42px] flex-1 border-[1.5px] text-[15px]"
                      data-testid={`input-word-${index}`}
                      placeholder="Word"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveWord(index)}
                      aria-label="Remove word"
                      className="text-muted-foreground hover:bg-transparent hover:text-destructive"
                      data-testid={`button-remove-word-${index}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                onClick={handleAddWord}
                className="mt-1 h-10 gap-1.5 px-1 font-semibold text-primary hover:bg-transparent hover:text-primary"
                data-testid="button-add-word"
              >
                <Plus className="h-4 w-4" />
                Add word
              </Button>
            </div>
          </div>
          <div className={footer}>
            <Button onClick={handleConfirmWordList} className="h-[46px] w-full" disabled={createSessionMutation.isPending} data-testid="button-confirm-word-list">
              {createSessionMutation.isPending ? "Creating..." : "Confirm Word List"}
            </Button>
            <Button variant="outline" onClick={handleRetake} className="h-[46px] w-full" data-testid="button-retake-photo">
              Retake Photo
            </Button>
          </div>
        </>
      )}

      {currentStep === "session-created" && (
        <>
          <div className="flex flex-1 flex-col items-center justify-center gap-3.5 px-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success text-primary-foreground">
              <Check className="h-[30px] w-[30px]" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Session created</h1>
            {created && (
              <p className="text-sm text-muted-foreground" data-testid="text-created-summary">
                <strong className="font-semibold text-foreground">{created.title}</strong>
                <br />
                {created.sessions > 1
                  ? `${created.sessions} sessions added to your Library`
                  : `${created.wordCount} ${created.wordCount === 1 ? "word" : "words"} added to your Library`}
              </p>
            )}
          </div>
          <div className={footer}>
            <Button onClick={() => navigate("/library")} className="h-[46px] w-full" data-testid="button-go-to-sessions">
              Go to Library
            </Button>
          </div>
        </>
      )}

      <AlertDialog
        open={extractionError !== null}
        onOpenChange={(open) => {
          if (!open) setExtractionError(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {extractionError === "api-error" ? "Couldn't read that photo" : "No word list found"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {extractionError === "api-error"
                ? "Something went wrong processing that photo. You can try again or enter the words yourself."
                : "That photo didn't seem to have a spelling list on it. Would you like to enter the words manually?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-dismiss-extraction-error">Not Now</AlertDialogCancel>
            {extractionError === "api-error" && (
              <AlertDialogAction onClick={handleRetryExtraction} data-testid="button-retry-extraction">
                Retry
              </AlertDialogAction>
            )}
            <AlertDialogAction onClick={handleEnterWordsManually} data-testid="button-enter-manually">
              Enter Words Manually
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}