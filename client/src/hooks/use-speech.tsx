
import { useState, useRef, useCallback } from "react";

export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported] = useState(() => 'speechSynthesis' in window);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const hasUserInteracted = useRef(false);

  // Ensure voices are loaded
  const ensureVoicesLoaded = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) {
        resolve();
        return;
      }

      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        resolve();
        return;
      }

      // Wait for voices to load
      const handleVoicesChanged = () => {
        window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
        resolve();
      };
      
      window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
      
      // Fallback timeout
      setTimeout(() => {
        window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
        resolve();
      }, 3000);
    });
  }, []);

  const speak = async (text: string, options?: { rate?: number; pitch?: number; volume?: number }): Promise<void> => {
    console.log('=== SPEECH ATTEMPT ===');
    console.log('Text:', text);
    console.log('Supported:', isSupported);
    console.log('User interacted:', hasUserInteracted.current);
    
    if (!isSupported || !text?.trim()) {
      console.log('Speech not supported or no text');
      return;
    }

    // Mark that user has interacted (calling speak counts as interaction)
    hasUserInteracted.current = true;

    try {
      // Cancel any existing speech
      window.speechSynthesis.cancel();
      
      // Wait a bit for cancellation to complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Ensure voices are loaded
      await ensureVoicesLoaded();
      
      return new Promise((resolve, reject) => {
        try {
          const utterance = new SpeechSynthesisUtterance(text.trim());
          utteranceRef.current = utterance;

          // Set speech properties
          utterance.rate = options?.rate || 0.9;
          utterance.pitch = options?.pitch || 1;
          utterance.volume = options?.volume || 1;
          utterance.lang = "en-US";

          // Try to use a specific voice if available
          const voices = window.speechSynthesis.getVoices();
          const englishVoice = voices.find(voice => 
            voice.lang.startsWith('en') && !voice.name.includes('Google')
          );
          if (englishVoice) {
            utterance.voice = englishVoice;
          }

          let hasStarted = false;
          let hasEnded = false;

          utterance.onstart = () => {
            console.log('✅ Speech started successfully');
            hasStarted = true;
            setIsSpeaking(true);
          };

          utterance.onend = () => {
            console.log('✅ Speech ended successfully');
            if (!hasEnded) {
              hasEnded = true;
              setIsSpeaking(false);
              resolve();
            }
          };

          utterance.onerror = (event) => {
            console.error('❌ Speech error:', event.error);
            setIsSpeaking(false);
            
            if (!hasEnded) {
              hasEnded = true;
              // Don't reject on cancellation - this is normal
              if (event.error === 'canceled' || event.error === 'interrupted') {
                resolve();
              } else {
                reject(new Error(`Speech error: ${event.error}`));
              }
            }
          };

          // Start speech synthesis
          console.log('🎵 Starting speech synthesis...');
          window.speechSynthesis.speak(utterance);
          
          // Fallback timeout in case events don't fire
          setTimeout(() => {
            if (!hasStarted && !hasEnded) {
              console.log('⚠️ Speech timeout - forcing completion');
              setIsSpeaking(false);
              if (!hasEnded) {
                hasEnded = true;
                resolve();
              }
            }
          }, 10000); // 10 second timeout

        } catch (error) {
          console.error('❌ Speech setup error:', error);
          setIsSpeaking(false);
          reject(error);
        }
      });

    } catch (error) {
      console.error('❌ Speech promise error:', error);
      setIsSpeaking(false);
      throw error;
    }
  };

  const cancel = useCallback(() => {
    if (isSupported && window.speechSynthesis) {
      console.log('🛑 Cancelling speech');
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [isSupported]);

  const pause = useCallback(() => {
    if (isSupported && window.speechSynthesis && isSpeaking) {
      window.speechSynthesis.pause();
    }
  }, [isSupported, isSpeaking]);

  const resume = useCallback(() => {
    if (isSupported && window.speechSynthesis) {
      window.speechSynthesis.resume();
    }
  }, [isSupported]);

  return {
    speak,
    cancel,
    pause,
    resume,
    isSpeaking,
    isSupported,
  };
}
