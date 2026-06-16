import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, GenerateOpts, Tier } from "./types";

const MODELS: Record<Tier, string> = {
  best: "claude-opus-4-8",
  fast: "claude-haiku-4-5",
};

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

export const claudeProvider: AIProvider = {
  name: "claude",
  modelFor: (tier) => MODELS[tier],
  async generate({ prompt, tier, pdfBase64 }: GenerateOpts): Promise<string> {
    const content: Anthropic.ContentBlockParam[] = [];
    if (pdfBase64) {
      content.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
      });
    }
    content.push({ type: "text", text: prompt });

    const res = await getClient().messages.create({
      model: MODELS[tier],
      max_tokens: 16000,
      messages: [{ role: "user", content }],
    });

    return res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
  },
};
