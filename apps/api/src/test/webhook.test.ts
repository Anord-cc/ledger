import { describe, expect, it } from "vitest";
import { signWebhook } from "../utils/webhook.js";

describe("webhook signing", () => {
  it("generates deterministic hmac signatures", () => {
    expect(signWebhook("secret", '{"event":"page.created"}')).toBe(
      "3bfc8e9ff415966f1405d2ea4c17d5de495bf2c0d7feb228a5e6584cfed3316f"
    );
  });
});

