import type { NextFunction, Response } from "express";
import { canEditPage, canManageSettings, hasRole } from "@ledger/shared";
import { env } from "../../config/env.js";
import { getUserForSession, verifySessionToken } from "../../services/auth.js";
import type { AppRequest } from "../types.js";

export async function sessionMiddleware(req: AppRequest, _res: Response, next: NextFunction) {
  const token = req.cookies?.[env.SESSION_COOKIE_NAME];
  req.user = null;

  if (!token) {
    return next();
  }

  try {
    const payload = verifySessionToken(token);
    req.user = await getUserForSession(payload.id);
  } catch {
    req.user = null;
  }

  next();
}

export function requireAuthenticated(req: AppRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  next();
}

export function requireEditor(req: AppRequest, res: Response, next: NextFunction) {
  if (!canEditPage(req.user)) {
    return res.status(403).json({ error: "Editor access required" });
  }

  next();
}

export function requireAdmin(req: AppRequest, res: Response, next: NextFunction) {
  if (!canManageSettings(req.user)) {
    return res.status(403).json({ error: "Admin access required" });
  }

  next();
}

export function requireViewer(req: AppRequest, res: Response, next: NextFunction) {
  if (!hasRole(req.user, "viewer")) {
    return res.status(403).json({ error: "Viewer access required" });
  }

  next();
}

