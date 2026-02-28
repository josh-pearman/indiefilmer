"use client";

import * as React from "react";
import { getCreditsText } from "@/actions/cast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { ScrollText } from "lucide-react";

export function CreditsExportDialog() {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [copyFeedback, setCopyFeedback] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setText(null);
    setLoading(true);
    getCreditsText()
      .then(({ text: t }) => setText(t))
      .finally(() => setLoading(false));
  }, [open]);

  const handleCopy = async () => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="gap-2">
          <ScrollText className="h-4 w-4" />
          Export Credits
        </Button>
      </DialogTrigger>
      <DialogContent
        className="flex flex-col gap-4 overflow-hidden"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
          <h2 className="text-lg font-semibold">Film credits</h2>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={!text || loading}
            >
              {copyFeedback ? "Copied!" : "Copy to Clipboard"}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-muted/30 p-3">
          {loading && <p className="text-sm text-muted-foreground">Generating credits…</p>}
          {!loading && text !== null && (
            <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
              {text}
            </pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
