import { useState, useRef } from "react";

export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported] = useState(() => 'speechSynthesis' in window);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = async (text: string, options?: { rate?: number; pitch?: number; volume?: number }): Promise<void> => {
    console.log('=== SPEECH HOOK DEBUG ===');
    console.log('isSupported:', isSupported);
    console.log('text:', text);
    console.log('speechSynthesis available:', 'speechSynthesis' in window);
    
    if (!isSupported) {
      console.error('Speech synthesis not supported');
      return;
    }
    
    if (!text) {
      console.error('No text provided');
      return;
    }

    // Cancel any ongoing speech
    console.log('Cancelling existing speech...');
    window.speechSynthesis.cancel();

    return new Promise((resolve, reject) => {
      try {
        console.log('Creating utterance...');
        const utterance = new SpeechSynthesisUtterance(text);
        utteranceRef.current = utterance;

        // Set speech properties
        utterance.rate = options?.rate || 0.8;
        utterance.pitch = options?.pitch || 1;
        utterance.volume = options?.volume || 1;
        utterance.lang = "en-US";

        utterance.onstart = () => {
          console.log('Speech started');
          setIsSpeaking(true);
        };

        utterance.onend = () => {
          console.log('Speech ended');
          setIsSpeaking(false);
          resolve();
        };

        utterance.onerror = (event) => {
          console.error('Speech error:', event.error);
          setIsSpeaking(false);
          // Don't reject on cancellation - this is normal behavior
          if (event.error === 'canceled' || event.error === 'interrupted') {
            resolve();
          } else {
            reject(new Error(`Speech synthesis error: ${event.error}`));
          }
        };

        console.log('Starting speech synthesis...');
        window.speechSynthesis.speak(utterance);
        console.log('Speech synthesis command sent');
      } catch (error) {
        setIsSpeaking(false);
        reject(error);
      }
    });
  };

  const cancel = () => {
    if (isSupported) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const pause = () => {
    if (isSupported && isSpeaking) {
      window.speechSynthesis.pause();
    }
  };

  const resume = () => {
    if (isSupported) {
      window.speechSynthesis.resume();
    }
  };

  return {
    speak,
    cancel,
    pause,
    resume,
    isSpeaking,
    isSupported,
  };
}
