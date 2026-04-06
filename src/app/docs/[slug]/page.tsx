import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  getDocBySlug,
  getAllDocSlugs,
  getAdjacentDocs,
} from "@/lib/mdx";

export function generateStaticParams() {
  return getAllDocSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = await getDocBySlug(slug);
  if (!doc) return { title: "Not Found — indieFilmer Docs" };
  return {
    title: `${doc.title} — indieFilmer Docs`,
    description: doc.description,
  };
}

function TableOfContents({
  sections,
}: {
  sections: { id: string; title: string }[];
}) {
  return (
    <nav className="hidden xl:block">
      <div className="sticky top-24">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          On this page
        </p>
        <ul className="space-y-2 border-l border-gray-200">
          {sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="block border-l-2 border-transparent py-0.5 pl-4 text-sm text-gray-500 no-underline transition-colors hover:border-gray-400 hover:text-gray-800"
              >
                {section.title}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

export default async function DocSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = await getDocBySlug(slug);
  if (!doc) notFound();

  const { prev, next } = getAdjacentDocs(slug);

  return (
    <div className="flex gap-12">
      {/* Main content */}
      <div className="min-w-0 max-w-3xl flex-1">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          {doc.title}
        </h1>
        <p className="mt-2 text-lg text-gray-500">{doc.description}</p>

        <div className="prose prose-gray mt-8 max-w-none prose-headings:scroll-mt-20 prose-headings:font-semibold prose-headings:tracking-tight prose-h2:mt-10 prose-h2:text-xl prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline">
          {doc.content}
        </div>

        {/* Prev / Next navigation */}
        <div className="mt-16 flex items-center justify-between border-t border-gray-200 pt-6">
          {prev ? (
            <Link
              href={`/docs/${prev.slug}`}
              className="group flex items-center gap-2 text-sm text-gray-500 no-underline hover:text-gray-900"
            >
              <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              <div>
                <p className="text-xs text-gray-400">Previous</p>
                <p className="font-medium text-gray-700 group-hover:text-gray-900">
                  {prev.title}
                </p>
              </div>
            </Link>
          ) : (
            <div />
          )}
          {next ? (
            <Link
              href={`/docs/${next.slug}`}
              className="group flex items-center gap-2 text-right text-sm text-gray-500 no-underline hover:text-gray-900"
            >
              <div>
                <p className="text-xs text-gray-400">Next</p>
                <p className="font-medium text-gray-700 group-hover:text-gray-900">
                  {next.title}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ) : (
            <div />
          )}
        </div>
      </div>

      {/* Table of contents */}
      <TableOfContents sections={doc.toc} />
    </div>
  );
}
