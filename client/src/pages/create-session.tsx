import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import CameraCapture from "@/components/camera-capture";
import { prepareWorksheetImage } from "@/lib/prepare-worksheet-image";
import { extractSpellingLists } from "@/lib/extract-spelling-lists";
import { sanitizeExtractedCandidates, type ExtractedCandidate } from "@/lib/extraction-candidates";
import type { InsertSession } from "@shared/schema";

type CreateSessionStep = "camera" | "selection" | "processing" | "edit-words" | "session-created";

function defaultSessionTitle(): string {
  return `Spelling Session ${new Date().toLocaleDateString()}`;
}

/** Splits a candidate's `words`/`title` back into the two pieces of state the edit-words screen edits. */
function loadCandidateFields(candidate: ExtractedCandidate): { words: string[]; title: string } {
  return { words: candidate.words, title: candidate.title };
}

export default function CreateSession() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<CreateSessionStep>("camera");
  const [words, setWords] = useState<string[]>([""]); // Initialize with one empty word
  const [sessionTitle, setSessionTitle] = useState("");

  // Multi-candidate selection state. `queue` holds the candidates the user
  // chose to create, one at a time through the same edit-words screen used
  // for a single candidate — non-empty exactly while working through a
  // multi-unit batch. `multiCandidates`/`selected` back the selection
  // screen's checkboxes and are only read while currentStep is "selection".
  const [multiCandidates, setMultiCandidates] = useState<ExtractedCandidate[]>([]);
  const [selected, setSelected] = useState<boolean[]>([]);
  const [queue, setQueue] = useState<ExtractedCandidate[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);

  // The most recently captured photo, kept so a failed extraction can be
  // retried without asking the user to recapture. Cleared on retake.
  const [lastCapturedImage, setLastCapturedImage] = useState<string | null>(null);
  // Which recoverable extraction outcome to prompt the user about, if any —
  // "api-error" for a failed call (network/rate-limit/5xx/prep failure),
  // "empty" for a call that succeeded but found no usable word list.
  const [extractionError, setExtractionError] = useState<"api-error" | "empty" | null>(null);

  const createSessionMutation = useMutation({
    mutationFn: async (sessionData: InsertSession) => {
      const response = await apiRequest("POST", "/api/sessions", sessionData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
    },
  });
  const handleImageCapture = async (imageData: string) => {
    setLastCapturedImage(imageData);
    setExtractionError(null);
    setCurrentStep("processing");

    try {
      const prepared = await prepareWorksheetImage(imageData);
      const raw = await extractSpellingLists(prepared);
      const { candidates, isEmpty } = sanitizeExtractedCandidates(raw, defaultSessionTitle());

      if (isEmpty) {
        // Read fine, but nothing usable came back — ask before dropping the
        // user into a blank form rather than doing it silently.
        setCurrentStep("camera");
        setExtractionError("empty");
        return;
      }

      if (candidates.length === 1) {
        const { words, title } = loadCandidateFields(candidates[0]);
        setWords(words);
        setSessionTitle(title);
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

    const { words, title } = loadCandidateFields(chosen[0]);
    setQueue(chosen);
    setQueueIndex(0);
    setWords(words);
    setSessionTitle(title);
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

    const title = sessionTitle.trim() || defaultSessionTitle();

    try {
      await createSessionMutation.mutateAsync({
        title,
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
      const { words: nextWords, title: nextTitle } = loadCandidateFields(queue[nextIndex]);
      setQueueIndex(nextIndex);
      setWords(nextWords);
      setSessionTitle(nextTitle);
      return;
    }

    setQueue([]);
    setQueueIndex(0);
    setCurrentStep("session-created");
    setTimeout(() => {
      navigate("/sessions");
    }, 2000);
  };

  const goBack = () => {
    if (currentStep === "camera") {
      navigate("/sessions");
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

  const getStepTitle = () => {
    switch (currentStep) {
      case "camera":
        return "Create New Session - Step 1";
      case "selection":
        return "Create New Session - Step 2";
      case "processing":
        return "Create New Session - Step 3";
      case "edit-words":
        return "Create New Session - Step 4/5";
      case "session-created":
        return "Session Created!";
      default:
        return "Create New Session";
    }
  };

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="px-4 py-6 bg-card border-b border-border">
        <div className="flex items-center space-x-3">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={goBack}
            className="p-2"
            data-testid="button-go-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-semibold text-foreground">{getStepTitle()}</h1>
        </div>
      </div>

      {/* Step Content */}
      {currentStep === "camera" && (
        <CameraCapture
          onImageCapture={handleImageCapture}
          onSkip={handleSkipCamera}
        />
      )}

      {currentStep === "selection" && (
        <div className="px-4 py-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-2">Multiple Units Found</h2>
            <p className="text-sm text-muted-foreground">
              This worksheet has more than one spelling list. Choose which ones to create.
            </p>
          </div>

          <div className="space-y-3 mb-6">
            {multiCandidates.map((candidate, index) => (
              <label
                key={index}
                className="flex items-center space-x-3 p-3 bg-card rounded-lg border border-border cursor-pointer"
                data-testid={`candidate-${index}`}
              >
                <Checkbox
                  checked={selected[index] ?? false}
                  onCheckedChange={() => handleToggleCandidate(index)}
                  data-testid={`checkbox-candidate-${index}`}
                />
                <div className="flex-1">
                  <div className="font-medium text-foreground">{candidate.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {candidate.words.length} {candidate.words.length === 1 ? "word" : "words"}
                  </div>
                </div>
              </label>
            ))}
          </div>

          <Button
            onClick={handleConfirmSelection}
            className="w-full mb-4"
            disabled={!selected.some(Boolean)}
            data-testid="button-confirm-selection"
          >
            Continue
          </Button>

          <Button
            variant="outline"
            onClick={handleRetake}
            className="w-full"
            data-testid="button-retake-photo"
          >
            Retake Photo
          </Button>
        </div>
      )}

      {currentStep === "processing" && (
        <div className="px-4 py-12 flex flex-col items-center justify-center">
          <div className="status-indicator w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-primary-foreground animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
          </div>
          <div className="text-xl font-medium text-foreground mb-2">Analyzing image...</div>
          <div className="text-sm text-muted-foreground">This can take a few seconds.</div>
        </div>
      )}

      {currentStep === "edit-words" && (
        <div className="px-4 py-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-2">Review & Edit Your Word List</h2>
            <p className="text-sm text-muted-foreground">Make any necessary changes to the extracted words or add new ones.</p>
            {queue.length > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                Session {queueIndex + 1} of {queue.length}
              </p>
            )}
          </div>

          {/* Session Title */}
          <div className="mb-6">
            <Input
              placeholder="Session title (optional)"
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              className="w-full"
              data-testid="input-session-title"
            />
          </div>

          {/* Word List */}
          <div className="space-y-3 mb-6">
            {words.map((word, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 bg-card rounded-lg border border-border">
                <span className="w-6 text-sm text-muted-foreground">{index + 1}.</span>
                <Input
                  value={word}
                  onChange={(e) => handleWordChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, index)} /* NEW: Added onKeyDown handler */
                  className="flex-1 bg-transparent border-none outline-none"
                  data-testid={`input-word-${index}`}
                  placeholder="Enter word..." /* NEW: Added placeholder */
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveWord(index)}
                  className="p-1 text-destructive hover:bg-destructive/10"
                  data-testid={`button-remove-word-${index}`}
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
            data-testid="button-add-word"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add New Word
          </Button>

          <Button
            onClick={handleConfirmWordList}
            className="w-full mb-4"
            disabled={createSessionMutation.isPending}
            data-testid="button-confirm-word-list"
          >
            {createSessionMutation.isPending ? "Creating..." : "Confirm Word List"}
          </Button>

          <Button
            variant="outline"
            onClick={handleRetake}
            className="w-full"
            data-testid="button-retake-photo"
          >
            Retake Photo
          </Button>
        </div>
      )}

      {currentStep === "session-created" && (
        <div className="px-4 py-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-6">
            <Check className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Session Created Successfully!</h1>
          <p className="text-muted-foreground mb-8 max-w-sm">
            Your new spelling session is ready. You will be redirected shortly to the sessions list.
          </p>
          
          <Button
            onClick={() => navigate("/sessions")}
            className="w-full max-w-xs"
            data-testid="button-go-to-sessions"
          >
            Go to Sessions List
          </Button>
        </div>
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