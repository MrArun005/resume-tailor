export type ProviderName = "claude" | "gemini";
export type Tier = "fast" | "best";

export interface GenerateOpts {
  prompt: string;
  tier: Tier;
  /** Optional PDF (base64, no data: prefix) provided as document input. */
  pdfBase64?: string;
}

export interface AIProvider {
  readonly name: ProviderName;
  /** Human-readable model id used for the given tier. */
  modelFor(tier: Tier): string;
  /** Run a generation and return the raw text response. */
  generate(opts: GenerateOpts): Promise<string>;
}
