import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../utils/markdown.js";

describe("markdown rendering", () => {
  it("sanitizes unsafe html", () => {
    const rendered = renderMarkdown("# Hello\n\n<script>alert('xss')</script><b>safe</b>");
    expect(rendered.bodyHtml).not.toContain("<script>");
    expect(rendered.bodyHtml).toContain("<b>safe</b>");
  });

  it("builds a table of contents from headings", () => {
    const rendered = renderMarkdown("# One\n\n## Two");
    expect(rendered.toc).toEqual([
      { id: "one", text: "One", level: 1 },
      { id: "two", text: "Two", level: 2 }
    ]);
  });
});

