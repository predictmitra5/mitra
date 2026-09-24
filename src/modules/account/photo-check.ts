/*
 * The automatic check for AI-generated profile photos, decided 2026-09-24.
 * The owner chose this check alone, over approving each photo by hand, camera
 * capture or a paid detector.
 *
 * What it can do: refuse an image whose own metadata says it was generated or
 * composited by AI. Many generators and editors now label their output, in the
 * IPTC "digital source type" that C2PA content credentials also carry, or leave
 * their own settings behind in the file.
 *
 * What it cannot do: judge the pixels. A screenshot, a re-save through most
 * apps or any metadata stripper removes every label, and the image passes.
 * Nothing available can guarantee an image is not AI-generated; the owner was
 * told so. The labels are searched for in the original bytes, before the photo
 * is re-encoded, because re-encoding strips them.
 */

export type AiLabel = { label: string; marker: string };

/**
 * Byte markers, matched exactly and case-sensitively. Each is long and specific
 * enough not to turn up by chance inside compressed image data.
 */
const MARKERS: AiLabel[] = [
  // IPTC digital source types, as used by C2PA manifests, XMP and IPTC blocks:
  // an AI-generated image, and a photo with AI-generated parts. The second is
  // spelled "compositeWithTrainedAlgorithmicMedia", capital T, so it needs its
  // own marker; matching is case-sensitive.
  { label: "labelled as made with AI (content credentials)", marker: "trainedAlgorithmicMedia" },
  { label: "labelled as made with AI (content credentials)", marker: "TrainedAlgorithmicMedia" },
  // Settings that image generators write into their own files.
  { label: "Stable Diffusion settings", marker: "Negative prompt:" },
  { label: "Stable Diffusion settings", marker: "CFG scale:" },
  { label: "a ComfyUI workflow", marker: "\"class_type\"" },
  { label: "a ComfyUI workflow", marker: "KSampler" },
  // Generator names in software and credential fields.
  { label: "Stable Diffusion", marker: "Stable Diffusion" },
  { label: "Midjourney", marker: "Midjourney" },
  { label: "DALL-E", marker: "DALL-E" },
  { label: "DALL-E", marker: "DALL·E" },
  { label: "Adobe Firefly", marker: "Adobe Firefly" },
  { label: "Google Imagen", marker: "Google Imagen" },
  { label: "Bing Image Creator", marker: "Bing Image Creator" },
  { label: "OpenAI", marker: "OpenAI" },
  { label: "NovelAI", marker: "NovelAI" },
  { label: "Leonardo.Ai", marker: "Leonardo.Ai" },
];

const ENCODED = MARKERS.map((entry) => ({ ...entry, bytes: new TextEncoder().encode(entry.marker) }));

function contains(haystack: Uint8Array, needle: Uint8Array): boolean {
  const first = needle[0];
  const last = haystack.length - needle.length;
  outer: for (let i = 0; i <= last; i += 1) {
    if (haystack[i] !== first) continue;
    for (let j = 1; j < needle.length; j += 1) if (haystack[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

/** Every AI label found in the file, deduplicated by what it means. Empty when none. */
export function findAiLabels(bytes: Uint8Array): string[] {
  const found = new Set<string>();
  for (const entry of ENCODED) if (contains(bytes, entry.bytes)) found.add(entry.label);
  return [...found];
}
