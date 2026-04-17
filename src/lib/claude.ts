import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

// Provider config — "anthropic" (default) or "openai"
const AI_PROVIDER = process.env.AI_PROVIDER || "anthropic";

// Conditional client initialization — only the active provider is created
const anthropic =
  AI_PROVIDER !== "openai" && process.env.ANTHROPIC_API_KEY
    ? new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
        timeout: 120000,
      })
    : null;

const openai =
  AI_PROVIDER === "openai" && process.env.OPENAI_API_KEY
    ? new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        timeout: 120000,
      })
    : null;

// Anthropic model IDs
const MODEL_HAIKU = "claude-haiku-4-5-20251001";
const MODEL_SONNET = "claude-sonnet-4-20250514";
const MODEL_OPUS = "claude-opus-4-20250514";
const MODEL_OPUS_4_7 = "claude-opus-4-7";

export type ClaudeModel = "haiku" | "sonnet" | "opus" | "opus4_7";

function getModelId(model: ClaudeModel): string {
  if (model === "opus4_7") return MODEL_OPUS_4_7;
  if (model === "opus") return MODEL_OPUS;
  if (model === "haiku") return MODEL_HAIKU;
  return MODEL_SONNET;
}

// OpenAI model mapping
function getOpenAIModelId(model: ClaudeModel): string {
  if (model === "opus4_7" || model === "opus") return "gpt-5.4";
  if (model === "haiku") return "gpt-5.4-mini";
  return "gpt-5.4-mini"; // sonnet → gpt-5.4-mini
}

// --- OpenAI implementations ---

// Check if a model is a reasoning model (uses thinking tokens)
function isReasoningModel(model: ClaudeModel): boolean {
  const modelId = getOpenAIModelId(model);
  return modelId.startsWith("gpt-5") || modelId.startsWith("o");
}

async function callOpenAI(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
  model: ClaudeModel
): Promise<string> {
  if (!openai) throw new Error("OpenAI API key not configured");
  const reasoning = isReasoningModel(model);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: any = {
    model: getOpenAIModelId(model),
    max_completion_tokens: maxTokens,
    messages: [
      { role: reasoning ? "developer" : "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  };
  const response = await openai.chat.completions.create(params);
  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("No text response from OpenAI");
  return text;
}

function streamOpenAI(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
  model: ClaudeModel
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      if (!openai) throw new Error("OpenAI API key not configured");
      const reasoning = isReasoningModel(model);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params: any = {
        model: getOpenAIModelId(model),
        max_completion_tokens: maxTokens,
        stream: true,
        messages: [
          { role: reasoning ? "developer" : "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      };
      const stream = await openai.chat.completions.create(params) as unknown as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content;
        if (text) controller.enqueue(encoder.encode(text));
      }
      controller.close();
    },
  });
}

// --- Exported functions ---

export async function callClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 8192,
  model: ClaudeModel = "opus"
): Promise<string> {
  if (AI_PROVIDER === "openai") {
    return callOpenAI(systemPrompt, userMessage, maxTokens, model);
  }

  if (!anthropic) throw new Error("Anthropic API key not configured");
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
 * Note: When using OpenAI, this behaves identically to callClaude (no caching equivalent).
 */
export async function callClaudeWithCache(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 8192,
  model: ClaudeModel = "opus"
): Promise<string> {
  if (AI_PROVIDER === "openai") {
    return callOpenAI(systemPrompt, userMessage, maxTokens, model);
  }

  if (!anthropic) throw new Error("Anthropic API key not configured");
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
 * Note: When using OpenAI, streams via OpenAI's streaming API (no caching equivalent).
 */
export function streamClaudeWithCache(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 8192,
  model: ClaudeModel = "opus"
): ReadableStream<Uint8Array> {
  if (AI_PROVIDER === "openai") {
    return streamOpenAI(systemPrompt, userMessage, maxTokens, model);
  }

  if (!anthropic) throw new Error("Anthropic API key not configured");
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
    // Attempt to repair common JSON issues:
    // 1. Trailing commas before ] or }
    jsonStr = jsonStr.replace(/,\s*([}\]])/g, "$1");
    // 2. Truncated output — try to close open brackets/braces
    const openBraces = (jsonStr.match(/{/g) || []).length;
    const closeBraces = (jsonStr.match(/}/g) || []).length;
    const openBrackets = (jsonStr.match(/\[/g) || []).length;
    const closeBrackets = (jsonStr.match(/]/g) || []).length;
    // Trim any trailing partial value (e.g., incomplete string or number)
    jsonStr = jsonStr.replace(/,\s*"[^"]*$/, ""); // trailing incomplete key
    jsonStr = jsonStr.replace(/,\s*$/, ""); // trailing comma
    for (let i = 0; i < openBrackets - closeBrackets; i++) jsonStr += "]";
    for (let i = 0; i < openBraces - closeBraces; i++) jsonStr += "}";
    // Clean trailing commas again after repairs
    jsonStr = jsonStr.replace(/,\s*([}\]])/g, "$1");
    return JSON.parse(jsonStr) as T;
  }
}
