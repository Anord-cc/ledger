function getOrigin(value: string | undefined | null) {
  if (!value) return null;

  try {
    return new URL(value, typeof window !== "undefined" ? window.location.origin : "http://localhost").origin;
  } catch {
    return null;
  }
}

export function resolveDisplayedMcpEndpoint(fallbackEndpoint?: string) {
  const browserOrigin = typeof window !== "undefined" ? window.location.origin : null;
  const fallbackOrigin = getOrigin(fallbackEndpoint);
  const origin = browserOrigin ?? fallbackOrigin;
  return origin ? `${origin}/mcp` : "/mcp";
}
