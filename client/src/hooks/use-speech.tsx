
import { useState, useCallback } from "react";

export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported] = useState(() => 'speechSynthesis' in window);

  // Function to detect language based on text content
  const detectLanguage = useCallback((text: string): string => {
    const trimmedText = text.trim();
    
    // Check for Chinese characters (both simplified and traditional)
    const chineseRegex = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;
    if (chineseRegex.test(trimmedText)) {
      return 'zh-CN'; // Chinese Simplified
    }
    
    // Check for pinyin (contains tone marks or is all lowercase letters with spaces)
    const pinyinRegex = /^[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ\s]+$/i;
    if (pinyinRegex.test(trimmedText) && trimmedText.includes(' ') && !/[A-Z]/.test(trimmedText)) {
      return 'zh-CN'; // Use Chinese voice for pinyin too
    }
    
    // Default to English
    return 'en-US';
  }, []);

  const speak = useCallback(async (text: string): Promise<void> => {
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
        utterance.rate = 0.8;
        utterance.volume = 1.0;
        utterance.lang = detectLanguage(text);

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
          console.log('🗣️ Speaking:', text);
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
    cancel,
    pause,
    resume,
    isSpeaking,
    isSupported,
  };
}
