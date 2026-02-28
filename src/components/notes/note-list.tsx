"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createNote, updateNote, addNoteFile, addNoteLink, restoreNote } from "@/actions/notes";
import { Button } from "@/components/ui/button";
import { NoteCard } from "@/components/notes/note-card";
import { NoteComposerEditor } from "@/components/notes/note-composer-editor";
import { htmlToMarkdown } from "@/components/notes/note-editor-format";
import { Plus, Paperclip, Link2, X } from "lucide-react";

type NoteRow = {
  id: string;
  title: string;
  body: string | null;
  category: string | null;
  createdAt: Date;
  isDeleted: boolean;
  files: Array<{ id: string; fileName: string; filePath: string }>;
  links: Array<{ id: string; label: string; url: string }>;
};

type NoteListProps = {
  notes: NoteRow[];
  categories: string[];
  ownerOptions: Array<{ value: string; label: string }>;
};

export function NoteList({ notes: initialNotes, categories, ownerOptions }: NoteListProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("");
  const [composerOpen, setComposerOpen] = React.useState(false);
  const [composerTitle, setComposerTitle] = React.useState("");
  const [composerBody, setComposerBody] = React.useState("");
  const [pendingFiles, setPendingFiles] = React.useState<File[]>([]);
  const [pendingLinks, setPendingLinks] = React.useState<{ label: string; url: string }[]>([]);
  const [showLinkInput, setShowLinkInput] = React.useState(false);
  const [linkLabel, setLinkLabel] = React.useState("");
  const [linkUrl, setLinkUrl] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [restoringId, setRestoringId] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const pendingImagesRef = React.useRef<Map<string, File>>(new Map());
  const titleInputRef = React.useRef<HTMLInputElement>(null);

  const nextDefaultTitle = React.useMemo(() => {
    const noteNumbers = initialNotes
      .filter((note) => !note.isDeleted)
      .map((note) => note.title.trim().match(/^note\s+(\d+)$/i)?.[1])
      .filter((value): value is string => Boolean(value))
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isFinite(value));

    const nextNumber =
      noteNumbers.length > 0 ? Math.max(...noteNumbers) + 1 : 1;

    return `Note ${nextNumber}`;
  }, [initialNotes]);

  // Focus title input and select generated title when composer opens
  React.useEffect(() => {
    if (composerOpen) {
      requestAnimationFrame(() => {
        const input = titleInputRef.current;
        if (!input) return;
        input.focus();
        input.select();
      });
    }
  }, [composerOpen]);

  const filtered = React.useMemo(() => {
    let list = initialNotes.filter((n) => !n.isDeleted);
    if (categoryFilter) list = list.filter((n) => n.category === categoryFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          (n.body?.toLowerCase().includes(q) ?? false) ||
          (n.category?.toLowerCase().includes(q) ?? false) ||
          n.links.some((l) => l.label.toLowerCase().includes(q) || l.url.toLowerCase().includes(q))
      );
    }
    return [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [initialNotes, search, categoryFilter]);

  async function handleSubmit() {
    const title = composerTitle.trim();
    if (!title) return;

    const body = htmlToMarkdown(composerBody);

    setSubmitting(true);
    const formData = new FormData();
    formData.set("title", title);
    formData.set("body", body);
    const result = await createNote(formData);

    if (!result.error && result.noteId) {
      // Upload pasted images and build blob→real URL map
      const blobToRealUrl = new Map<string, string>();
      for (const [blobUrl, file] of pendingImagesRef.current) {
        const fd = new FormData();
        fd.set("file", file, file.name || "pasted-image.png");
        const uploadResult = await addNoteFile(result.noteId, fd);
        if (uploadResult.filePath) {
          blobToRealUrl.set(blobUrl, `/api/note-files/${uploadResult.filePath}`);
        }
      }

      // Upload non-image files (attached via file picker)
      for (const file of pendingFiles) {
        const fd = new FormData();
        fd.set("file", file);
        await addNoteFile(result.noteId, fd);
      }

      // Replace blob URLs in the note text and update
      if (blobToRealUrl.size > 0) {
        let correctedBody = body;
        for (const [blobUrl, realUrl] of blobToRealUrl) {
          correctedBody = correctedBody.split(blobUrl).join(realUrl);
        }
        const updateFormData = new FormData();
        updateFormData.set("title", title);
        updateFormData.set("body", correctedBody);
        await updateNote(result.noteId, updateFormData);
      }

      // Revoke all blob URLs
      for (const blobUrl of pendingImagesRef.current.keys()) {
        URL.revokeObjectURL(blobUrl);
      }
      pendingImagesRef.current.clear();

      for (const link of pendingLinks) {
        await addNoteLink(result.noteId, link.label, link.url);
      }

      setComposerTitle("");
      setComposerBody("");
      setPendingFiles([]);
      setPendingLinks([]);
      setShowLinkInput(false);
      setComposerOpen(false);
      router.refresh();
    }
    setSubmitting(false);
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setPendingFiles((prev) => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleAddPendingLink() {
    if (!linkLabel.trim() || !linkUrl.trim()) return;
    setPendingLinks((prev) => [...prev, { label: linkLabel.trim(), url: linkUrl.trim() }]);
    setLinkLabel("");
    setLinkUrl("");
    setShowLinkInput(false);
  }

  function cancelComposer() {
    for (const blobUrl of pendingImagesRef.current.keys()) {
      URL.revokeObjectURL(blobUrl);
    }
    pendingImagesRef.current.clear();
    setComposerTitle("");
    setComposerBody("");
    setComposerOpen(false);
    setPendingFiles([]);
    setPendingLinks([]);
    setShowLinkInput(false);
    setLinkLabel("");
    setLinkUrl("");
  }

  async function handleRestore(id: string) {
    setRestoringId(id);
    await restoreNote(id);
    setRestoringId(null);
    router.refresh();
  }

  const categoryOptions = [...new Set(initialNotes.map((n) => n.category).filter(Boolean))] as string[];

  function openComposer() {
    setComposerTitle(nextDefaultTitle);
    setComposerBody("");
    setPendingFiles([]);
    setPendingLinks([]);
    setShowLinkInput(false);
    setLinkLabel("");
    setLinkUrl("");
    setComposerOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Search notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex h-9 max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
        >
          <option value="">All categories</option>
          {categoryOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? null : (
        <div className="space-y-3">
          {filtered.map((n) => (
            <NoteCard
              key={n.id}
              id={n.id}
              title={n.title}
              body={n.body}
              category={n.category}
              createdAt={n.createdAt}
              isDeleted={n.isDeleted}
              files={n.files}
              links={n.links}
              ownerOptions={ownerOptions}
              onRestore={handleRestore}
              restoringId={restoringId}
            />
          ))}
        </div>
      )}

      {composerOpen ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <input
            ref={titleInputRef}
            type="text"
            value={composerTitle}
            onChange={(e) => setComposerTitle(e.target.value)}
            placeholder="Title"
            className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground mb-2"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <div className="border-t border-border pt-2">
            <NoteComposerEditor
              onUpdate={(html) => setComposerBody(html)}
              onPastedImage={(blobUrl, file) => {
                pendingImagesRef.current.set(blobUrl, file);
              }}
              placeholder="Write your note…"
            />
          </div>

          {pendingFiles.length > 0 && (
            <div className="mt-2 space-y-1">
              {pendingFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Paperclip className="h-3 w-3" />
                  <span className="truncate">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {pendingLinks.length > 0 && (
            <div className="mt-2 space-y-1">
              {pendingLinks.map((l, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Link2 className="h-3 w-3" />
                  <span className="truncate">{l.label}</span>
                  <button
                    type="button"
                    onClick={() => setPendingLinks((prev) => prev.filter((_, j) => j !== i))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {showLinkInput && (
            <div className="mt-2 flex items-center gap-2">
              <input
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                placeholder="Label"
                className="h-7 w-28 rounded border border-input bg-transparent px-2 text-xs"
              />
              <input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://…"
                type="url"
                className="h-7 flex-1 rounded border border-input bg-transparent px-2 text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddPendingLink();
                  }
                }}
              />
              <Button size="sm" variant="ghost" onClick={handleAddPendingLink} disabled={!linkLabel.trim() || !linkUrl.trim()}>
                Add
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowLinkInput(false); setLinkLabel(""); setLinkUrl(""); }}>
                Cancel
              </Button>
            </div>
          )}

          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />

          <div className="mt-3 flex items-center gap-1 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Attach a file"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowLinkInput(true)}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Add a link"
            >
              <Link2 className="h-4 w-4" />
            </button>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={cancelComposer}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={submitting || !composerTitle.trim()}>
                {submitting ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={openComposer}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground hover:border-foreground/30 hover:text-foreground"
          title="Add a note"
        >
          <Plus className="h-4 w-4" />
          Add a note
        </button>
      )}
    </div>
  );
}
