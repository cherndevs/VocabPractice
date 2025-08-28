import { useState, useCallback } from "react";

export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported] = useState(() => 'speechSynthesis' in window);

  const speak = async (text: string): Promise<void> => {
    console.log('🎤 SIMPLE SPEECH - Starting');

    if (!isSupported || !text?.trim()) {
      console.log('❌ Speech not supported or no text');
      throw new Error('Speech not supported');
    }

    // Cancel any existing speech first
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      console.log('🛑 Cancelling existing speech');
      window.speechSynthesis.cancel();
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text.trim());

      // Basic settings
      utterance.rate = 0.8;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      utterance.lang = 'en-US';

      let resolved = false;

      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          setIsSpeaking(false);
          resolve();
        }
      };

      utterance.onstart = () => {
        console.log('✅ Speech started');
        setIsSpeaking(true);
      };

      utterance.onend = () => {
        console.log('✅ Speech ended');
        cleanup();
      };

      utterance.onerror = (event) => {
        console.log('⚠️ Speech error:', event.error);
        cleanup();
      };

      // Safety timeout
      const timeout = setTimeout(() => {
        console.log('⏰ Speech timeout');
        window.speechSynthesis.cancel();
        cleanup();
      }, 5000);

      try {
        console.log('🗣️ Speaking:', text);
        window.speechSynthesis.speak(utterance);

        // Clear timeout when done
        utterance.onend = () => {
          clearTimeout(timeout);
          cleanup();
        };

      } catch (error) {
        clearTimeout(timeout);
        console.error('❌ Speech error:', error);
        setIsSpeaking(false);
        reject(error);
      }
    });
  };

  const cancel = useCallback(() => {
    console.log('🛑 Cancelling speech');
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const pause = useCallback(() => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
    }
  }, []);

  const resume = useCallback(() => {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  }, []);

  return {
    speak,
    cancel,
    pause,
    resume,
    isSpeaking,
    isSupported,
  };
}