
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

    // Handle voice setup first for Chinese content
    const detectedLang = detectLanguage(text);
    let selectedVoice = null;
    
    if (detectedLang === 'zh-CN') {
      // Get available voices
      let voices = window.speechSynthesis.getVoices();
      
      // If no voices loaded yet, wait for them
      if (voices.length === 0) {
        console.log('🔄 Loading voices...');
        await new Promise(resolve => setTimeout(resolve, 200));
        voices = window.speechSynthesis.getVoices();
      }
      
      console.log('🎵 Available voices:', voices.map(v => `${v.name} (${v.lang})`));
      
      // More comprehensive Chinese voice search
      selectedVoice = voices.find(voice => {
        const name = voice.name.toLowerCase();
        const lang = voice.lang.toLowerCase();
        
        return (
          // Language code patterns
          lang.startsWith('zh') ||
          lang.includes('cn') ||
          lang.includes('chinese') ||
          // Name patterns
          name.includes('chinese') ||
          name.includes('mandarin') ||
          name.includes('cantonese') ||
          name.includes('taiwan') ||
          name.includes('hong kong') ||
          name.includes('simplified') ||
          name.includes('traditional') ||
          // Common Chinese voice names
          name.includes('ting-ting') ||
          name.includes('sin-ji') ||
          name.includes('mei-jia') ||
          name.includes('yaoyao') ||
          name.includes('huihui') ||
          name.includes('kangkang')
        );
      });
      
      if (selectedVoice) {
        console.log('🎌 Found Chinese voice:', selectedVoice.name, '(' + selectedVoice.lang + ')');
      } else {
        console.log('⚠️ No Chinese voice found among', voices.length, 'available voices');
      }
    }

    return new Promise((resolve, reject) => {
      try {
        const utterance = new SpeechSynthesisUtterance(text.trim());
        
        utterance.rate = 0.8;
        utterance.volume = 1.0;
        utterance.lang = detectedLang;
        
        // Use selected voice if found
        if (selectedVoice) {
          utterance.voice = selectedVoice;
          console.log('🗣️ Using voice:', selectedVoice.name);
        } else if (detectedLang === 'zh-CN') {
          // Try fallback language codes
          const chineseLangCodes = ['zh-CN', 'zh-TW', 'zh-HK', 'zh', 'cmn'];
          utterance.lang = chineseLangCodes[0];
          console.log('🔄 Fallback to language code:', utterance.lang);
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
