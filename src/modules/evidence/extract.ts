import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { isAcceptedImageType, MAX_STATEMENT_LENGTH } from "./policy";

/*
 * Reading a document, decided 2026-09-19 (D06, D07, revised the same day).
 *
 * This replaces the redaction detector. That one asked for bounding boxes and,
 * measured against a fictional transcript, named the right four private items
 * while placing every box about 85 pixels too high: the home address and phone
 * number stayed readable under boxes that looked like the job was done. The
 * same run read every value exactly right.
 *
 * So the model is asked for what it demonstrably does well: read the document
 * and say what it shows. Nothing it returns is published. The owner reads the
 * original themselves, edits the wording, and publishes their own sentence.
 *
 * Two rules hold throughout:
 *
 * - A failure returns nothing and never blocks review. The owner can always
 *   write the statement themselves.
 * - Nothing here ever claims a document was verified. It proposes wording; the
 *   owner's confirmation is what makes a statement a verified one.
 */

export type Proposal = {
  /** A publishable sentence: the fact, without the private detail around it. */
  statement: string;
  /** What in the document supports it, so the owner can check rather than trust. */
  basis: string;
};

export type ExtractionOutcome = {
  proposals: Proposal[];
  /** What the model noticed that must not be published. Never published itself. */
  privateDetails: string[];
  /** Why there is nothing, when that is not simply "it found nothing". */
  unavailable?: string;
};

/** The owner picked Haiku for this app's AI work; the variable can override it. */
const DEFAULT_MODEL = "claude-haiku-4-5";
const MAX_PROPOSALS = 6;
const MAX_PRIVATE = 20;

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["proposals", "private_details"],
  properties: {
    proposals: {
      type: "array",
      description: "Publishable statements of what the document shows about the goal.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["statement", "basis"],
        properties: {
          statement: {
            type: "string",
            description: "One short sentence stating the fact, with no private detail in it.",
          },
          basis: {
            type: "string",
            description: "What in the document supports it, so a reviewer can check it.",
          },
        },
      },
    },
    private_details: {
      type: "array",
      description: "Private personal details present in the document. These are never published.",
      items: { type: "string" },
    },
  },
} as const;

function instructions(question: string, criteria: string): string {
  return `A person submitted this document as proof for a goal they set about themselves.

The goal: ${question}

What counts as meeting it: ${criteria}

The document itself will never be published. Only a short statement will be,
and only after a human confirms it. Do two things:

1. Propose at most ${MAX_PROPOSALS} statements that could be published. Each is one short
   sentence stating what the document shows about this goal, carrying no
   private detail: no ID numbers, dates of birth, addresses, phone numbers or
   account numbers. "Fall 2026 term GPA is 3.85" is right. Say what the
   document shows, not whether the goal was met - that is the reviewer's call.
   For each, say what in the document supports it so the reviewer can check.

2. List the private personal details you can see in the document, so the
   reviewer knows what must never be carried across.

If the document does not bear on this goal at all, return no proposals and say
so is not your job - just return an empty list. Keep each statement under
${MAX_STATEMENT_LENGTH} characters.`;
}

function client(): Anthropic {
  // The SDK reads ANTHROPIC_API_KEY itself; the key is never handled here.
  return new Anthropic();
}

function usableProposals(value: unknown): Proposal[] {
  if (!Array.isArray(value)) return [];
  const out: Proposal[] = [];
  for (const entry of value.slice(0, MAX_PROPOSALS)) {
    if (typeof entry !== "object" || entry === null) continue;
    const { statement, basis } = entry as Record<string, unknown>;
    const text = typeof statement === "string" ? statement.trim().slice(0, MAX_STATEMENT_LENGTH) : "";
    if (text.length < 3) continue;
    out.push({ statement: text, basis: typeof basis === "string" ? basis.trim().slice(0, 300) : "" });
  }
  return out;
}

function usableDetails(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    .slice(0, MAX_PRIVATE)
    .map((entry) => entry.trim().slice(0, 200));
}

/** The document as the API wants it: an image block, or a PDF document block. */
function documentBlock(file: Uint8Array, contentType: string) {
  const data = Buffer.from(file).toString("base64");
  if (isAcceptedImageType(contentType)) {
    return {
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: contentType as "image/png" | "image/jpeg" | "image/webp",
        data,
      },
    };
  }
  return {
    type: "document" as const,
    source: { type: "base64" as const, media_type: "application/pdf" as const, data },
  };
}

/**
 * Reads a document against a goal's own terms and proposes publishable wording.
 * Never throws: every failure becomes an empty result with a reason.
 */
export async function proposeStatements(
  file: Uint8Array,
  contentType: string,
  goal: { question: string; criteria: string },
): Promise<ExtractionOutcome> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { proposals: [], privateDetails: [], unavailable: "Automatic reading is not configured. Write the statement yourself." };
  }
  if (!isAcceptedImageType(contentType) && contentType !== "application/pdf") {
    return { proposals: [], privateDetails: [], unavailable: "Automatic reading does not run on this file type." };
  }

  try {
    const response = await client().messages.create({
      model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            documentBlock(file, contentType),
            { type: "text", text: instructions(goal.question, goal.criteria) },
          ],
        },
      ],
      output_config: { format: { type: "json_schema", schema } },
    });

    // The model can decline; that is a normal outcome, not a crash.
    if (response.stop_reason === "refusal") {
      return { proposals: [], privateDetails: [], unavailable: "Automatic reading was declined for this document. Write the statement yourself." };
    }

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");
    if (!text.trim()) return { proposals: [], privateDetails: [] };

    const parsed = JSON.parse(text) as { proposals?: unknown; private_details?: unknown };
    return {
      proposals: usableProposals(parsed.proposals),
      privateDetails: usableDetails(parsed.private_details),
    };
  } catch (error) {
    // Never surface a provider message: it can carry request details.
    if (error instanceof Anthropic.RateLimitError) {
      return { proposals: [], privateDetails: [], unavailable: "Automatic reading is busy. Write the statement yourself, or reload shortly." };
    }
    return { proposals: [], privateDetails: [], unavailable: "Automatic reading could not run. Write the statement yourself." };
  }
}
