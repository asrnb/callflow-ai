import Anthropic from "@anthropic-ai/sdk";
import type { ContentBlock, Tool, ToolUseBlock } from "@anthropic-ai/sdk/resources/messages";
import { getServerEnv } from "@/lib/env";
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

export async function generateStructuredContent(
  input: CreateJobRequest,
  anthropicClient?: Anthropic
): Promise<StructuredContentResult> {
  const env = getServerEnv();
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
