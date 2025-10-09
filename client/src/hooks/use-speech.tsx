import { useState, useCallback, useEffect } from "react";

export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported] = useState(() => 'speechSynthesis' in window);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Load available voices; on mobile they may appear asynchronously
  useEffect(() => {
    if (!isSupported) return;

    const loadVoices = () => {
      const loaded = window.speechSynthesis.getVoices();
      if (loaded && loaded.length) {
        setVoices(loaded);
      }
    };

    loadVoices();
    const handler = () => loadVoices();
    (window.speechSynthesis as any).onvoiceschanged = handler;
    return () => {
      if ((window.speechSynthesis as any).onvoiceschanged === handler) {
        (window.speechSynthesis as any).onvoiceschanged = null;
      }
    };
  }, [isSupported]);

  // Auto-detect language based on text content
  const detectLanguage = useCallback((text: string): string => {
    if (/[\u4e00-\u9fff]/.test(text)) {
      return 'zh-CN'; // Chinese characters detected
    }
    return 'en-US'; // Default to English
  }, []);

  // Pick a best-fit, high-quality voice for the language
  const pickVoice = useCallback((lang: string): SpeechSynthesisVoice | null => {
    if (!voices.length) return null;
    const lc = lang.toLowerCase();

    // Heuristics for higher-quality voices across platforms
    const QUALITY_HINTS = [
      'siri', 'enhanced', 'premium', 'high', 'natural', 'hq', 'neural'
    ];

    const qualityScore = (v: SpeechSynthesisVoice): number => {
      const name = (v.name || '').toLowerCase();
      let score = 0;
      // Prefer localService voices (downloaded on device)
      if (v.localService) score += 2;
      // Prefer default
      if (v.default) score += 1;
      // Prefer known high-quality hints
      if (QUALITY_HINTS.some(h => name.includes(h))) score += 3;
      // Deprioritize compact voices
      if (name.includes('compact')) score -= 2;
      return score;
    };

    const byScoreDesc = (a: SpeechSynthesisVoice, b: SpeechSynthesisVoice) => qualityScore(b) - qualityScore(a);

    // 1) Exact lang-region match
    const exact = voices.filter(v => v.lang?.toLowerCase() === lc).sort(byScoreDesc);
    if (exact.length) return exact[0];

    // 2) If Chinese requested, accept any zh-* voice (sorted by quality)
    if (lc.startsWith('zh')) {
      const zh = voices.filter(v => v.lang?.toLowerCase().startsWith('zh')).sort(byScoreDesc);
      if (zh.length) return zh[0];
    }

    // 3) Same base language (e.g., en-* for en-US)
    const base = lc.split('-')[0];
    const sameBase = voices.filter(v => v.lang?.toLowerCase().startsWith(base)).sort(byScoreDesc);
    if (sameBase.length) return sameBase[0];

    return null;
  }, [voices]);

  const speak = useCallback(async (text: string, options?: {
    lang?: string;
    rate?: number;
    pitch?: number;
    volume?: number;
    voice?: SpeechSynthesisVoice;
  }): Promise<void> => {
    if (!isSupported || !text?.trim()) {
      throw new Error('Speech not supported or no text');
    }

    // Stop any existing speech
    window.speechSynthesis.cancel();

    // Wait a bit for cleanup
    await new Promise(resolve => setTimeout(resolve, 100));

    return new Promise((resolve, reject) => {
      try {
        const utterance = new SpeechSynthesisUtterance(text.trim());

        // Auto-detect language if not provided
        const language = options?.lang || detectLanguage(text);
        utterance.lang = language;

        // Log what voice options we received
        if (options?.voice) {
          console.log('[TTS DEBUG] useSpeech.speak: Received voice option:', {
            name: options.voice.name,
            voiceURI: options.voice.voiceURI,
            lang: options.voice.lang,
            default: options.voice.default,
            localService: options.voice.localService
          });
        } else {
          console.log('[TTS DEBUG] useSpeech.speak: No voice provided in options');
        }

        // Use provided voice if available, otherwise pick best match
        let voiceToUse = options?.voice || pickVoice(language);
        
        if (voiceToUse) {
          utterance.voice = voiceToUse;
          console.log('[TTS DEBUG] useSpeech.speak: Using voice:', {
            name: voiceToUse.name,
            voiceURI: voiceToUse.voiceURI,
            lang: voiceToUse.lang,
            default: voiceToUse.default,
            localService: voiceToUse.localService,
            source: options?.voice ? 'provided' : 'picked'
          });
        } else {
          console.log('[TTS DEBUG] useSpeech.speak: No voice available, using default for lang:', language);
        }

        // Set speech parameters with defaults
        utterance.rate = options?.rate || 0.8;
        utterance.pitch = options?.pitch || 1.0;
        utterance.volume = options?.volume || 1.0;

        let completed = false;
        const cleanup = () => {
          if (!completed) {
            completed = true;
            setIsSpeaking(false);
            resolve();
          }
        };

        utterance.onstart = () => {
          setIsSpeaking(true);
          console.log('🗣️ Speaking:', text, `(${language})`);
        };

        utterance.onend = cleanup;

        utterance.onerror = (e) => {
          console.error('Speech error:', e.error);
          cleanup();
        };

        // Safety timeout
        setTimeout(cleanup, 8000);

        window.speechSynthesis.speak(utterance);
      } catch (error) {
        setIsSpeaking(false);
        reject(error);
      }
    });
  }, [isSupported, detectLanguage, pickVoice]);

  // Convenience methods for specific languages
  const speakEnglish = useCallback(async (text: string, options?: {
    rate?: number;
    pitch?: number;
    volume?: number;
  }): Promise<void> => {
    return speak(text, { ...options, lang: 'en-US' });
  }, [speak]);

  const speakChinese = useCallback(async (text: string, options?: {
    rate?: number;
    pitch?: number;
    volume?: number;
  }): Promise<void> => {
    return speak(text, { ...options, lang: 'zh-CN' });
  }, [speak]);

  const cancel = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const pause = useCallback(() => {
    // Simplified pause - just cancel for now
    cancel();
  }, [cancel]);

  const resume = useCallback(() => {
    // Resume not implemented - user will need to click play again
  }, []);

  return {
    speak,
    speakEnglish,
    speakChinese,
    cancel,
    pause,
    resume,
    isSpeaking,
    isSupported,
  };
}