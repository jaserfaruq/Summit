import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 120000, // 120s for longer Opus calls
});

const MODEL_SONNET = "claude-sonnet-4-20250514";
const MODEL_OPUS = "claude-opus-4-20250514";

export type ClaudeModel = "sonnet" | "opus";

function getModelId(model: ClaudeModel): string {
  return model === "opus" ? MODEL_OPUS : MODEL_SONNET;
}

export async function callClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 8192,
  model: ClaudeModel = "sonnet"
): Promise<string> {
  const response = await anthropic.messages.create({
    model: getModelId(model),
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }
  return textBlock.text;
}

/**
 * Call Claude with prompt caching enabled.
 * The system prompt is cached across calls to avoid reprocessing identical content.
 * Use this for batch operations where the same system prompt is sent repeatedly.
 */
export async function callClaudeWithCache(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 8192,
  model: ClaudeModel = "sonnet"
): Promise<string> {
  const response = await anthropic.messages.create({
    model: getModelId(model),
    max_tokens: maxTokens,
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }
  return textBlock.text;
}

export function parseClaudeJSON<T>(text: string): T {
  // Extract JSON from potential markdown code blocks
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();
  return JSON.parse(jsonStr) as T;
}
