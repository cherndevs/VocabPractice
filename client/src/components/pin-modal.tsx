import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PinModalProps {
  open: boolean;
  onVerify: (pin: string) => Promise<boolean>;
  onClose?: () => void;
  isLoading?: boolean;
}

export default function PinModal({ open, onVerify, onClose, isLoading }: PinModalProps) {
  const [pin, setPin] = useState<string[]>(["", "", "", "", "", ""]);
  const [error, setError] = useState<string>("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleInputChange = (index: number, value: string) => {
    // Only allow digits
    if (!/^\d*$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value.slice(-1); // Only keep last character
    setPin(newPin);
    setError("");

    // Auto-advance to next input if digit entered
    if (newPin[index] && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text").slice(0, 6);
    if (/^\d{1,6}$/.test(pastedText)) {
      const newPin = pastedText.padEnd(6, "").split("");
      setPin(newPin);
      setError("");
      // Focus last filled input
      const lastIndex = Math.min(pastedText.length, 5);
      inputRefs.current[lastIndex]?.focus();
    }
  };

  const handleSubmit = async () => {
    const fullPin = pin.join("");
    if (fullPin.length !== 6) {
      setError("Please enter all 6 digits");
      return;
    }
    
    try {
      const success = await onVerify(fullPin);
      if (!success) {
        setError("Incorrect PIN. Please try again.");
        setPin(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError("Verification failed. Please try again.");
      setPin(["", "", "", "", "", ""]);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      // Reset when modal opens
      setPin(["", "", "", "", "", ""]);
      setError("");
      setTimeout(() => inputRefs.current[0]?.focus(), 0);
    } else {
      // Close button clicked
      onClose?.();
    }
  };

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRefs.current[0]?.focus(), 0);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-full max-w-sm">
        <DialogHeader>
          <DialogTitle>Enter PIN</DialogTitle>
          <DialogDescription>Enter your 6-digit PIN to access settings</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2 justify-center">
            {pin.map((digit, index) => (
              <Input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleInputChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                placeholder="•"
                className="w-12 h-12 text-center text-2xl font-bold tracking-widest"
                disabled={isLoading}
              />
            ))}
          </div>

          <Button
            onClick={handleSubmit}
            disabled={isLoading || pin.join("").length !== 6}
            className="w-full"
          >
            {isLoading ? "Verifying..." : "Verify"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
