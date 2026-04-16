import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export const maxDuration = 60;

function mask(key: string): string {
  if (key.length <= 16) return key.substring(0, 4) + "...";
  return key.substring(0, 12) + "..." + key.substring(key.length - 4);
}

export async function GET() {
  const provider = (process.env.AI_PROVIDER || "anthropic").toLowerCase();
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const config = {
    aiProviderEnv: process.env.AI_PROVIDER ?? null,
    resolvedProvider: provider,
    anthropicKeySet: Boolean(anthropicKey),
    anthropicKeyMasked: anthropicKey ? mask(anthropicKey) : null,
    openaiKeySet: Boolean(openaiKey),
    openaiKeyMasked: openaiKey ? mask(openaiKey) : null,
  };

  if (provider === "openai") {
    if (!openaiKey) {
      return NextResponse.json({
        status: "error",
        config,
        error: "AI_PROVIDER=openai but OPENAI_API_KEY is not set",
      });
    }

    try {
      const openai = new OpenAI({ apiKey: openaiKey, timeout: 30000 });
      const start = Date.now();
      const response = await openai.chat.completions.create({
        model: "gpt-4.1",
        max_completion_tokens: 50,
        messages: [{ role: "user", content: "Say hello in exactly 5 words." }],
      });
      const elapsed = Date.now() - start;

      return NextResponse.json({
        status: "ok",
        config,
        activeProvider: "openai",
        model: "gpt-4.1",
        responseTimeMs: elapsed,
        response: response.choices[0]?.message?.content ?? null,
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens,
      });
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      return NextResponse.json({
        status: "error",
        config,
        activeProvider: "openai",
        errorMessage: err.message || String(error),
        errorStatus: err.status,
      });
    }
  }

  // Default: anthropic
  if (!anthropicKey) {
    return NextResponse.json({
      status: "error",
      config,
      error: "ANTHROPIC_API_KEY is not set in environment variables",
    });
  }

  try {
    const anthropic = new Anthropic({ apiKey: anthropicKey, timeout: 30000 });
    const start = Date.now();

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 50,
      messages: [{ role: "user", content: "Say hello in exactly 5 words." }],
    });

    const elapsed = Date.now() - start;
    const text = response.content.find((b) => b.type === "text");

    return NextResponse.json({
      status: "ok",
      config,
      activeProvider: "anthropic",
      model: "claude-sonnet-4-20250514",
      responseTimeMs: elapsed,
      response: text?.type === "text" ? text.text : null,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string; error?: { type?: string; message?: string } };
    return NextResponse.json({
      status: "error",
      config,
      activeProvider: "anthropic",
      errorMessage: err.message || String(error),
      errorStatus: err.status,
      errorType: err.error?.type,
      errorDetail: err.error?.message,
    });
  }
}
