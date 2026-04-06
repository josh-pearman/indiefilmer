"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, ArrowLeft, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface DocNav {
  slug: string;
  title: string;
}

function DocsSidebar({
  docs,
  onNavigate,
}: {
  docs: DocNav[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      <Link
        href="/docs"
        onClick={onNavigate}
        className={cn(
          "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
          pathname === "/docs"
            ? "bg-blue-50 text-blue-700"
            : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
        )}
      >
        Overview
      </Link>
      <div className="pt-2">
        <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Sections
        </p>
        {docs.map((doc) => (
          <Link
            key={doc.slug}
            href={`/docs/${doc.slug}`}
            onClick={onNavigate}
            className={cn(
              "block rounded-md px-3 py-2 text-sm transition-colors",
              pathname === `/docs/${doc.slug}`
                ? "bg-blue-50 font-medium text-blue-700"
                : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
            )}
          >
            {doc.title}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export default function DocsShell({
  docs,
  children,
}: {
  docs: DocNav[];
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="docs-theme min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 lg:hidden"
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link
              href="/docs"
              className="flex items-center gap-2 text-gray-900 no-underline"
            >
              <BookOpen className="h-5 w-5 text-blue-600" />
              <span className="text-base font-semibold tracking-tight">
                indieFilmer Docs
              </span>
            </Link>
          </div>
          <a
            href="/"
            className="flex items-center gap-1.5 text-sm text-gray-500 no-underline hover:text-gray-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to App
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-7xl lg:flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block lg:w-64 lg:shrink-0">
          <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto border-r border-gray-200 px-4 py-6">
            <DocsSidebar docs={docs} />
          </div>
        </aside>

        {/* Mobile sidebar overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="fixed inset-0 bg-black/30"
              onClick={() => setMobileOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                <span className="text-sm font-semibold text-gray-900">
                  Documentation
                </span>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md p-1 text-gray-400 hover:text-gray-600"
                  aria-label="Close sidebar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="overflow-y-auto px-3 py-4">
                <DocsSidebar
                  docs={docs}
                  onNavigate={() => setMobileOpen(false)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-12 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
