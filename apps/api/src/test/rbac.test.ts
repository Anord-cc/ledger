import { describe, expect, it } from "vitest";
import { canReadVisibility } from "@ledger/shared";

describe("RBAC visibility", () => {
  const viewer = {
    id: "user-1",
    email: "viewer@example.com",
    displayName: "Viewer",
    role: "viewer" as const,
    groupIds: []
  };

  it("allows public pages for anonymous users", () => {
    expect(canReadVisibility(null, "public")).toBe(true);
  });

  it("blocks internal pages for anonymous users", () => {
    expect(canReadVisibility(null, "internal")).toBe(false);
  });

  it("allows restricted pages only when group and role match", () => {
    expect(canReadVisibility(viewer, "restricted", ["viewer"], ["group-1"])).toBe(false);
    expect(
      canReadVisibility({ ...viewer, groupIds: ["group-1"] }, "restricted", ["viewer"], ["group-1"])
    ).toBe(true);
  });
});

