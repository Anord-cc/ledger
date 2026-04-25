import { env } from "../config/env.js";
import { pool } from "../db/pool.js";
import { searchPages } from "./search.js";
import { getPageBySlug } from "./pages.js";
import type { SessionUser } from "@ledger/shared";

type ProviderConfig = {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string | null;
};

export async function getAiSettingsRecord() {
  const settings = await pool.query(`SELECT * FROM ai_settings ORDER BY created_at ASC LIMIT 1`);
  return settings.rows[0] ?? null;
}

export async function upsertAiSettings(input: {
  provider: string;
  model: string;
  apiKey: string | null;
  isEnabled: boolean;
}) {
  const existing = await getAiSettingsRecord();
  if (existing) {
    const nextApiKey = input.apiKey === null ? existing.encrypted_api_key : input.apiKey;
    const updated = await pool.query(
      `
        UPDATE ai_settings
        SET provider = $2, model = $3, encrypted_api_key = $4, is_enabled = $5, updated_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [existing.id, input.provider, input.model, nextApiKey, input.isEnabled]
    );
    return updated.rows[0];
  }

  const created = await pool.query(
    `
      INSERT INTO ai_settings (provider, model, encrypted_api_key, is_enabled)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [input.provider, input.model, input.apiKey, input.isEnabled]
  );
  return created.rows[0];
}

async function resolveProviderConfig(): Promise<ProviderConfig | null> {
  const persisted = await getAiSettingsRecord();
  const provider = String(persisted?.provider ?? env.AI_PROVIDER ?? "none");
  const model = String(persisted?.model ?? env.AI_MODEL ?? "");
  const apiKey = String(persisted?.encrypted_api_key ?? env.AI_API_KEY ?? "");
  const isEnabled = Boolean(persisted?.is_enabled ?? provider !== "none");
  const baseUrl = provider === "openai_compatible" ? "https://api.openai.com/v1" : null;

  if (!isEnabled || provider === "none" || !model || !apiKey) {
    return null;
  }

  return {
    provider,
    model,
    apiKey,
    baseUrl
  };
}

async function generateWithProvider(provider: ProviderConfig, prompt: string) {
  if (provider.provider === "openai_compatible") {
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: provider.model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "Answer using only the provided knowledge base excerpts. If the context is insufficient, say exactly: The knowledge base does not contain enough information to answer that."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`AI provider request failed with status ${response.status}`);
    }

    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    return body.choices?.[0]?.message?.content?.trim() ?? "";
  }

  if (provider.provider === "anthropic_compatible") {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": provider.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        system:
          "Answer using only the provided knowledge base excerpts. If the context is insufficient, say exactly: The knowledge base does not contain enough information to answer that."
      })
    });

    if (!response.ok) {
      throw new Error(`AI provider request failed with status ${response.status}`);
    }

    const body = (await response.json()) as {
      content?: Array<{ text?: string }>;
    };

    return body.content?.map((part) => part.text ?? "").join("").trim() ?? "";
  }

  return "";
}

export async function answerQuestion(question: string, user: SessionUser | null) {
  const pages = await searchPages(question, user);
  if (pages.length === 0) {
    return {
      answer: "The knowledge base does not contain enough information to answer that.",
      citations: [],
      disabled: false
    };
  }

  const provider = await resolveProviderConfig();
  if (!provider) {
    return {
      answer: "",
      citations: [],
      disabled: true
    };
  }

  const citations = [];
  const contextBlocks: string[] = [];
  for (const page of pages.slice(0, 4)) {
    const detail = await getPageBySlug(page.slug, user);
    if (!detail) {
      continue;
    }

    citations.push({
      title: detail.title,
      slug: detail.slug
    });
    contextBlocks.push(`Title: ${detail.title}\nSlug: ${detail.slug}\nContent:\n${detail.bodyMarkdown.slice(0, 3000)}`);
  }

  if (contextBlocks.length === 0) {
    return {
      answer: "The knowledge base does not contain enough information to answer that.",
      citations: [],
      disabled: false
    };
  }

  const prompt = `Question:\n${question}\n\nKnowledge base excerpts:\n\n${contextBlocks.join("\n\n---\n\n")}\n\nRespond with a concise answer grounded in the excerpts only.`;
  const answer = await generateWithProvider(provider, prompt);
  const normalizedAnswer =
    answer || "The knowledge base does not contain enough information to answer that.";

  await pool.query(
    `
      INSERT INTO ai_answer_logs (user_id, question, answer, citations)
      VALUES ($1, $2, $3, $4)
    `,
    [user?.id ?? null, question, normalizedAnswer, JSON.stringify(citations)]
  );

  return {
    answer: normalizedAnswer,
    citations,
    disabled: false
  };
}
