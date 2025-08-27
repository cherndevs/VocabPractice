import { useState } from "react";
import { createWorker, Worker } from "tesseract.js";

export function useOCR() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const extractText = async (imageData: string): Promise<string> => {
    setIsProcessing(true);
    setProgress(0);

    let worker: Worker | null = null;

    try {
      worker = await createWorker("eng", 1, {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      const { data: { text } } = await worker.recognize(imageData);
      
      return text.trim();
    } catch (error) {
      console.error("OCR Error:", error);
      throw new Error("Failed to extract text from image");
    } finally {
      if (worker) {
        await worker.terminate();
      }
      setIsProcessing(false);
      setProgress(0);
    }
  };

  return {
    extractText,
    isProcessing,
    progress,
  };
}
