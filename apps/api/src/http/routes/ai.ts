import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { searchPages } from "../../services/search.js";

const aiAnswerSchema = z.object({
  question: z.string().min(3)
});

export const aiRouter = Router();

aiRouter.post("/answers", async (req, res) => {
  const input = aiAnswerSchema.parse(req.body);
  const results = await searchPages(input.question, req.user ?? null);

  if (results.length === 0) {
    return res.json({
      answer: "The knowledge base does not contain enough information to answer that confidently.",
      citations: []
    });
  }

  const citations = results.slice(0, 3).map((page) => ({
    title: page.title,
    slug: page.slug
  }));

  const answer =
    env.AI_PROVIDER === "none"
      ? `I found relevant Ledger pages, but no external AI provider is configured. Start with ${citations
          .map((citation) => citation.title)
          .join(", ")}.`
      : `Grounded answer generation is ready for provider ${env.AI_PROVIDER}, but the provider client is not wired in this MVP.`;

  return res.json({ answer, citations });
});

