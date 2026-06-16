import { writeFileSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";
import type { AIProvider, GenerateOpts, Tier } from "./types";

const MODELS: Record<Tier, string> = {
  best: "gemini-2.5-pro",
  fast: "gemini-2.5-flash",
};

// Dump the raw Gemini reply to the dev terminal AND to gemini-last-response.txt
// in the project root, so it's visible no matter which terminal you're watching.
function dumpResponse(model: string, text: string) {
  console.log(`\n===== GEMINI RAW RESPONSE (${model}, ${text.length} chars) =====\n${text}\n===== END GEMINI RESPONSE =====\n`);
  try {
    writeFileSync("gemini-last-response.txt", `model: ${model}\nlength: ${text.length}\n\n${text}\n`);
  } catch {
    // best-effort; ignore file write errors
  }
}

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export const geminiProvider: AIProvider = {
  name: "gemini",
  modelFor: (tier) => MODELS[tier],
  async generate({ prompt, tier, pdfBase64 }: GenerateOpts): Promise<string> {
    const parts: Array<Record<string, unknown>> = [];
    if (pdfBase64) {
      parts.push({ inlineData: { mimeType: "application/pdf", data: pdfBase64 } });
    }
    parts.push({ text: prompt });

    const maxAttempts = 5;
    for (let attempt = 1; ; attempt++) {
      try {
        const res = await getClient().models.generateContent({
          model: MODELS[tier],
          contents: [{ role: "user", parts }],
          config: { responseMimeType: "application/json", maxOutputTokens: 32000 },
        });
        const text = res.text ?? "";
        dumpResponse(MODELS[tier], text);
        return text;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const transient = /\b(503|429|500|UNAVAILABLE|overloaded|high demand)\b/i.test(msg);
        if (!transient || attempt >= maxAttempts) throw err;
        await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
      }
    }
  },
};
