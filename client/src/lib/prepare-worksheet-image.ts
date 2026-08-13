/**
 * Re-encodes a captured photo to a JPEG capped at 1568px on its long edge —
 * matching the standard-resolution vision tier extraction is billed against,
 * so a full-resolution capture doesn't cost several times more per call for
 * no accuracy benefit (ADR-0002).
 */
export async function prepareWorksheetImage(
  dataUrl: string,
  maxDimension = 1568,
  quality = 0.8,
): Promise<Blob> {
  const image = await loadImage(dataUrl);

  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare image for upload.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob) throw new Error("Could not prepare image for upload.");
  return blob;
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read captured image."));
    image.src = dataUrl;
  });
}
