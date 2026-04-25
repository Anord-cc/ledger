import { describe, expect, it } from "vitest";
import { createSessionToken, hashPassword, verifyPassword, verifySessionToken } from "../services/auth.js";

describe("auth helpers", () => {
  it("hashes and verifies passwords", async () => {
    const hash = await hashPassword("Password123!");
    await expect(verifyPassword("Password123!", hash)).resolves.toBe(true);
    await expect(verifyPassword("WrongPassword!", hash)).resolves.toBe(false);
  });

  it("creates and verifies session tokens", () => {
    const token = createSessionToken({
      id: "user-1",
      email: "user@example.com",
      displayName: "User",
      role: "viewer",
      groupIds: []
    });

    expect(verifySessionToken(token).email).toBe("user@example.com");
  });
});

