import { useState, useRef } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCamera } from "@/hooks/use-camera";

interface CameraCaptureProps {
  onImageCapture: (imageData: string) => void;
  onSkip: () => void;
}

export default function CameraCapture({ onImageCapture, onSkip }: CameraCaptureProps) {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const { startCamera, stopCamera, capturePhoto, error } = useCamera(videoRef);

  const handleStartCamera = async () => {
    const success = await startCamera();
    if (success) {
      setIsCameraActive(true);
    }
  };

  const handleCapture = async () => {
    const imageData = await capturePhoto(canvasRef);
    if (imageData) {
      onImageCapture(imageData);
      stopCamera();
      setIsCameraActive(false);
    }
  };

  const handleCancel = () => {
    stopCamera();
    setIsCameraActive(false);
  };

  return (
    <div className="px-4 py-8 flex flex-col items-center justify-center min-h-[60vh]">
      {!isCameraActive ? (
        <>
          <div className="camera-frame w-64 h-48 flex flex-col items-center justify-center mb-6 border-2 border-dashed border-border rounded-lg bg-muted">
            <Camera className="w-16 h-16 text-muted-foreground mb-4" strokeWidth={1.5} />
            <div className="text-center">
              <div className="font-medium text-foreground mb-1">Tap to capture worksheet</div>
              <div className="text-sm text-muted-foreground">Align your worksheet within the frame to extract words</div>
            </div>
          </div>
          
          <Button 
            onClick={handleStartCamera} 
            className="w-full max-w-xs mb-4"
            data-testid="button-start-camera"
          >
            <Camera className="w-4 h-4 mr-2" />
            Start Camera
          </Button>
          
          <Button 
            variant="outline" 
            onClick={onSkip} 
            className="w-full max-w-xs"
            data-testid="button-skip-camera"
          >
            Skip for now
          </Button>
          
          {error && (
            <p className="text-destructive text-sm mt-2 text-center max-w-xs">
              {error}
            </p>
          )}
        </>
      ) : (
        <>
          <div className="relative w-full max-w-sm mb-6">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full rounded-lg"
              data-testid="video-camera-feed"
            />
            {/* Selection overlay */}
            <div className="absolute inset-4 border-2 border-primary border-dashed rounded">
              <div className="absolute -top-2 -left-2 w-4 h-4 bg-primary rounded-full"></div>
              <div className="absolute -top-2 -right-2 w-4 h-4 bg-primary rounded-full"></div>
              <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-primary rounded-full"></div>
              <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-primary rounded-full"></div>
            </div>
          </div>
          
          <div className="flex space-x-4">
            <Button 
              variant="outline" 
              onClick={handleCancel}
              data-testid="button-cancel-camera"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCapture}
              data-testid="button-capture-photo"
            >
              Capture Photo
            </Button>
          </div>
        </>
      )}
      
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
