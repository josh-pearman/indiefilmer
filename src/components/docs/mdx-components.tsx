import type { MDXComponents } from "mdx/types";
import { cn } from "@/lib/utils";

function Callout({
  type = "info",
  children,
}: {
  type?: "info" | "warning" | "tip";
  children: React.ReactNode;
}) {
  const styles = {
    info: "border-blue-200 bg-blue-50 text-blue-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    tip: "border-green-200 bg-green-50 text-green-900",
  };

  const labels = { info: "Info", warning: "Warning", tip: "Tip" };

  return (
    <div className={cn("my-6 rounded-lg border p-4", styles[type])}>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider opacity-70">
        {labels[type]}
      </p>
      <div className="text-sm [&>p]:m-0">{children}</div>
    </div>
  );
}

function DocsImage({
  src,
  alt,
  caption,
}: {
  src: string;
  alt: string;
  caption?: string;
}) {
  return (
    <figure className="my-6">
      <img
        src={src}
        alt={alt}
        className="rounded-lg border border-gray-200"
      />
      {caption && (
        <figcaption className="mt-2 text-center text-sm text-gray-500">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

export const mdxComponents: MDXComponents = {
  Callout,
  DocsImage,
  img: (props) => (
    <img
      {...props}
      className={cn("rounded-lg border border-gray-200", props.className)}
    />
  ),
};
