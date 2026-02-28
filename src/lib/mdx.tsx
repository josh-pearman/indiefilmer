import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { evaluate } from "@mdx-js/mdx";
import * as jsxRuntime from "react/jsx-runtime";
import rehypeSlug from "rehype-slug";
import { mdxComponents } from "@/components/docs/mdx-components";

const CONTENT_DIR = path.join(process.cwd(), "content/docs");

export interface DocMeta {
  slug: string;
  title: string;
  description: string;
  order: number;
}

export interface DocEntry extends DocMeta {
  content: React.ReactElement;
  toc: TocEntry[];
}

export interface TocEntry {
  id: string;
  title: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export function extractToc(raw: string): TocEntry[] {
  const headingRegex = /^##\s+(.+)$/gm;
  const entries: TocEntry[] = [];
  let match;
  while ((match = headingRegex.exec(raw)) !== null) {
    const title = match[1]!.trim();
    entries.push({ id: slugify(title), title });
  }
  return entries;
}

export function getAllDocs(): DocMeta[] {
  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".mdx"));

  const docs = files.map((file) => {
    const slug = file.replace(/\.mdx$/, "");
    const raw = fs.readFileSync(path.join(CONTENT_DIR, file), "utf-8");
    const { data } = matter(raw);
    return {
      slug,
      title: data.title as string,
      description: data.description as string,
      order: (data.order as number) ?? 99,
    };
  });

  return docs.sort((a, b) => a.order - b.order);
}

export async function getDocBySlug(slug: string): Promise<DocEntry | null> {
  const filePath = path.join(CONTENT_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content: rawContent } = matter(raw);

  const { default: MDXContent } = await evaluate(rawContent, {
    ...jsxRuntime,
    rehypePlugins: [rehypeSlug],
  } as Parameters<typeof evaluate>[1]);

  const toc = extractToc(rawContent);

  const content = (
    <MDXContent components={mdxComponents} />
  ) as React.ReactElement;

  return {
    slug,
    title: data.title as string,
    description: data.description as string,
    order: (data.order as number) ?? 99,
    content,
    toc,
  };
}

export function getAllDocSlugs(): string[] {
  return fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => f.replace(/\.mdx$/, ""));
}

export function getAdjacentDocs(slug: string): {
  prev: DocMeta | null;
  next: DocMeta | null;
} {
  const docs = getAllDocs();
  const index = docs.findIndex((d) => d.slug === slug);
  return {
    prev: index > 0 ? docs[index - 1]! : null,
    next: index < docs.length - 1 ? docs[index + 1]! : null,
  };
}
