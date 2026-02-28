"use client";

import * as React from "react";
import { getIntakeTemplate, updateIntakeTemplate } from "@/actions/intake";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  TEMPLATE_VARS,
  DEFAULT_SUBJECT,
  DEFAULT_BODY,
  renderTemplate,
} from "@/lib/intake-template";

export function IntakeTemplateEditor() {
  const [open, setOpen] = React.useState(false);
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    if (open && !loaded) {
      getIntakeTemplate().then((t) => {
        setSubject(t.subject);
        setBody(t.body);
        setLoaded(true);
      });
    }
  }, [open, loaded]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await updateIntakeTemplate(subject, body);
    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  function handleReset() {
    setSubject(DEFAULT_SUBJECT);
    setBody(DEFAULT_BODY);
    setError(null);
    setSaved(false);
  }

  const preview = loaded
    ? renderTemplate(body, {
        firstName: "Sam",
        name: "Sam Rivera",
        projectName: "My Film",
        link: "https://app.example.com/intake/abc123",
      })
    : "";

  const previewSubject = loaded
    ? renderTemplate(subject, {
        firstName: "Sam",
        name: "Sam Rivera",
        projectName: "My Film",
        link: "https://app.example.com/intake/abc123",
      })
    : "";

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="mr-1.5"
        >
          <rect
            x="1.5"
            y="3.5"
            width="13"
            height="9"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M1.5 4.5L8 9L14.5 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Edit Email Template
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent hideTitle={false} className="max-w-2xl">
          <DialogTitle>Intake Email Template</DialogTitle>

          {!loaded ? (
            <p className="text-sm text-muted-foreground py-4">Loading...</p>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Available variables
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(TEMPLATE_VARS).map(([key, desc]) => (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1 rounded bg-accent px-2 py-0.5 text-xs font-mono"
                      title={desc}
                    >
                      {key}
                      <span className="text-muted-foreground font-sans">
                        — {desc}
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value);
                    setSaved(false);
                  }}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Body</label>
                <textarea
                  value={body}
                  onChange={(e) => {
                    setBody(e.target.value);
                    setSaved(false);
                  }}
                  rows={10}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono resize-y"
                />
              </div>

              <details className="group">
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                  Preview
                </summary>
                <div className="mt-2 rounded-md border border-border bg-muted/20 p-3 text-sm space-y-1">
                  <p className="font-medium">Subject: {previewSubject}</p>
                  <hr className="border-border" />
                  <pre className="whitespace-pre-wrap font-sans text-sm">
                    {preview}
                  </pre>
                </div>
              </details>

              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}

              <div className="flex items-center justify-between gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                >
                  Reset to default
                </Button>
                <div className="flex items-center gap-2">
                  {saved && (
                    <span className="text-sm text-green-600">Saved</span>
                  )}
                  <Button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    size="sm"
                  >
                    {saving ? "Saving..." : "Save template"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
