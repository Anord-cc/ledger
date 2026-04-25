import { Router } from "express";
import { searchPages, recordSearch } from "../../services/search.js";
import { enqueueWebhookEvent } from "../../services/webhooks.js";

export const searchRouter = Router();

searchRouter.get("/", async (req, res) => {
  const query = String(req.query.q ?? "");
  const pages = await searchPages(query, req.user ?? null);
  const searchId = await recordSearch(query, req.user?.id ?? null, pages);

  if (pages.length === 0 && query.trim()) {
    await enqueueWebhookEvent("search.no_results", { searchId, query }, {
      actor: req.user
        ? {
            id: req.user.id,
            name: req.user.displayName,
            email: req.user.email
          }
        : null
    });
  }

  return res.json({
    query,
    total: pages.length,
    searchId,
    pages
  });
});
