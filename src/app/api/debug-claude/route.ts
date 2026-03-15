import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      status: "error",
      error: "ANTHROPIC_API_KEY is not set in environment variables",
    });
  }

  const masked = apiKey.substring(0, 12) + "..." + apiKey.substring(apiKey.length - 4);

  try {
    const anthropic = new Anthropic({ apiKey, timeout: 30000 });
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
      apiKeyMasked: masked,
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
      apiKeyMasked: masked,
      errorMessage: err.message || String(error),
      errorStatus: err.status,
      errorType: err.error?.type,
      errorDetail: err.error?.message,
    });
  }
}
