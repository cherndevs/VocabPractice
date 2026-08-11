import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Play, Pause, Volume2, VolumeX, ChevronLeft, ChevronRight, RotateCcw, Pin, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useSpeech } from "@/hooks/use-speech";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { getPinyinAnnotation } from "@/lib/pinyin";
import { resolveSessionViewMode, type SessionViewMode } from "@/lib/session-mode";
import type { Session, Settings } from "@shared/schema";

export default function PracticeSession() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [mode, setMode] = useState<SessionViewMode>("write");
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [currentRepetition, setCurrentRepetition] = useState(1);
  const [sessionSkipped, setSessionSkipped] = useState<Set<number>>(new Set());
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [timeSpent, setTimeSpent] = useState(0);
  const [sessionStartTime] = useState(Date.now());
  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { speak, cancel, pause, resume, isSpeaking } = useSpeech();
  const { data: session, isLoading: sessionLoading } = useQuery<Session>({
    queryKey: ["/api/sessions", id],
  });
  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });
  // Fallback settings ensure UI and repetition logic work even if settings are undefined. 
  const effectiveSettings = {
    wordRepetitions: settings?.wordRepetitions ?? 2,
    pauseBetweenWords: settings?.pauseBetweenWords ?? 1500,
    enablePauseButton: settings?.enablePauseButton ?? true,
  };
  const updateSessionMutation = useMutation({
    mutationFn: async (updates: Partial<Session>) => {
      const response = await apiRequest("PUT", `/api/sessions/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
    },
  });

  const togglePin = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!session) return;
    const nextPinnedAt = session.pinnedAt ? null : new Date().toISOString();
    await updateSessionMutation.mutateAsync({ pinnedAt: nextPinnedAt as unknown as any });
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

  
  // Update time spent every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeSpent(Math.floor((Date.now() - sessionStartTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionStartTime]);

  // Peek has nothing to show for a word with no pinyin (e.g. English words
  // in a mixed-language session) - fall back to Read if the word changes
  // out from under an open Peek tab.
  const currentWordPinyin = session ? getPinyinAnnotation(session.words[currentWordIndex]) : null;
  useEffect(() => {
    setMode((prev) => resolveSessionViewMode(prev, currentWordPinyin !== null));
  }, [currentWordPinyin]);

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
    const word = session.words[currentWordIndex];
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

    if (currentWordIndex < session.words.length - 1) {
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

  // Finds the next word index in `direction` that isn't in `skipSet`, or null if none remain.
  const findNextUnskippedIndex = (fromIndex: number, direction: 1 | -1, skipSet: Set<number>) => {
    if (!session) return null;
    let idx = fromIndex + direction;
    while (idx >= 0 && idx < session.words.length) {
      if (!skipSet.has(idx)) return idx;
      idx += direction;
    }
    return null;
  };

  const nextWordRead = () => {
    const next = findNextUnskippedIndex(currentWordIndex, 1, sessionSkipped);
    if (next === null) return;
    stopAllPlayback();
    setIsPaused(true);
    setIsPaused(false);
    setIsLooping(false);
    setCurrentWordIndex(next);
    setCurrentRepetition(1);
  };

  const previousWordRead = () => {
    const prev = findNextUnskippedIndex(currentWordIndex, -1, sessionSkipped);
    if (prev === null) return;
    stopAllPlayback();
    setIsPaused(true);
    setIsLooping(false);
    setCurrentWordIndex(prev);
    setCurrentRepetition(1);
  };

  // Session-scoped "I've Got This": marks the word skipped for this session only
  // (never persisted, never affects spaced-repetition), then advances.
  // Falls back to searching backward when nothing unmarked remains ahead (e.g. marking
  // the last word while an earlier word is still unmarked).
  const handleIveGotThis = () => {
    if (!session) return;
    const updated = new Set(sessionSkipped);
    updated.add(currentWordIndex);
    setSessionSkipped(updated);

    const next =
      findNextUnskippedIndex(currentWordIndex, 1, updated) ??
      findNextUnskippedIndex(currentWordIndex, -1, updated);
    if (next !== null) {
      stopAllPlayback();
      setIsPaused(true);
      setIsPaused(false);
      setIsLooping(false);
      setCurrentWordIndex(next);
      setCurrentRepetition(1);
    }
  };

  const handleResetSkipped = () => {
    setSessionSkipped(new Set());
    setCurrentWordIndex(0);
    setCurrentRepetition(1);
    stopAllPlayback();
    setIsPaused(false);
    setIsLooping(false);
    setResetDialogOpen(false);
  };

  const switchMode = (newMode: SessionViewMode) => {
    // Force stop all speech immediately and reset state
    stopAllPlayback();
    setIsPaused(true);
    setIsLooping(false);
    setMode(newMode);
    setCurrentRepetition(1);
    // Reinitialize so it's not automatically set to pause upon first play
    setIsPaused(false);
    // Session-scoped skip marks don't survive a tab switch
    setSessionSkipped(new Set());
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (sessionLoading) {
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

  if (!session) {
    return (
      <div className="px-4 py-6">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Session not found</p>
            <Button onClick={() => navigate("/sessions")} className="mt-4">
              Back to Sessions
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentWord = session.words[currentWordIndex];
  const progressPercentage = Math.floor((sessionSkipped.size / session.words.length) * 100);
  const allWordsSkipped = session.words.length > 0 && sessionSkipped.size === session.words.length;
  const isCurrentWordSkipped = sessionSkipped.has(currentWordIndex);

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="px-4 py-6 bg-card border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate("/sessions")}
              className="p-2"
              data-testid="button-go-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold text-foreground" data-testid="text-session-title">
              {session.title}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="p-2" onClick={togglePin} aria-label={session.pinnedAt ? 'Unpin session' : 'Pin session'}>
              <Pin className={`w-5 h-5 ${session.pinnedAt ? 'text-primary' : ''}`} />
            </Button>
            {mode === "read" && (
              <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-2"
                  onClick={() => setResetDialogOpen(true)}
                  disabled={sessionSkipped.size === 0}
                  aria-label="Reset completed words"
                  data-testid="button-reset-skipped"
                >
                  <RotateCcw className="w-5 h-5" />
                </Button>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset all completed marks?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This clears "I've Got This" marks for this session and takes you back to the first word.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleResetSkipped} data-testid="button-confirm-reset">
                      Reset
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* Mode Toggle */}
        <Tabs value={mode} onValueChange={(value) => switchMode(value as SessionViewMode)} className="mt-4">
          <TabsList className={`grid w-full ${currentWordPinyin ? "grid-cols-3" : "grid-cols-2"}`}>
            <TabsTrigger value="write" data-testid="tab-write">Write</TabsTrigger>
            <TabsTrigger value="read" data-testid="tab-read">Read</TabsTrigger>
            {currentWordPinyin && (
              <TabsTrigger value="peek" data-testid="tab-peek">Peek</TabsTrigger>
            )}
          </TabsList>
        </Tabs>
      </div>

      {/* Read / Peek Mode Content */}
      {(mode === "read" || mode === "peek") && (
        <div className="px-4 py-8">
          {allWordsSkipped ? (
            /* All words marked with "I've Got This" for this session */
            <Card className="mb-8" data-testid="card-all-completed">
              <CardContent className="pt-6 text-center space-y-4">
                <PartyPopper className="w-10 h-10 mx-auto text-primary" />
                <p className="text-lg font-medium text-foreground">All Done!</p>
                <p className="text-sm text-muted-foreground">
                  You've marked every word in this session. Reset to go through them again.
                </p>
                <Button onClick={handleResetSkipped} data-testid="button-reset-to-continue">
                  Reset and try again?
                </Button>
              </CardContent>
            </Card>
          ) : (
          /* Word Display */
          <div className="text-center mb-8">
            <div
              className={`text-4xl font-bold text-foreground ${mode === "peek" && currentWordPinyin ? "" : "mb-6"}`}
              data-testid="text-current-word"
            >
              {currentWord}
            </div>

            {mode === "peek" && currentWordPinyin && (
              <div className="text-lg text-muted-foreground mb-6" data-testid="text-current-word-pinyin">
                {currentWordPinyin}
              </div>
            )}

            {isCurrentWordSkipped && (
              <div className="text-sm text-muted-foreground mb-6" data-testid="badge-word-completed">
                ✓ Marked this session
              </div>
            )}

            {/* Audio Controls */}
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

            {/* Navigation Controls */}
            <div className="flex items-center justify-center space-x-6 mb-6">
              <Button
                variant="outline"
                size="lg"
                className="p-4 rounded-full"
                onClick={previousWordRead}
                disabled={findNextUnskippedIndex(currentWordIndex, -1, sessionSkipped) === null}
                data-testid="button-previous-word"
              >
                <ChevronLeft className="w-6 h-6" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="p-4 rounded-full"
                onClick={nextWordRead}
                disabled={findNextUnskippedIndex(currentWordIndex, 1, sessionSkipped) === null}
                data-testid="button-next-word"
              >
                <ChevronRight className="w-6 h-6" />
              </Button>
            </div>

            {/* Progress Indicator */}
            <div className="text-sm text-muted-foreground mb-8" data-testid="text-progress">
              {currentWordIndex + 1}/{session.words.length} words
            </div>

            {mode === "read" && (
              <Button onClick={handleIveGotThis} data-testid="button-mark-completed">
                I've Got This
              </Button>
            )}
          </div>
          )}

          {/* Session Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Session Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Words Mastered:</span>
                <span className="font-medium text-foreground" data-testid="text-words-completed">
                  {sessionSkipped.size}/{session.words.length}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Time Spent:</span>
                <span className="font-medium text-foreground" data-testid="text-time-spent">
                  {formatTime(timeSpent)}
                </span>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-muted-foreground">Progress:</span>
                  <span className="font-medium text-foreground" data-testid="text-progress-percentage">
                    {progressPercentage}%
                  </span>
                </div>
                <Progress value={progressPercentage} className="w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Write Mode Content */}
      {mode === "write" && (
        <div className="px-4 py-8">
          {/* Word Display Hidden */}
          <div className="text-center mb-8">
            {/* Word Info */}
            <div className="text-sm text-muted-foreground mb-8" data-testid="text-word-info">
              Word {currentWordIndex + 1} of {session.words.length}
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
                disabled={currentWordIndex === session.words.length - 1}
                data-testid="button-skip-word"
              >
                <ChevronRight className="w-8 h-8" />
              </Button>
            </div>

            {/* Done Button - Show when at last word */}
            {currentWordIndex === session.words.length - 1 && (
              <div className="flex items-center justify-center mt-8">
                <Button 
                  variant="default"
                  size="lg"
                  onClick={() => navigate("/sessions")}
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
    </div>
  );
}