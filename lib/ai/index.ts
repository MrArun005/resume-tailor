import { claudeProvider } from "./claude";
import { geminiProvider } from "./gemini";
import type { AIProvider, ProviderName } from "./types";

export function hasClaude(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}
export function hasGemini(): boolean {
  return !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
}

export function availableProviders(): ProviderName[] {
  const list: ProviderName[] = [];
  if (hasClaude()) list.push("claude");
  if (hasGemini()) list.push("gemini");
  return list;
}

/** Resolve a provider, honoring a preference but falling back to whatever is configured. */
export function getProvider(pref?: ProviderName): AIProvider {
  if (pref === "claude" && hasClaude()) return claudeProvider;
  if (pref === "gemini" && hasGemini()) return geminiProvider;
  if (hasClaude()) return claudeProvider;
  if (hasGemini()) return geminiProvider;
  throw new Error(
    "No AI provider is configured. Set ANTHROPIC_API_KEY or GEMINI_API_KEY in .env.local."
  );
}

export type { AIProvider, ProviderName } from "./types";
