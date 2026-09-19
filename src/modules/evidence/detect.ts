import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/*
 * Finding what to hide, decided 2026-09-19 (D06, D07), revised the same day
 * after measuring it.
 *
 * The first build asked the model for bounding boxes and drew them on the
 * picture. Checked against a fictional transcript, it named the right four
 * items and put every box about 85 pixels above its line: the student id
 * happened to be covered, the date of birth partly, and the home address and
 * phone number not at all. Four plausible black rectangles that leave the
 * address readable are worse than none, because they invite the owner to press
 * publish without reading.
 *
 * A vision model identifies well and localises badly, so this asks only what it
 * is good at: what private things are in the document, and the words it read.
 * The owner draws every box themselves, working through the list.
 *
 * Two rules hold throughout:
 *
 * - A failure returns no findings and never blocks review. A model outage must
 *   not stop the owner working.
 * - Nothing here ever reports that an image is clean. An empty list means the
 *   model found nothing, which is not the same thing.
 */

export type Finding = {
  /** What kind of private detail this is, in a few words. */
  label: string;
  /** The text the model read, so the owner can find it on the page. */
  text: string;
  /** Roughly where to look, in the model's words. Never used to place a box. */
  whereabouts: string;
};

export type DetectionOutcome = {
  findings: Finding[];
  /** Why there are none, when that is not simply "it found none". */
  unavailable?: string;
};

/** The owner picked Haiku for this app's AI work; the variable can override it. */
const DEFAULT_MODEL = "claude-haiku-4-5";
const MAX_FINDINGS = 20;

const findingSchema = {
  type: "object",
  additionalProperties: false,
  required: ["findings"],
  properties: {
    findings: {
      type: "array",
      description: "Private personal details visible in the document.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "text", "whereabouts"],
        properties: {
          label: { type: "string", description: "The kind of detail, e.g. 'Student ID number'." },
          text: { type: "string", description: "The exact text as it appears, so a reader can find it." },
          whereabouts: { type: "string", description: "Where on the page it sits, e.g. 'fourth line of the header block'." },
        },
      },
    },
  },
} as const;

const INSTRUCTIONS = `You are helping someone review a document before it is published publicly.

List every piece of private personal information visible in this image:
student or employee ID numbers, government identifiers, dates of birth, home
addresses, phone numbers, personal email addresses, signatures, faces, and
account or reference numbers.

Do NOT list the thing the document is meant to prove. A transcript's grades, an
offer letter's job title and company, a result or a score are the point of the
document and must stay readable. A person's own name is usually the point too;
list it only where it appears alongside an identifier.

For each one give a short label, the exact text as written so the reviewer can
find it on the page, and a plain description of where it sits. Do not estimate
coordinates. Return an empty list if you find nothing.`;

function client(): Anthropic {
  // The SDK reads ANTHROPIC_API_KEY itself; the key is never handled here.
  return new Anthropic();
}

function usable(findings: unknown): Finding[] {
  if (!Array.isArray(findings)) return [];
  const out: Finding[] = [];
  for (const entry of findings.slice(0, MAX_FINDINGS)) {
    if (typeof entry !== "object" || entry === null) continue;
    const { label, text, whereabouts } = entry as Record<string, unknown>;
    const cleanLabel = typeof label === "string" ? label.trim().slice(0, 80) : "";
    if (!cleanLabel) continue;
    out.push({
      label: cleanLabel,
      text: typeof text === "string" ? text.trim().slice(0, 200) : "",
      whereabouts: typeof whereabouts === "string" ? whereabouts.trim().slice(0, 200) : "",
    });
  }
  return out;
}

/**
 * Lists the private details visible in an image, for the owner to find and
 * cover. Never throws: every failure becomes an empty list with a reason.
 */
export async function findSensitiveItems(
  image: Uint8Array,
  contentType: string,
): Promise<DetectionOutcome> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { findings: [], unavailable: "Automatic checking is not configured. Read the image yourself." };
  }
  if (!["image/png", "image/jpeg", "image/webp"].includes(contentType)) {
    return { findings: [], unavailable: "Automatic checking does not run on this file type." };
  }

  try {
    const response = await client().messages.create({
      model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: contentType as "image/png" | "image/jpeg" | "image/webp",
                data: Buffer.from(image).toString("base64"),
              },
            },
            { type: "text", text: INSTRUCTIONS },
          ],
        },
      ],
      output_config: { format: { type: "json_schema", schema: findingSchema } },
    });

    // The model can decline; that is a normal outcome, not a crash.
    if (response.stop_reason === "refusal") {
      return { findings: [], unavailable: "Automatic checking was declined for this image. Read it yourself." };
    }

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");
    if (!text.trim()) return { findings: [] };

    const parsed = JSON.parse(text) as { findings?: unknown };
    return { findings: usable(parsed.findings) };
  } catch (error) {
    // Never surface a provider message: it can carry request details.
    if (error instanceof Anthropic.RateLimitError) {
      return { findings: [], unavailable: "Automatic checking is busy. Read the image yourself, or reload shortly." };
    }
    return { findings: [], unavailable: "Automatic checking could not run. Read the image yourself." };
  }
}
