"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ReceiptUploadProps = {
  name?: string;
  accept?: string;
  currentPath?: string | null;
  className?: string;
};

export function ReceiptUpload({
  name = "receipt",
  accept = "image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf",
  currentPath,
  className
}: ReceiptUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <div className={cn("space-y-1", className)}>
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept={accept}
        className="block w-full text-sm text-muted-foreground file:mr-2 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1 file:text-sm file:text-primary-foreground"
      />
      {currentPath && (
        <p className="text-xs text-muted-foreground">
          Current:{" "}
          <a
            href={`/api/receipts/${encodeURIComponent(currentPath)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            📎 View receipt
          </a>
        </p>
      )}
    </div>
  );
}
