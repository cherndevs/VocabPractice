import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Camera, Plus, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import CameraCapture from "@/components/camera-capture";
import { useOCR } from "@/hooks/use-ocr";
import type { InsertSession } from "@shared/schema";

type CreateSessionStep = "camera" | "selection" | "processing" | "edit-words" | "session-created";

export default function CreateSession() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<CreateSessionStep>("camera");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [words, setWords] = useState<string[]>([]);
  const [sessionTitle, setSessionTitle] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  
  const { extractText } = useOCR();

  const createSessionMutation = useMutation({
    mutationFn: async (sessionData: InsertSession) => {
      const response = await apiRequest("POST", "/api/sessions", sessionData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      setCurrentStep("session-created");
      setTimeout(() => {
        navigate("/sessions");
      }, 2000);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create session. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleImageCapture = async (imageData: string) => {
    setCapturedImage(imageData);
    setCurrentStep("processing");
    setIsProcessing(true);
    setProcessingProgress(10);

    try {
      // Simulate processing steps
      setProcessingProgress(25);
      
      // Extract text from image
      const extractedText = await extractText(imageData);
      setProcessingProgress(75);
      
      // Process extracted text into words
      const extractedWords = extractedText
        .split(/\s+/)
        .filter(word => word.length > 0)
        .map(word => word.replace(/[^\w\s]/g, '').toLowerCase())
        .filter(word => word.length > 2);
      
      setWords(extractedWords);
      setProcessingProgress(100);
      
      setTimeout(() => {
        setIsProcessing(false);
        setCurrentStep("edit-words");
      }, 1000);
      
    } catch (error) {
      console.error('OCR processing failed:', error);
      setIsProcessing(false);
      setCurrentStep("edit-words");
      toast({
        title: "OCR Processing Failed",
        description: "Text extraction failed. You can manually add words.",
        variant: "destructive",
      });
    }
  };

  const handleSkipCamera = () => {
    setCurrentStep("edit-words");
  };

  const handleAddWord = () => {
    setWords([...words, ""]);
  };

  const handleRemoveWord = (index: number) => {
    setWords(words.filter((_, i) => i !== index));
  };

  const handleWordChange = (index: number, value: string) => {
    const newWords = [...words];
    newWords[index] = value;
    setWords(newWords);
  };

  const handleConfirmWordList = () => {
    const filteredWords = words.filter(word => word.trim().length > 0);
    if (filteredWords.length === 0) {
      toast({
        title: "No words",
        description: "Please add at least one word to create a session.",
        variant: "destructive",
      });
      return;
    }

    const title = sessionTitle.trim() || `Spelling Session ${new Date().toLocaleDateString()}`;
    
    createSessionMutation.mutate({
      title,
      words: filteredWords,
      wordCount: filteredWords.length,
      status: "new",
      progress: 0,
      timeSpent: 0,
    });
  };

  const goBack = () => {
    if (currentStep === "camera") {
      navigate("/sessions");
    } else if (currentStep === "edit-words") {
      setCurrentStep("camera");
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case "camera":
        return "Create New Session - Step 1";
      case "selection":
        return "Create New Session - Step 2";
      case "processing":
        return "Create New Session - Step 3";
      case "edit-words":
        return "Create New Session - Step 4/5";
      case "session-created":
        return "Session Created!";
      default:
        return "Create New Session";
    }
  };

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="px-4 py-6 bg-card border-b border-border">
        <div className="flex items-center space-x-3">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={goBack}
            className="p-2"
            data-testid="button-go-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-semibold text-foreground">{getStepTitle()}</h1>
        </div>
      </div>

      {/* Step Content */}
      {currentStep === "camera" && (
        <CameraCapture
          onImageCapture={handleImageCapture}
          onSkip={handleSkipCamera}
        />
      )}

      {currentStep === "processing" && (
        <div className="px-4 py-12 flex flex-col items-center justify-center">
          <div className="status-indicator w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-primary-foreground animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
          </div>
          <div className="text-xl font-medium text-foreground mb-2">Analyzing image...</div>
          <Progress value={processingProgress} className="w-48 mb-2" />
          <div className="text-sm text-muted-foreground">{processingProgress}%</div>
        </div>
      )}

      {currentStep === "edit-words" && (
        <div className="px-4 py-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-2">Review & Edit Your Word List</h2>
            <p className="text-sm text-muted-foreground">Make any necessary changes to the extracted words or add new ones.</p>
          </div>

          {/* Session Title */}
          <div className="mb-6">
            <Input
              placeholder="Session title (optional)"
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              className="w-full"
              data-testid="input-session-title"
            />
          </div>

          {/* Word List */}
          <div className="space-y-3 mb-6">
            {words.map((word, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 bg-card rounded-lg border border-border">
                <span className="w-6 text-sm text-muted-foreground">{index + 1}.</span>
                <Input
                  value={word}
                  onChange={(e) => handleWordChange(index, e.target.value)}
                  className="flex-1 bg-transparent border-none outline-none"
                  data-testid={`input-word-${index}`}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveWord(index)}
                  className="p-1 text-destructive hover:bg-destructive/10"
                  data-testid={`button-remove-word-${index}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            variant="outline"
            onClick={handleAddWord}
            className="w-full mb-4"
            data-testid="button-add-word"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add New Word
          </Button>

          <Button
            onClick={handleConfirmWordList}
            className="w-full"
            disabled={createSessionMutation.isPending}
            data-testid="button-confirm-word-list"
          >
            {createSessionMutation.isPending ? "Creating..." : "Confirm Word List"}
          </Button>
        </div>
      )}

      {currentStep === "session-created" && (
        <div className="px-4 py-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-6">
            <Check className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Session Created Successfully!</h1>
          <p className="text-muted-foreground mb-8 max-w-sm">
            Your new spelling session is ready. You will be redirected shortly to the sessions list.
          </p>
          
          <Button
            onClick={() => navigate("/sessions")}
            className="w-full max-w-xs"
            data-testid="button-go-to-sessions"
          >
            Go to Sessions List
          </Button>
        </div>
      )}
    </div>
  );
}
