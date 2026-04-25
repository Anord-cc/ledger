import type { Request } from "express";
import type { SessionUser } from "@ledger/shared";

export type AppRequest = Request & {
  user: SessionUser | null;
};

