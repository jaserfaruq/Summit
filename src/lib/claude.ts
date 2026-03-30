import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 120000, // 120s for longer Opus calls
});

const MODEL_HAIKU = "claude-haiku-4-5-20251001";
const MODEL_SONNET = "claude-sonnet-4-20250514";
const MODEL_OPUS = "claude-opus-4-20250514";

export type ClaudeModel = "haiku" | "sonnet" | "opus";

function getModelId(model: ClaudeModel): string {
  if (model === "opus") return MODEL_OPUS;
  if (model === "haiku") return MODEL_HAIKU;
  return MODEL_SONNET;
}

export async function callClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 8192,
  model: ClaudeModel = "opus"
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
  model: ClaudeModel = "opus"
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

/**
 * Stream Claude response with prompt caching.
 * Returns a ReadableStream of text chunks for real-time UI updates.
 * The final accumulated text can be parsed as JSON after the stream completes.
 */
export function streamClaudeWithCache(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 8192,
  model: ClaudeModel = "opus"
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        const stream = anthropic.messages.stream({
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

        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

export function parseClaudeJSON<T>(text: string): T {
  // Extract JSON from potential markdown code blocks
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  let jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();

  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    // Attempt to repair common Claude JSON issues:
    // 1. Trailing commas before ] or }
    jsonStr = jsonStr.replace(/,\s*([}\]])/g, "$1");
    // 2. Truncated output — try to close open brackets/braces
    const openBraces = (jsonStr.match(/{/g) || []).length;
    const closeBraces = (jsonStr.match(/}/g) || []).length;
    const openBrackets = (jsonStr.match(/\[/g) || []).length;
    const closeBrackets = (jsonStr.match(/]/g) || []).length;
    // Trim any trailing partial value (e.g., incomplete string or number)
    jsonStr = jsonStr.replace(/,\s*"[^"]*$/, "");  // trailing incomplete key
    jsonStr = jsonStr.replace(/,\s*$/, "");          // trailing comma
    for (let i = 0; i < openBrackets - closeBrackets; i++) jsonStr += "]";
    for (let i = 0; i < openBraces - closeBraces; i++) jsonStr += "}";
    // Clean trailing commas again after repairs
    jsonStr = jsonStr.replace(/,\s*([}\]])/g, "$1");
    return JSON.parse(jsonStr) as T;
  }
}
