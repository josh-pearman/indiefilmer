"use client";

const IMAGE_SIZE_OPTIONS = ["small", "medium", "large"];
const MARKDOWN_IMAGE_REGEX = /!\[([^\]]*)]\((\S+?)(?:\s+"([^"]+)")?\)/g;

/** Convert simple HTML from TipTap into markdown */
export function htmlToMarkdown(html: string): string {
  let md = html;

  md = md.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = tag.match(/\ssrc="([^"]*)"/i)?.[1];
    if (!src) return "";

    const alt = tag.match(/\salt="([^"]*)"/i)?.[1] || "image";
    const size = tag.match(/\sdata-size="([^"]*)"/i)?.[1];
    const title =
      size && IMAGE_SIZE_OPTIONS.includes(size) ? ` "${size}"` : "";

    return `![${alt}](${src}${title})`;
  });

  md = md.replace(/<strong>(.*?)<\/strong>/gi, "**$1**");
  md = md.replace(/<em>(.*?)<\/em>/gi, "*$1*");
  md = md.replace(/<br\s*\/?>/gi, "\n");
  md = md.replace(/<p>(.*?)<\/p>/gi, "$1\n\n");
  md = md.replace(/<[^>]+>/g, "");
  md = md.replace(/&amp;/g, "&");
  md = md.replace(/&lt;/g, "<");
  md = md.replace(/&gt;/g, ">");
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#39;/g, "'");

  return md.trim();
}

/** Convert simple markdown back into HTML for the TipTap editor */
export function markdownToHtml(markdown: string): string {
  if (!markdown.trim()) return "";

  const paragraphs = markdown
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return paragraphs
    .map((block) => {
      const lines = block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      const imageLines = lines
        .map((line) => parseMarkdownImage(line))
        .filter((value): value is NonNullable<typeof value> => Boolean(value));

      if (lines.length > 0 && imageLines.length === lines.length) {
        return imageLines.map(renderMarkdownImage).join("");
      }

      const renderedLines = block
        .split("\n")
        .map((line) => renderInlineMarkdown(line))
        .join("<br>");

      return `<p>${renderedLines}</p>`;
    })
    .join("");
}

function renderInlineMarkdown(text: string): string {
  let html = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  MARKDOWN_IMAGE_REGEX.lastIndex = 0;

  while ((match = MARKDOWN_IMAGE_REGEX.exec(text)) !== null) {
    html += escapeHtml(text.slice(lastIndex, match.index));
    html += renderMarkdownImage({
      alt: match[1] || "image",
      src: match[2],
      size: match[3],
    });
    lastIndex = match.index + match[0].length;
  }

  html += escapeHtml(text.slice(lastIndex));

  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

  return html;
}

function parseMarkdownImage(
  text: string
): { alt: string; src: string; size?: string } | null {
  const match = text.match(/^!\[([^\]]*)]\((\S+?)(?:\s+"([^"]+)")?\)$/);
  if (!match) return null;

  return {
    alt: match[1] || "image",
    src: match[2],
    size: match[3],
  };
}

function renderMarkdownImage(image: {
  alt: string;
  src: string;
  size?: string;
}): string {
  const sizeAttr =
    image.size && IMAGE_SIZE_OPTIONS.includes(image.size)
      ? ` data-size="${escapeHtml(image.size)}"`
      : "";

  return `<img src="${escapeHtml(image.src)}" alt="${escapeHtml(
    image.alt || "image"
  )}"${sizeAttr}>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
