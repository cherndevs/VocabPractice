import { createWorker, Worker } from "tesseract.js";

export class OCRService {
  private worker: Worker | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.worker = await createWorker("eng");
      this.isInitialized = true;
    } catch (error) {
      console.error("Failed to initialize OCR worker:", error);
      throw new Error("OCR initialization failed");
    }
  }

  async extractText(imageData: string | File | HTMLImageElement | HTMLCanvasElement): Promise<string> {
    if (!this.worker) {
      await this.initialize();
    }

    if (!this.worker) {
      throw new Error("OCR worker not available");
    }

    try {
      const { data: { text } } = await this.worker.recognize(imageData);
      return text.trim();
    } catch (error) {
      console.error("OCR text extraction failed:", error);
      throw new Error("Failed to extract text from image");
    }
  }

  async processWordList(text: string): Promise<string[]> {
    // Clean and process the extracted text into a word list
    const words = text
      .split(/[\n\r\s]+/)
      .map(word => word.replace(/[^\w\s]/g, '').toLowerCase().trim())
      .filter(word => word.length > 0 && word.length > 2)
      .filter(word => /^[a-zA-Z]+$/.test(word)); // Only alphabetic words

    // Remove duplicates
    return [...new Set(words)];
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
    }
  }
}

export const ocrService = new OCRService();
