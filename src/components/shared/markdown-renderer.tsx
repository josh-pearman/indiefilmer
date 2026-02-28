"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownRendererProps = {
  content: string;
  className?: string;
};

function getImageSizeClass(size?: string | null) {
  switch ((size || "").toLowerCase()) {
    case "small":
      return "w-full max-w-40";
    case "large":
      return "w-full max-w-3xl";
    case "medium":
      return "w-full max-w-xl";
    default:
      return "max-w-full";
  }
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-2 text-xl font-bold">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 text-lg font-semibold">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1 text-base font-semibold">{children}</h3>
          ),
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:text-primary/80"
            >
              {children}
            </a>
          ),
          img: ({ src, alt, title }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt ?? ""}
              className={`my-2 rounded-md ${getImageSizeClass(title)}`}
            />
          ),
          ul: ({ children }) => (
            <ul className="mb-2 ml-4 list-disc">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-2 ml-4 list-decimal">{children}</ol>
          ),
          li: ({ children }) => <li className="mb-0.5">{children}</li>,
          code: ({ children, className: codeClassName }) => {
            const isBlock = codeClassName?.includes("language-");
            if (isBlock) {
              return (
                <code className="block overflow-x-auto rounded-md bg-muted p-3 text-xs">
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="mb-2">{children}</pre>,
          blockquote: ({ children }) => (
            <blockquote className="mb-2 border-l-2 border-muted-foreground/30 pl-3 italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          table: ({ children }) => (
            <div className="mb-2 overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border px-2 py-1 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-2 py-1">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
