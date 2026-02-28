"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download, FileText, X } from "lucide-react";

export type FileItem = {
  id: string;
  fileName: string;
  filePath: string;
};

type FilesSectionProps = {
  items: FileItem[];
  onAttach: (formData: FormData) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  fileServeBasePath: string;
  title?: string;
  attachButtonLabel?: string;
};

const IMAGE_EXT = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

function isImageFile(fileName: string): boolean {
  const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  return IMAGE_EXT.includes(ext);
}

export function FilesSection({
  items,
  onAttach,
  onRemove,
  fileServeBasePath,
  title = "Files",
  attachButtonLabel = "Attach File"
}: FilesSectionProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [pending, setPending] = React.useState(false);
  const [viewerIndex, setViewerIndex] = React.useState<number | null>(null);

  const imageItems = React.useMemo(
    () =>
      items
        .filter((item) => isImageFile(item.fileName))
        .map((item) => ({
          ...item,
          url: `${fileServeBasePath}/${encodeURIComponent(item.filePath)}`,
        })),
    [fileServeBasePath, items]
  );

  const activeImage = viewerIndex === null ? null : imageItems[viewerIndex] ?? null;

  const closeViewer = React.useCallback(() => {
    setViewerIndex(null);
  }, []);

  const showPreviousImage = React.useCallback(() => {
    setViewerIndex((current) => {
      if (current === null || imageItems.length <= 1) return current;
      return current === 0 ? imageItems.length - 1 : current - 1;
    });
  }, [imageItems.length]);

  const showNextImage = React.useCallback(() => {
    setViewerIndex((current) => {
      if (current === null || imageItems.length <= 1) return current;
      return current === imageItems.length - 1 ? 0 : current + 1;
    });
  }, [imageItems.length]);

  React.useEffect(() => {
    if (viewerIndex === null) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeViewer();
      } else if (event.key === "ArrowLeft") {
        showPreviousImage();
      } else if (event.key === "ArrowRight") {
        showNextImage();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeViewer, showNextImage, showPreviousImage, viewerIndex]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setPending(true);

    for (const file of files) {
      const formData = new FormData();
      formData.set("file", file);
      await onAttach(formData);
    }

    setPending(false);
    e.target.value = "";
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{title}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          {attachButtonLabel}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.zip,.txt,.md"
          onChange={handleFileChange}
        />
      </div>
      {items.length > 0 ? (
        <ul className="space-y-1.5">
          {items.map((item) => {
            const url = `${fileServeBasePath}/${encodeURIComponent(item.filePath)}`;
            const image = isImageFile(item.fileName);
            const imageIndex = imageItems.findIndex((imageItem) => imageItem.id === item.id);
            return (
              <li
                key={item.id}
                className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 p-2 text-sm"
              >
                {image ? (
                  <button
                    type="button"
                    onClick={() => setViewerIndex(imageIndex)}
                    className="h-16 w-16 shrink-0 overflow-hidden rounded border border-border bg-muted"
                    aria-label={`View ${item.fileName}`}
                  >
                    <img
                      src={url}
                      alt={item.fileName}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-border bg-muted">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.fileName}</p>
                  <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                    <a href={url} download target="_blank" rel="noopener noreferrer">
                      <Download className="mr-1 h-3 w-3" />
                      Download
                    </a>
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => onRemove(item.id)}
                  aria-label={`Remove ${item.fileName}`}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {activeImage ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={closeViewer}
          role="dialog"
          aria-modal="true"
          aria-label="Image viewer"
        >
          <div
            className="relative flex max-h-full w-full max-w-5xl flex-col items-center gap-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="absolute right-0 top-0 z-10 flex items-center gap-2">
              <Button asChild variant="secondary" size="sm" className="h-8">
                <a
                  href={activeImage.url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="mr-1 h-3.5 w-3.5" />
                  Download
                </a>
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="h-8 w-8"
                onClick={closeViewer}
                aria-label="Close image viewer"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex w-full items-center justify-center gap-3 pt-10">
              {imageItems.length > 1 ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  onClick={showPreviousImage}
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              ) : null}
              <img
                src={activeImage.url}
                alt={activeImage.fileName}
                className="max-h-[80vh] max-w-full rounded-lg object-contain"
              />
              {imageItems.length > 1 ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  onClick={showNextImage}
                  aria-label="Next image"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              ) : null}
            </div>
            <p className="max-w-full truncate text-sm text-white">
              {activeImage.fileName}
              {imageItems.length > 1 ? ` (${viewerIndex! + 1} of ${imageItems.length})` : ""}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
