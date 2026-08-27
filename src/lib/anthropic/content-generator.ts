import Anthropic from "@anthropic-ai/sdk";
import type { ContentBlock, Tool, ToolUseBlock } from "@anthropic-ai/sdk/resources/messages";
import { getServerEnv, mockAiModel } from "@/lib/env";
import {
  generatedContentJsonSchema,
  generatedContentSchema,
  type CreateJobRequest,
  type GeneratedContent
} from "@/lib/schemas/content";
import type { Json } from "@/types/database";

const toolName = "create_content_generation";
const contentGenerationTool: Tool = {
  name: toolName,
  description: "Structured generated content for a ContentFlow AI job.",
  input_schema: {
    ...generatedContentJsonSchema,
    required: [...generatedContentJsonSchema.required]
  }
};

export type StructuredContentResult = {
  content: GeneratedContent;
  model: string;
  rawResponse: Json;
};

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function isContentGenerationToolUse(block: ContentBlock): block is ToolUseBlock {
  return block.type === "tool_use" && block.name === toolName;
}

function trimToMax(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}.`;
}

function generateMockStructuredContent(input: CreateJobRequest): StructuredContentResult {
  const platformLabel = input.platform === "x" ? "X" : input.platform;
  const content = generatedContentSchema.parse({
    hook: trimToMax(
      `A sharper ${platformLabel} message starts with one promise: ${input.topic}.`,
      260
    ),
    body: [
      `For ${input.audience}, ${input.topic} needs to feel concrete, credible, and immediately useful.`,
      `This ${input.tone} draft frames the idea for ${platformLabel} without pretending the AI did real external research.`,
      "Use it as a review-ready starting point: keep the core promise, tighten the examples for your market, and add any proof points before publishing."
    ].join("\n\n"),
    alternative_hooks: [
      trimToMax(`${input.topic} is easier to trust when the next step is obvious.`, 220),
      trimToMax(`Most ${input.audience} do not need more content. They need a clearer reason to care.`, 220)
    ],
    key_points: [
      trimToMax(`Lead with the practical outcome for ${input.audience}.`, 180),
      trimToMax(`Match the structure and pacing to ${platformLabel}.`, 180),
      "Treat this mock output as a local development substitute for the Anthropic call."
    ],
    cta: trimToMax(`Review this draft, add one proof point, and adapt it for ${platformLabel}.`, 260)
  });

  return {
    content,
    model: mockAiModel,
    rawResponse: toJson({
      provider: "mock",
      model: mockAiModel,
      input,
      content
    })
  };
}

export async function generateStructuredContent(
  input: CreateJobRequest,
  anthropicClient?: Anthropic
): Promise<StructuredContentResult> {
  const env = getServerEnv();

  if (env.contentflowAiProvider === "mock") {
    return generateMockStructuredContent(input);
  }

  if (!env.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is required for Anthropic content generation.");
  }

  const anthropic = anthropicClient ?? new Anthropic({ apiKey: env.anthropicApiKey });

  const response = await anthropic.messages.create({
    model: env.anthropicModel,
    max_tokens: 1400,
    temperature: 0.7,
    system:
      "You are a senior content strategist. Return only the requested structured tool output. Make content specific, useful, and ready for a SaaS marketer to review.",
    messages: [
      {
        role: "user",
        content: [
          `Topic: ${input.topic}`,
          `Audience: ${input.audience}`,
          `Tone: ${input.tone}`,
          `Platform: ${input.platform}`,
          "Generate polished content with a hook, body, alternative hooks, key points, and CTA."
        ].join("\n")
      }
    ],
    tools: [contentGenerationTool],
    tool_choice: {
      type: "tool",
      name: toolName
    }
  });

  const toolUse = response.content.find(isContentGenerationToolUse);

  if (!toolUse) {
    throw new Error("Anthropic response did not include the expected structured tool call.");
  }

  const parsed = generatedContentSchema.safeParse(toolUse.input);

  if (!parsed.success) {
    throw new Error(`Anthropic structured output failed validation: ${parsed.error.message}`);
  }

  return {
    content: parsed.data,
    model: response.model,
    rawResponse: toJson(response)
  };
}
