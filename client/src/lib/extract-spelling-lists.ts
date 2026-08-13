/** Posts a prepared worksheet image to the extraction endpoint and returns the raw response body for the sanitizer to clean up. */
export async function extractSpellingLists(image: Blob): Promise<unknown> {
  const res = await fetch("/api/extract-spelling-lists", {
    method: "POST",
    headers: { "Content-Type": image.type || "image/jpeg" },
    body: image,
    credentials: "include",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || `Extraction failed (${res.status}).`);
  }

  return res.json();
}
