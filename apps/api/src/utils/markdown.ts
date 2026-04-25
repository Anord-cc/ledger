import matter from "gray-matter";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

export interface RenderedMarkdown {
  frontmatter: Record<string, unknown>;
  bodyMarkdown: string;
  bodyHtml: string;
  toc: Array<{ id: string; text: string; level: number }>;
}

function headingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function renderMarkdown(source: string): RenderedMarkdown {
  const parsed = matter(source);
  const headings: Array<{ id: string; text: string; level: number }> = [];

  const lexer = marked.lexer(parsed.content);
  for (const token of lexer) {
    if (token.type === "heading") {
      headings.push({
        id: headingId(token.text),
        text: token.text,
        level: token.depth
      });
    }
  }

  const renderer = new marked.Renderer();
  renderer.heading = ({ tokens, depth }) => {
    const text = tokens.map((token) => ("text" in token ? token.text : "")).join("");
    const id = headingId(text);
    return `<h${depth} id="${id}">${text}</h${depth}>`;
  };

  const rawHtml = marked.parse(parsed.content, { renderer }) as string;
  const safeHtml = sanitizeHtml(rawHtml, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "h1",
      "h2",
      "h3",
      "h4",
      "img",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td"
    ]),
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title"],
      "*": ["id"]
    },
    allowedSchemes: ["http", "https", "mailto"]
  });

  return {
    frontmatter: parsed.data,
    bodyMarkdown: parsed.content,
    bodyHtml: safeHtml,
    toc: headings
  };
}

