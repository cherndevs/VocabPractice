
import { useState, useCallback } from "react";

export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported] = useState(() => 'speechSynthesis' in window);

  const speak = async (text: string): Promise<void> => {
    console.log('🎤 ULTRA SIMPLE SPEECH - Starting with:', text);

    if (!isSupported) {
      console.log('❌ Speech not supported');
      throw new Error('Speech not supported');
    }

    if (!text?.trim()) {
      console.log('❌ No text provided');
      throw new Error('No text provided');
    }

    // Force stop everything first
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    
    // Small delay to ensure clean state
    await new Promise(resolve => setTimeout(resolve, 50));

    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text.trim());
      
      // Simple settings
      utterance.rate = 0.8;
      utterance.volume = 1.0;
      utterance.lang = 'en-US';

      let finished = false;

      const finish = () => {
        if (!finished) {
          finished = true;
          setIsSpeaking(false);
          console.log('✅ Speech finished');
          resolve();
        }
      };

      utterance.onstart = () => {
        console.log('🗣️ Speech started');
        setIsSpeaking(true);
      };

      utterance.onend = finish;
      utterance.onerror = (e) => {
        console.log('⚠️ Speech error (but continuing):', e.error);
        finish();
      };

      // Start speech
      try {
        window.speechSynthesis.speak(utterance);
        console.log('📢 Speech command sent');
        
        // Backup timeout
        setTimeout(finish, 3000);
      } catch (error) {
        console.error('❌ Failed to start speech:', error);
        finish();
      }
    });
  };

  const cancel = useCallback(() => {
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
