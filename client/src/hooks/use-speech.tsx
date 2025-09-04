import { useState, useCallback } from "react";

export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported] = useState(() => 'speechSynthesis' in window);

  // Auto-detect language based on text content
  const detectLanguage = useCallback((text: string): string => {
    if (/[\u4e00-\u9fff]/.test(text)) {
      return 'zh-CN'; // Chinese characters detected
    }
    return 'en-US'; // Default to English
  }, []);

  const speak = useCallback(async (text: string, options?: {
    lang?: string;
    rate?: number;
    pitch?: number;
    volume?: number;
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
        setTimeout(cleanup, 5000);

        window.speechSynthesis.speak(utterance);
      } catch (error) {
        setIsSpeaking(false);
        reject(error);
      }
    });
  }, [isSupported, detectLanguage]);

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