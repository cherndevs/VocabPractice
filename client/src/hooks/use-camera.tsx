import { useState, useRef } from "react";

export function useCamera(videoRef: React.RefObject<HTMLVideoElement>) {
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async (): Promise<boolean> => {
    try {
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        // getUserMedia only exists in a secure context — http:// over a LAN
        // address (e.g. testing on a phone against the dev server) won't have it.
        setError(
          "Camera unavailable. The camera only works over HTTPS or on localhost.",
        );
        return false;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" }, // Use back camera if available
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;

      if (!videoRef.current) {
        // Nothing to attach the stream to — release the camera rather than
        // leaving it running with the indicator light on.
        stopCamera();
        setError("Failed to start the camera preview. Please try again.");
        return false;
      }

      videoRef.current.srcObject = stream;
      // iOS Safari doesn't reliably honour the autoplay attribute for a stream
      // attached after mount, so start playback explicitly.
      await videoRef.current.play().catch(() => {});
      return true;
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Failed to access camera. Please ensure camera permissions are granted.");
      return false;
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const capturePhoto = async (canvasRef: React.RefObject<HTMLCanvasElement>): Promise<string | null> => {
    if (!videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) return null;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to base64 data URL
    return canvas.toDataURL("image/jpeg", 0.8);
  };

  return {
    startCamera,
    stopCamera,
    capturePhoto,
    error,
  };
}
