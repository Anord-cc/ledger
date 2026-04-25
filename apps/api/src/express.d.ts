import type { SessionUser } from "@ledger/shared";

declare global {
  namespace Express {
    interface Request {
      user: SessionUser | null;
    }
  }
}

export {};
