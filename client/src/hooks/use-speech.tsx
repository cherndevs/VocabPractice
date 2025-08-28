
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
    const pinyinRegex = /^[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ\s]+$/;
    const hasToneMarks = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(trimmedText);
    const isLowerCaseWords = /^[a-z\s]+$/.test(trimmedText) && trimmedText.includes(' ');
    
    if (hasToneMarks || (isLowerCaseWords && trimmedText.split(' ').length <= 3)) {
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
        const detectedLang = detectLanguage(text);
        
        utterance.rate = 0.8;
        utterance.volume = 1.0;
        utterance.lang = detectedLang;

        // Try to find and use a Chinese voice if speaking Chinese content
        if (detectedLang === 'zh-CN') {
          // Get available voices - try multiple times if needed
          let voices = window.speechSynthesis.getVoices();
          
          // If no voices loaded yet, trigger loading and wait briefly
          if (voices.length === 0) {
            window.speechSynthesis.getVoices(); // Trigger loading
            await new Promise(resolve => setTimeout(resolve, 300)); // Brief wait
            voices = window.speechSynthesis.getVoices();
          }
          
          const chineseVoice = voices.find(voice => 
            voice.lang.startsWith('zh') || 
            voice.lang.includes('CN') ||
            voice.name.toLowerCase().includes('chinese') ||
            voice.name.toLowerCase().includes('mandarin') ||
            voice.name.toLowerCase().includes('cantonese')
          );
          
          if (chineseVoice) {
            utterance.voice = chineseVoice;
            console.log('🎌 Using Chinese voice:', chineseVoice.name, chineseVoice.lang);
          } else {
            console.log('⚠️ No Chinese voice found. Available voices:', voices.map(v => `${v.name} (${v.lang})`));
            // Try alternative Chinese language codes
            utterance.lang = 'zh';
          }
        }

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
          console.log('🗣️ Speaking:', text, 'Language:', detectedLang);
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
