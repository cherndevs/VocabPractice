
<old_str>
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

  // Remove unused functions for now
  const pause = useCallback(() => {
    // Not implemented yet
  }, []);

  const resume = useCallback(() => {
    // Not implemented yet  
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
</old_str>
<new_str>import { useState, useCallback } from "react";

export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported] = useState(() => 'speechSynthesis' in window);

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
        utterance.lang = 'en-US';

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
  }, [isSupported]);

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
}</new_str>
