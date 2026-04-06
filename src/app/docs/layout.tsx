import { getAllDocs } from "@/lib/mdx";
import DocsShell from "@/components/docs/docs-shell";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const docs = getAllDocs().map(({ slug, title }) => ({ slug, title }));

  return <DocsShell docs={docs}>{children}</DocsShell>;
}
