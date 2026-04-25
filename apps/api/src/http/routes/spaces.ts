import { Router } from "express";
import { listSpaces } from "../../services/pages.js";

export const spacesRouter = Router();

spacesRouter.get("/", async (req, res) => {
  const spaces = await listSpaces(req.user ?? null);
  return res.json({ spaces });
});

