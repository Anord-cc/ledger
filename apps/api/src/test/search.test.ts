import { describe, expect, it } from "vitest";
import { matchesSearchQuery } from "../services/search.js";

describe("search matching", () => {
  it("matches content in page title", () => {
    expect(matchesSearchQuery("ledger", "Ledger setup", "body")).toBe(true);
  });

  it("matches content in markdown body", () => {
    expect(matchesSearchQuery("incident", "Runbook", "Major incident workflow")).toBe(true);
  });

  it("does not match blank queries", () => {
    expect(matchesSearchQuery("   ", "Runbook", "body")).toBe(false);
  });
});

