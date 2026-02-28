"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

type CopyButtonProps = {
  text: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
};

export function CopyButton({
  text,
  label = "Copy",
  copiedLabel = "Copied!",
  className
}: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      const t = setTimeout(() => {
        setCopied(false);
      }, 2000);
      return () => clearTimeout(t);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className={className}
    >
      {copied ? copiedLabel : label}
    </Button>
  );
}
