import Link from "next/link";
import { getAllDocs } from "@/lib/mdx";
import { ChevronRight } from "lucide-react";

export default function DocsPage() {
  const docs = getAllDocs();

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">
        indieFilmer Documentation
      </h1>
      <p className="mt-3 text-lg text-gray-600">
        Everything you need to know about using indieFilmer to plan your
        microbudget film production. Select a section below to get started.
      </p>

      <div className="mt-10 space-y-2">
        {docs.map((doc) => (
          <Link
            key={doc.slug}
            href={`/docs/${doc.slug}`}
            className="group flex items-center justify-between rounded-lg border border-gray-200 px-5 py-4 no-underline transition-colors hover:border-gray-300 hover:bg-gray-50"
          >
            <div>
              <h2 className="text-base font-semibold text-gray-900 group-hover:text-blue-600">
                {doc.title}
              </h2>
              <p className="mt-0.5 text-sm text-gray-500">
                {doc.description}
              </p>
            </div>
            <ChevronRight className="ml-4 h-4 w-4 shrink-0 text-gray-400 group-hover:text-blue-500" />
          </Link>
        ))}
      </div>
    </div>
  );
}
