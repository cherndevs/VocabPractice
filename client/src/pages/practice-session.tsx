import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Play, Pause, Volume2, ChevronRight, Pin, PartyPopper, CheckCircle2, Mic, Loader2, X, MoreVertical, BookOpen, SquarePen, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useSpeech } from "@/hooks/use-speech";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { usePinSession } from "@/hooks/use-pin-session";
import { getPinyinAnnotation } from "@/lib/pinyin";
import { gradeOutbox } from "@/lib/grade-sync";
import {
  captionFor,
  currentShowing,
  declineReadAloud,
  gradeWord,
  isFinished,
  isGradeEnabled,
  isPeeked,
  isAttemptRunning,
  canListen,
  showsReadAloud,
  isPinyinRevealed,
  peek,
  progress,
  receive,
  startListening,
  startReadFlow,
  stopListening,
  type ReadFlow,
  type RecogniserEvent,
} from "@/lib/read-flow";
import { recognitionLang } from "@/lib/read-aloud-matcher";
import { hasSeenReadAloudNotice, markReadAloudNoticeSeen } from "@/lib/read-aloud-notice";
import { createRecogniser } from "@/lib/speech-recogniser";
import { initialViewMode, resolveSessionViewMode, viewsForSessionType, type SessionViewMode } from "@/lib/session-mode";
import type { Grade, Session, Settings } from "@shared/schema";

type DrillScope = "due" | "all";

/**
 * What a drill is run for: a session, or (with a null id) a refresher, which
 * belongs to no session. Grades from a refresher are saved with no sessionId.
 */
export interface DrillSource {
  id: string | null;
  title: string;
  subject: Session["subject"];
  sessionType: Session["sessionType"];
  pinnedAt: Session["pinnedAt"];
  /** Where Back and "Back to sessions" lead. */
  exitTo: string;
  exitLabel: string;
}

// Loads the session and its drill (the words to practise now), and keys the
// drill by scope so switching restarts it. The words are held as loaded: grades
// refresh review states mid-drill, and the list must not shift under the child.
export default function PracticeSession() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [scope, setScope] = useState<DrillScope>("due");
  const [drill, setDrill] = useState<{ scope: DrillScope; words: string[] } | null>(null);
  const [drillFailed, setDrillFailed] = useState(false);
  const { data: session, isLoading: sessionLoading } = useQuery<Session>({
    queryKey: ["/api/sessions", id],
  });

  useEffect(() => {
    let cancelled = false;
    setDrill(null);
    setDrillFailed(false);
    fetch(`/api/sessions/${id}/drill?scope=${scope}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body: { words: string[] }) => {
        if (!cancelled) setDrill({ scope, words: body.words });
      })
      .catch(() => {
        if (!cancelled) setDrillFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id, scope]);

  if (sessionLoading || (!drill && !drillFailed && session)) {
    return (
      <div className="px-4 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/2"></div>
          <div className="h-32 bg-muted rounded"></div>
          <div className="h-48 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!session || drillFailed || !drill) {
    return (
      <div className="px-4 py-6">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">{session ? "Couldn't load the words" : "Session not found"}</p>
            <Button onClick={() => navigate("/library")} className="mt-4">
              Back to Sessions
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (drill.words.length === 0) {
    return (
      <div className="px-4 py-12 text-center space-y-4" data-testid="section-nothing-due">
        <CheckCircle2 className="w-10 h-10 mx-auto text-success" />
        <p className="text-xl font-semibold text-foreground">Nothing needs review</p>
        <p className="text-sm text-muted-foreground">Every word in {session.title} is up to date.</p>
        <div className="flex flex-col gap-2">
          <Button onClick={() => setScope("all")} data-testid="button-revise-all">Revise all</Button>
          <Button variant="outline" onClick={() => navigate("/library")}>Back to sessions</Button>
        </div>
      </div>
    );
  }

  return (
    <PracticeDrill
      key={drill.scope}
      session={{ ...session, exitTo: "/library", exitLabel: "Back to sessions" }}
      words={drill.words}
      scope={drill.scope}
      onScopeChange={setScope}
    />
  );
}

export function PracticeDrill({
  session,
  words,
  scope,
  onScopeChange,
}: {
  session: DrillSource;
  words: string[];
  /** Absent for a refresher, which has no Revise all. */
  scope?: DrillScope;
  onScopeChange?: (scope: DrillScope) => void;
}) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  // The view the user picked; the view actually shown is derived below, since
  // which views exist depends on the session's type (ADR-0008).
  const [pickedMode, setPickedMode] = useState<SessionViewMode | null>(null);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [currentRepetition, setCurrentRepetition] = useState(1);
  // Reading sessions: the pure Read Mode flow owns the queue and per-word state.
  const [storedReadFlow, setReadFlowState] = useState<ReadFlow | null>(null);
  // Read Aloud: the recogniser adapter, and the first-use notice sheet.
  const recogniserRef = useRef<ReturnType<typeof createRecogniser> | null>(null);
  if (recogniserRef.current === null) recogniserRef.current = createRecogniser();
  const recogniser = recogniserRef.current;
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  // Spelling flow: dictation, then a parent marks each word against the paper
  // (Offline Grading), then done. Marks are by word position.
  const [spellingPhase, setSpellingPhase] = useState<"dictation" | "marking" | "complete">("dictation");
  const [marks, setMarks] = useState<Record<number, "again" | "good">>({});
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { speak, cancel, pause, resume, isSpeaking } = useSpeech();
  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });
  // Fallback settings ensure UI and repetition logic work even if settings are undefined. 
  const effectiveSettings = {
    wordRepetitions: settings?.wordRepetitions ?? 2,
    pauseBetweenWords: settings?.pauseBetweenWords ?? 1500,
    enablePauseButton: settings?.enablePauseButton ?? true,
  };
  const pinSession = usePinSession();

  const togglePin = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!session.id) return;
    await pinSession.mutateAsync({ id: session.id, pinnedAt: session.pinnedAt });
  };

  // Make sure stopAllPlayback logs what it's doing
  // Update stopAllPlayback to set the ref immediately 
  const stopAllPlayback = () => {
    console.log('🛑 STOPPING ALL PLAYBACK AND SETTING PAUSE');

    // Only set pause ref when actually pausing
    isPausedRef.current = true;
    console.log('🚨 SET PAUSE REF TO TRUE');

    window.speechSynthesis.cancel(); // cancel browser speech
    cancel(); // cancel hook
    setIsPaused(true); // may need to clean this up
    //clean up timeout
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };


  // Add this ref at the top with your other refs
  const isPausedRef = useRef(false);

  
  // Stop speech when navigating away or component unmounts
  useEffect(() => {
    const handleBeforeUnload = () => {
      stopAllPlayback(); // Force stop all speech synthesis and clear timeouts
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Stop speech when tab becomes hidden/inactive
        stopAllPlayback();
      }
    };

    // Listen for page unload and visibility changes
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      // Cleanup: stop speech and remove listeners
      stopAllPlayback();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [cancel]);

  
  // Peek has nothing to show for a word with no pinyin (e.g. English words
  // in a mixed-language session) - fall back to Read if the word changes
  // out from under an open Peek tab.
  const isReading = session.sessionType === "reading";
  const readFlow = isReading
    ? (storedReadFlow ?? startReadFlow(words, { readAloud: recogniser.supported }))
    : null;
  const showing = readFlow && !isFinished(readFlow) ? currentShowing(readFlow) : null;
  const activeWord = showing ? showing.word : words[currentWordIndex];
  const currentWordPinyin = activeWord ? getPinyinAnnotation(activeWord) : null;
  const offeredViews = viewsForSessionType(session.sessionType);
  const baseMode =
    pickedMode && offeredViews.includes(pickedMode) ? pickedMode : initialViewMode(session.sessionType);
  const mode = resolveSessionViewMode(baseMode, currentWordPinyin !== null);
  // Peek shows the pinyin, and so does the third miss in Read Aloud.
  const showPinyin = currentWordPinyin !== null && (mode === "peek" || (readFlow !== null && isPinyinRevealed(readFlow)));

  // Peek belongs to one showing: the next word starts back on Read Aloud, now
  // that the Read / Peek tabs (the other way back) are gone.
  const showingKey = showing ? `${readFlow?.done}-${showing.word}` : null;
  useEffect(() => {
    setPickedMode((picked) => (picked === "peek" ? "read" : picked));
  }, [showingKey]);

  // ✅ ADD THE DEBUGGING useEffect RIGHT HERE:
  useEffect(() => {
    console.log('🔄 STATE CHANGE:', {
      isPaused,
      isLooping,
      stack: new Error().stack?.split('\n').slice(1, 4).join('\n') // Show call stack
    });
  }, [isPaused, isLooping]);

  
  // This is the main playWord function
  // It handles the logic for playing a word, including repetitions in write mode

  const playWord = async (repetitionCount: number = 1) => {
    if (!session || isMuted) return;
    const word = activeWord;
    if (!word) return;

    setIsLooping(true)
    setIsPaused(false);

    isPausedRef.current = false; // Reset ref to false
    console.log('🚨 RESET PAUSE REF TO FALSE in playWord');

    // Infer language: Chinese if contains CJK, else English
    let lang = /[\u4e00-\u9fff]/.test(word) ? 'zh-CN' : 'en-US';
    
    // Get selected voice from localStorage and available voices
    const selectedVoicesRaw = localStorage.getItem('selectedVoices');
    const selectedVoices = selectedVoicesRaw ? JSON.parse(selectedVoicesRaw) : {};
    const langKey = lang.startsWith('zh') ? 'zh' : 'en';
    
    // Debug logging
    console.log('[TTS DEBUG] Selected voices from localStorage:', selectedVoicesRaw);
    
    const voicesList = window.speechSynthesis.getVoices();
    console.log('[TTS DEBUG] Voices available at playback:', voicesList.map(v => ({ 
      name: v.name, 
      lang: v.lang, 
      voiceURI: v.voiceURI 
    })));

    // Find the voice object for the selected voice URI
    let selectedVoiceObj: SpeechSynthesisVoice | undefined;
    const selectedVoiceURI = selectedVoices[langKey];
    if (selectedVoiceURI) {
      selectedVoiceObj = voicesList.find(v => v.voiceURI === selectedVoiceURI);
      console.log('[TTS DEBUG] Playback: using selected voice:', 
        selectedVoiceObj?.name, 
        selectedVoiceObj?.voiceURI, 
        selectedVoiceObj?.lang
      );
    } else {
      console.log('[TTS DEBUG] Playback: No voice selected for', langKey, ', using default for:', lang);
    }

    try {
      console.log('🎵 PLAYING:', word, `(repetition ${repetitionCount})`);

  await speak(word, { lang, voice: selectedVoiceObj });
  // Debug: confirm playback finished
  console.log('[TTS DEBUG] Finished speak() for word:', word, 'lang:', lang);
      console.log('✅ PLAYED SUCCESSFULLY');

      // ✨ KEY FIX: Check the REF value instead of state (refs update immediately)
      console.log('🔍 CHECKING STATE AFTER SPEECH:', {
        isPausedState: isPaused,
        isPausedRef: isPausedRef.current,  // This is the real current value
        isMuted,
        mode
      });

      // Use the ref value which updates immediately, not the state which is stale
      if (isPausedRef.current || isMuted || mode !== "write") {
        console.log('❌ NOT SCHEDULING - state changed during speech (using ref)');
        setIsLooping(false);
        return; // Exit early, don't schedule timeout
      }

      // Handle repetitions in write mode (use effective settings fallback)
      if (mode === "write") {
        const maxRepetitions = effectiveSettings.wordRepetitions;
        const pauseDuration = effectiveSettings.pauseBetweenWords;

        if (repetitionCount < maxRepetitions) {
          console.log(`⏰ SCHEDULING NEXT REPETITION IN ${pauseDuration}ms`);

          // Clear any existing timeout first
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }

          const timeoutId = setTimeout(() => {
            console.log('⚡ TIMEOUT FIRED - CHECKING REF');
            console.log('📊 STATE AT TIMEOUT:', {
              mode,
              isMuted,
              isPausedState: isPaused,
              isPausedRef: isPausedRef.current  // Check ref in timeout too
            });

            // Check ref value in timeout as well
            if (mode === "write" && !isMuted && !isPausedRef.current) {
              console.log(`🔄 NEXT REPETITION (${repetitionCount + 1}/${maxRepetitions})`);
              playWord(repetitionCount + 1);
            } else {
              console.log('❌ REPETITION CANCELLED AT TIMEOUT (ref check)');
              setIsLooping(false);
            }
          }, pauseDuration);

          timeoutRef.current = timeoutId;
          console.log('📝 STORED TIMEOUT ID:', timeoutId);

        } else {
          console.log('✅ ALL REPETITIONS COMPLETE - STOPPING');
          setIsLooping(false);
        }
      }
    } catch (error) {
      console.error('❌ SPEECH FAILED:', error);
      setIsLooping(false);
      setIsPaused(true);
    }
  };
  
  /////
  
  const nextWord = () => {
    if (!session) return;
    stopAllPlayback();
    setIsPaused(true);
    setIsPaused(false);  // Reinitialize so it's not automatically set to pause upon first play
    setIsLooping(false);

    if (currentWordIndex < words.length - 1) {
      setCurrentWordIndex(prev => prev + 1);
      setCurrentRepetition(1);
    }
  };

  const startLoop = () => {
    // Force stop all speech immediately and clear timeouts
    stopAllPlayback();
    setIsPaused(false);
    setCurrentWordIndex(0);
    setCurrentRepetition(1);

    // Auto-play the first word when starting loop
    setTimeout(() => {
      playWord(1);
    }, 100);
  };

  const previousWord = () => {
    if (currentWordIndex > 0) {
      // Force stop all speech immediately and clear timeouts
     stopAllPlayback();
      setIsPaused(true);
      setIsLooping(false);
      setCurrentWordIndex(prev => prev - 1);
      setCurrentRepetition(1);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (!isMuted) {
      // Force stop all speech immediately and clear timeouts
      stopAllPlayback();
      setIsPaused(true);
      setIsLooping(false);
    }
  };

  const togglePause = () => {
    if (isPaused) {
      setIsPaused(false);
      setIsLooping(true);
      playWord(1);  // start playback
    } else {
      setIsPaused(true); // Calls function to pause playback
      setIsLooping(false);
      // Force stop all speech immediately and clear timeouts
      stopAllPlayback();
    }
  };

  // Read Aloud. The adapter reports how an attempt ended; the flow decides what it means.
  const readFlowRef = useRef<ReadFlow | null>(null);
  readFlowRef.current = readFlow;
  const applyRecogniserEvent = (event: RecogniserEvent) => {
    console.log("[Read Aloud] recogniser:", JSON.stringify(event));
    setReadFlowState((flow) => {
      const base = flow ?? readFlowRef.current;
      return base ? receive(base, event) : base;
    });
  };

  const beginListening = () => {
    const flow = readFlowRef.current;
    const word = flow && !isFinished(flow) ? currentShowing(flow).word : null;
    if (!flow || !word) return;
    const next = startListening(flow);
    if (next === flow) return;
    setReadFlowState(next);
    recogniser.start(recognitionLang(word), applyRecogniserEvent);
  };

  const handleMicTap = () => {
    const flow = readFlowRef.current;
    if (!flow) return;
    if (flow.wordState.kind === "listening") {
      setReadFlowState(stopListening(flow));
      recogniser.stop();
      return;
    }
    if (!canListen(flow)) return;
    if (!hasSeenReadAloudNotice()) {
      setNoticeOpen(true);
      return;
    }
    beginListening();
  };

  const acceptNotice = () => {
    markReadAloudNoticeSeen();
    setNoticeOpen(false);
    beginListening();
  };

  const declineNotice = () => {
    setNoticeOpen(false);
    if (readFlowRef.current) setReadFlowState(declineReadAloud(readFlowRef.current));
  };

  // Whenever the word leaves an attempt (graded, peeked, restarted), the recogniser is stopped.
  const attemptRunning = readFlow !== null && isAttemptRunning(readFlow);
  useEffect(() => {
    if (!attemptRunning) recogniser.abort();
  }, [attemptRunning, showing?.word, showing?.tryOnceMore]);

  // The microphone must not stay on in the background (ADR-0009): stop on hide,
  // and an attempt that was running just counts as unheard.
  useEffect(() => {
    const stopRecognition = () => {
      const flow = readFlowRef.current;
      const running = flow !== null && isAttemptRunning(flow);
      recogniser.abort();
      if (running) applyRecogniserEvent({ kind: "silence" });
    };
    const onVisibility = () => {
      if (document.hidden) stopRecognition();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", stopRecognition);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", stopRecognition);
      recogniser.abort();
    };
  }, []);

  // Grades the current showing. The outbox does the sending, so the next card
  // appears at once; the flow decides whether the word comes back.
  const handleReadGrade = (grade: Grade) => {
    if (!session || !readFlow) return;
    const { flow, emitted } = gradeWord(readFlow, grade);
    if (!emitted) return;
    gradeOutbox.add({
      subject: session.subject,
      word: emitted.word.trim(),
      skill: "reading",
      grade: emitted.grade,
      sessionId: session.id,
    });
    stopAllPlayback();
    setIsPaused(false);
    setIsLooping(false);
    setReadFlowState(flow);
    // A fresh showing starts on Read, whatever tab the last one ended on.
    setPickedMode("read");
  };

  const restartReading = () => {
    if (!session) return;
    setReadFlowState(startReadFlow(words, { readAloud: recogniser.supported && !readFlow?.readAloudOff }));
    setPickedMode("read");
  };

  const switchMode = (newMode: SessionViewMode) => {
    // Force stop all speech immediately and reset state
    stopAllPlayback();
    setIsPaused(true);
    setIsLooping(false);
    setPickedMode(newMode);
    // Opening Peek locks the positive grades for this showing.
    if (newMode === "peek" && readFlow) setReadFlowState(peek(readFlow));
    setCurrentRepetition(1);
    // Reinitialize so it's not automatically set to pause upon first play
    setIsPaused(false);
  };

  const startMarking = () => {
    stopAllPlayback();
    setIsLooping(false);
    setMarks({});
    setSpellingPhase("marking");
  };

  // Queues the grades and moves on at once; the outbox does the sending.
  const finishMarking = () => {
    if (!session) return;
    words.forEach((word, index) => {
      const mark = marks[index];
      if (!mark) return;
      gradeOutbox.add({
        subject: session.subject,
        word: word.trim(),
        skill: session.sessionType,
        grade: mark,
        sessionId: session.id,
      });
    });
    setSpellingPhase("complete");
  };

  const dictateAgain = () => {
    stopAllPlayback();
    setIsPaused(false);
    setIsLooping(false);
    setCurrentWordIndex(0);
    setCurrentRepetition(1);
    setMarks({});
    setSpellingPhase("dictation");
  };

  // Tap a word while marking to hear it again.
  const speakWord = (word: string) => {
    if (isMuted) return;
    const lang = /[\u4e00-\u9fff]/.test(word) ? "zh-CN" : "en-US";
    void speak(word, { lang }).catch(() => {});
  };

  const readProgress = readFlow ? { ...progress(readFlow), done: readFlow.done } : { position: 0, total: 0, percent: 0, done: 0 };
  const headerTotal = isReading ? readProgress.total : words.length;
  const spellingPosition = spellingPhase === "dictation" ? currentWordIndex + 1 : words.length;
  const headerPosition = isReading ? readProgress.position : Math.min(spellingPosition, headerTotal);
  const headerPercent = isReading
    ? readProgress.percent
    : headerTotal > 0 ? Math.round((headerPosition / headerTotal) * 100) : 0;
  const gradeButtons: { grade: Grade; label: string; tone: string }[] = [
    { grade: "again", label: "Oops", tone: "text-destructive" },
    { grade: "hard", label: "Hard", tone: "text-warning" },
    { grade: "good", label: "OK", tone: "text-primary" },
    { grade: "easy", label: "Easy", tone: "text-success" },
  ];

  return (
    <div className="fade-in">
      {/* Header: end session, progress, count, options (design canvas) */}
      <div className="flex items-center px-3 pt-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(session.exitTo)}
          aria-label="End session"
          className="text-muted-foreground"
          data-testid="button-go-back"
        >
          <X className="w-4 h-4" />
        </Button>
        <div className="mx-3 h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={headerPercent} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${headerPercent}%` }} data-testid="progress-fill" />
        </div>
        <span className="whitespace-nowrap text-xs font-semibold text-muted-foreground" data-testid="text-progress">
          {headerPosition} / {headerTotal}
        </span>
        {session.id && (
          <Button
            variant="ghost"
            size="icon"
            className={`ml-1 ${session.pinnedAt ? "text-primary" : "text-muted-foreground"}`}
            onClick={togglePin}
            aria-label={session.pinnedAt ? "Unpin session" : "Pin session"}
            data-testid="button-pin-session"
          >
            <Pin className="w-4 h-4" />
          </Button>
        )}
        {scope && onScopeChange && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label="Session options" data-testid="button-session-menu">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onScopeChange(scope === "due" ? "all" : "due")} data-testid="button-toggle-scope">
                {scope === "due" ? "Switch to Revise all" : "Switch to due only"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <h1 className="sr-only" data-testid="text-session-title">{session.title}</h1>
      <div className="mx-auto mt-4 flex w-fit items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-bold ${
            isReading ? "bg-skill-reading-bg text-skill-reading" : "bg-skill-writing-bg text-skill-writing"
          }`}
          data-testid="badge-modality"
        >
          {isReading ? <BookOpen className="w-3 h-3" /> : <SquarePen className="w-3 h-3" />}
          {isReading ? "Reading" : "Writing"}
        </span>
        {scope === "all" && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1.5 text-xs font-bold text-muted-foreground" data-testid="badge-revise-all">
            <RotateCw className="w-3 h-3" />
            Revise all
          </span>
        )}
      </div>

      {/* Read / Peek Mode Content */}
      {(mode === "read" || mode === "peek") && readFlow && (
        <div className="px-4 py-8">
          {!showing ? (
            <Card className="mb-8" data-testid="card-all-completed">
              <CardContent className="pt-6 text-center space-y-4">
                <PartyPopper className="w-10 h-10 mx-auto text-primary" />
                <p className="text-lg font-medium text-foreground">All Done!</p>
                <p className="text-sm text-muted-foreground">
                  You've been through every word in this session.
                </p>
                <Button onClick={restartReading} data-testid="button-reset-to-continue">
                  Go again?
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="text-center mb-8">
              {showing.tryOnceMore && (
                <div className="text-sm font-medium text-primary mb-2" data-testid="badge-try-once-more">
                  Try once more
                </div>
              )}
              <div
                className={`text-4xl font-bold text-foreground ${showPinyin ? "" : "mb-6"}`}
                data-testid="text-current-word"
              >
                {showing.word}
              </div>

              {showPinyin && (
                <div className="text-lg text-muted-foreground mb-6" data-testid="text-current-word-pinyin">
                  {currentWordPinyin}
                </div>
              )}

              {mode === "peek" && (
                <div className="flex items-center justify-center space-x-4 mb-8">
                  <Button
                    variant="outline"
                    size="lg"
                    className="p-3 rounded-full"
                    onClick={() => playWord(1)}
                    disabled={isMuted}
                    data-testid="button-play-audio"
                  >
                    <Volume2 className="w-6 h-6" />
                  </Button>
                </div>
              )}

              {/* Read Aloud: mic, caption and Peek. Not shown once self-report takes over or the answer is out. */}
              {mode === "read" && showsReadAloud(readFlow) && (
                <div className="mb-8 space-y-3" data-testid="read-aloud">
                  {readFlow.wordState.kind !== "failed" && readFlow.wordState.kind !== "passed" && (
                    <Button
                      variant="outline"
                      size="lg"
                      className={`p-4 rounded-full h-16 w-16 ${readFlow.wordState.kind === "listening" ? "animate-pulse border-primary" : ""}`}
                      onClick={handleMicTap}
                      disabled={readFlow.wordState.kind === "checking"}
                      aria-label={readFlow.wordState.kind === "listening" ? "Stop and check" : "Read aloud"}
                      data-testid="button-mic"
                    >
                      {readFlow.wordState.kind === "checking" ? (
                        <Loader2 className="w-7 h-7 animate-spin" />
                      ) : (
                        <Mic className="w-7 h-7 text-primary" />
                      )}
                    </Button>
                  )}
                  <div
                    className={`text-sm ${readFlow.wordState.kind === "passed" ? "text-success font-medium" : "text-muted-foreground"}`}
                    data-testid="text-read-aloud-caption"
                  >
                    {captionFor(readFlow)}
                  </div>
                  {/* Debug: what the app heard. Temporary, for checking Read Aloud by ear. */}
                  {readFlow.lastAttempt && (
                    <div className="text-xs text-muted-foreground space-y-0.5" data-testid="text-heard-debug">
                      <div>
                        Judged: [{readFlow.lastAttempt.alternatives[0]}]
                        {readFlow.lastAttempt.confidences ? ` (conf ${readFlow.lastAttempt.confidences[0].toFixed(2)})` : ""}
                        {" "}→ {readFlow.lastAttempt.passed ? `match (${readFlow.lastAttempt.how === "same-pinyin" ? "same pinyin, different characters" : "same text"})` : "no match"}
                      </div>
                      {readFlow.lastAttempt.alternatives.length > 1 && (
                        <div>Also heard, ignored: {readFlow.lastAttempt.alternatives.slice(1).join(" · ")}</div>
                      )}
                    </div>
                  )}
                  {currentWordPinyin && readFlow.wordState.kind !== "passed" && readFlow.wordState.kind !== "failed" && (
                    <button
                      type="button"
                      className="text-sm text-primary underline"
                      onClick={() => switchMode("peek")}
                      data-testid="button-peek-link"
                    >
                      Stuck? Peek
                    </button>
                  )}
                </div>
              )}
              {readFlow.wordState.kind === "unavailable" && mode === "read" && (
                <div className="text-sm text-muted-foreground mb-8" data-testid="text-read-aloud-unavailable">
                  {captionFor(readFlow)}
                </div>
              )}

              <div className="flex gap-2" data-testid="grade-row">
                {gradeButtons.map(({ grade, label, tone }) => (
                  <Button
                    key={grade}
                    variant="outline"
                    className={`flex-1 h-11 font-semibold ${tone} disabled:opacity-40 disabled:cursor-not-allowed`}
                    disabled={!isGradeEnabled(readFlow, grade)}
                    onClick={() => handleReadGrade(grade)}
                    data-testid={`button-grade-${grade}`}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              {isPeeked(readFlow) && (
                <div className="text-xs text-muted-foreground mt-2" data-testid="text-grade-hint">
                  Answer shown, so only Oops is left.
                </div>
              )}
            </div>
          )}

          {/* Up next: one dot per word in the queue, filled as it is graded */}
          {showing && (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 px-6" data-testid="up-next">
              {Array.from({ length: readProgress.total }, (_, i) => {
                const done = i < readProgress.done;
                const current = i === readProgress.done;
                return (
                  <span
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full ${done ? "bg-skill-reading" : "bg-border"} ${current ? "ring-[3px] ring-primary-tint" : ""}`}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Write Mode Content */}
      {mode === "write" && spellingPhase === "marking" && (
        <div className="px-4 py-6" data-testid="section-marking">
          <h2 className="text-xl font-semibold text-foreground">Mark the writing</h2>
          <p className="text-sm text-muted-foreground mb-4">Check each word against the paper. Tap a word to hear it again.</p>
          <ul className="space-y-2">
            {words.map((word, index) => (
              <li key={index} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
                <button
                  type="button"
                  className="text-lg font-medium text-foreground text-left"
                  onClick={() => speakWord(word)}
                  data-testid={`button-hear-word-${index}`}
                >
                  {word}
                </button>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant={marks[index] === "again" ? "destructive" : "outline"}
                    aria-pressed={marks[index] === "again"}
                    onClick={() => setMarks((m) => ({ ...m, [index]: "again" }))}
                    data-testid={`button-oops-${index}`}
                  >
                    Oops
                  </Button>
                  <Button
                    size="sm"
                    variant={marks[index] === "good" ? "default" : "outline"}
                    aria-pressed={marks[index] === "good"}
                    onClick={() => setMarks((m) => ({ ...m, [index]: "good" }))}
                    data-testid={`button-got-it-${index}`}
                  >
                    I've got this
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-2 text-center">
            <div className="text-sm text-muted-foreground" data-testid="text-marked-count">
              {Object.keys(marks).length} of {words.length} marked
            </div>
            <Button
              size="lg"
              className="w-full"
              onClick={finishMarking}
              disabled={Object.keys(marks).length < words.length}
              data-testid="button-finish-marking"
            >
              Finish
            </Button>
          </div>
        </div>
      )}

      {mode === "write" && spellingPhase === "complete" && (
        <div className="px-4 py-12 text-center space-y-6" data-testid="section-complete">
          <CheckCircle2 className="w-10 h-10 mx-auto text-success" />
          <p className="text-xl font-semibold text-foreground">Session complete</p>
          <div className="flex flex-col gap-2">
            <Button onClick={dictateAgain} data-testid="button-review-again">Review again</Button>
            <Button variant="outline" onClick={() => navigate(session.exitTo)} data-testid="button-back-to-sessions">
              {session.exitLabel}
            </Button>
          </div>
        </div>
      )}

      {mode === "write" && spellingPhase === "dictation" && (
        <div className="px-4 py-8">
          {/* Word Display Hidden */}
          <div className="text-center mb-8">
            {/* Word Info */}
            <div className="text-sm text-muted-foreground mb-8" data-testid="text-word-info">
              Word {currentWordIndex + 1} of {words.length}
            </div>

            {/* Audio Controls */}
            <div className="flex items-center justify-center space-x-4 mb-6">
              {!isLooping && (
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="p-4 rounded-full"
                  onClick={() => playWord(1)}
                  disabled={isMuted}
                  data-testid="button-play-word"
                >
                  <Play className="w-8 h-8 text-primary" fill="currentColor" />
                </Button>
              )}

              {settings?.enablePauseButton && isLooping && (
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="p-4 rounded-full"
                  onClick={togglePause}
                  disabled={isMuted}
                  data-testid="button-pause-resume"
                >
                  {isPaused ? (
                    <Play className="w-8 h-8 text-primary" fill="currentColor" />
                  ) : (
                    <Pause className="w-8 h-8 text-primary" fill="currentColor" />
                  )}
                </Button>
              )}

              <Button 
                size="lg" 
                className="p-4 rounded-full"
                onClick={nextWord}
                disabled={currentWordIndex === words.length - 1}
                data-testid="button-skip-word"
              >
                <ChevronRight className="w-8 h-8" />
              </Button>
            </div>

            {/* Done Button - Show when at last word */}
            {currentWordIndex === words.length - 1 && (
              <div className="flex items-center justify-center mt-8">
                <Button 
                  variant="default"
                  size="lg"
                  onClick={startMarking}
                  data-testid="button-done"
                  className="px-8 py-3"
                >
                  Done
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      <Sheet open={noticeOpen} onOpenChange={(open) => { if (!open) declineNotice(); }}>
        <SheetContent side="bottom" data-testid="sheet-read-aloud-notice">
          <SheetHeader>
            <SheetTitle>Before you read aloud</SheetTitle>
            <SheetDescription>
              To check the reading, your browser may send the recording to its speech service (on iPhone, that's Apple). This app never keeps it.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-2">
            <Button onClick={acceptNotice} data-testid="button-notice-ok">OK, start</Button>
            <Button variant="outline" onClick={declineNotice} data-testid="button-notice-not-now">Not now</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}