import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();
const enqueueWebhookEvent = vi.fn();
const verifyPassword = vi.fn();
const getUserForSession = vi.fn();
const createSessionToken = vi.fn(() => "token");

vi.mock("../db/pool.js", () => ({
  pool: {
    query: queryMock
  }
}));

vi.mock("../services/webhooks.js", () => ({
  enqueueWebhookEvent
}));

vi.mock("../services/auth.js", () => ({
  verifyPassword,
  getUserForSession,
  createSessionToken,
  verifySessionToken: vi.fn(),
  hashPassword: vi.fn()
}));

describe("http flows", () => {
  beforeEach(() => {
    queryMock.mockReset();
    enqueueWebhookEvent.mockReset();
    verifyPassword.mockReset();
    getUserForSession.mockReset();
    createSessionToken.mockClear();
  });

  it("logs in with valid credentials", async () => {
    queryMock
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: "user-1", password_hash: "hash" }]
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    verifyPassword.mockResolvedValueOnce(true);
    getUserForSession.mockResolvedValueOnce({
      id: "user-1",
      email: "owner@ledger.local",
      displayName: "Owner",
      role: "owner",
      groupIds: []
    });

    const { createApp } = await import("../app.js");
    const response = await request(createApp()).post("/api/auth/login").send({
      email: "owner@ledger.local",
      password: "Password123!"
    });

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe("owner@ledger.local");
    expect(response.headers["set-cookie"]).toBeTruthy();
  });

  it("blocks register before initial setup is completed", async () => {
    queryMock.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ count: 0 }]
    });

    const { createApp } = await import("../app.js");
    const response = await request(createApp()).post("/api/auth/register").send({
      email: "first@example.com",
      password: "Password123!",
      displayName: "First User"
    });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain("initial Ledger setup");
  });

  it("creates feedback records", async () => {
    queryMock
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "feedback-1" }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const { createApp } = await import("../app.js");
    const response = await request(createApp()).post("/api/feedback").send({
      pageId: "27ef6842-a7e5-41ab-a18a-f2d0ca9d1d85",
      revisionId: "8f8381fd-e2d3-4093-a2c6-59c59f119abc",
      helpful: true,
      comment: "Solved it"
    });

    expect(response.status).toBe(201);
    expect(response.body.feedbackId).toBe("feedback-1");
    expect(enqueueWebhookEvent).toHaveBeenCalledWith(
      "feedback.created",
      expect.objectContaining({ feedbackId: "feedback-1" })
    );
  });
});
