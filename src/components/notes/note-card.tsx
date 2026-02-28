"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  updateNote,
  addNoteLink,
  removeNoteLink,
  addNoteFile,
  removeNoteFile,
  deleteNote
} from "@/actions/notes";
import { Button } from "@/components/ui/button";
import { ConvertToTaskModal } from "@/components/notes/convert-to-task-modal";
import { NoteComposerEditor } from "@/components/notes/note-composer-editor";
import {
  htmlToMarkdown,
  markdownToHtml,
} from "@/components/notes/note-editor-format";
import { Pencil, Paperclip, Link2, ListTodo, Trash2, X } from "lucide-react";
import { MarkdownRenderer } from "@/components/shared/markdown-renderer";
import { cn } from "@/lib/utils";

type NoteCardProps = {
  id: string;
  title: string;
  body: string | null;
  category: string | null;
  createdAt: Date;
  isDeleted: boolean;
  files: Array<{ id: string; fileName: string; filePath: string }>;
  links: Array<{ id: string; label: string; url: string }>;
  ownerOptions: Array<{ value: string; label: string }>;
  onRestore?: (id: string) => void;
  restoringId?: string | null;
};

export function NoteCard({
  id,
  title,
  body,
  category,
  createdAt,
  isDeleted,
  files,
  links,
  ownerOptions,
  onRestore,
  restoringId
}: NoteCardProps) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState("");
  const [editBodyHtml, setEditBodyHtml] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [convertOpen, setConvertOpen] = React.useState(false);
  const [showLinkInput, setShowLinkInput] = React.useState(false);
  const [linkLabel, setLinkLabel] = React.useState("");
  const [linkUrl, setLinkUrl] = React.useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const pendingImagesRef = React.useRef<Map<string, File>>(new Map());
  const titleInputRef = React.useRef<HTMLInputElement>(null);

  function startEdit() {
    setEditTitle(title);
    setEditBodyHtml(markdownToHtml(body ?? ""));
    setEditing(true);
    requestAnimationFrame(() => titleInputRef.current?.focus());
  }

  function cancelEdit() {
    for (const blobUrl of pendingImagesRef.current.keys()) {
      URL.revokeObjectURL(blobUrl);
    }
    pendingImagesRef.current.clear();
    setEditing(false);
    setShowLinkInput(false);
    setLinkLabel("");
    setLinkUrl("");
    setEditTitle("");
    setEditBodyHtml("");
  }

  async function handleSave() {
    const newTitle = editTitle.trim();
    if (!newTitle) return;

    let newBody = htmlToMarkdown(editBodyHtml);

    setSaving(true);

    if (pendingImagesRef.current.size > 0) {
      const blobToRealUrl = new Map<string, string>();

      for (const [blobUrl, file] of pendingImagesRef.current) {
        const uploadFormData = new FormData();
        uploadFormData.set("file", file, file.name || "pasted-image.png");
        const uploadResult = await addNoteFile(id, uploadFormData);

        if (uploadResult.filePath) {
          blobToRealUrl.set(blobUrl, `/api/note-files/${uploadResult.filePath}`);
        }
      }

      for (const [blobUrl, realUrl] of blobToRealUrl) {
        newBody = newBody.split(blobUrl).join(realUrl);
      }
    }

    const formData = new FormData();
    formData.set("title", newTitle);
    formData.set("body", newBody);
    formData.set("category", category ?? "");
    await updateNote(id, formData);

    for (const blobUrl of pendingImagesRef.current.keys()) {
      URL.revokeObjectURL(blobUrl);
    }
    pendingImagesRef.current.clear();

    setSaving(false);
    setEditing(false);
    setEditTitle("");
    setEditBodyHtml("");
    router.refresh();
  }

  async function handleAttachFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);
    await addNoteFile(id, formData);
    router.refresh();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleAddLink() {
    if (!linkLabel.trim() || !linkUrl.trim()) return;
    await addNoteLink(id, linkLabel.trim(), linkUrl.trim());
    setLinkLabel("");
    setLinkUrl("");
    setShowLinkInput(false);
    router.refresh();
  }

  async function handleRemoveLink(linkId: string) {
    await removeNoteLink(linkId);
    router.refresh();
  }

  async function handleRemoveFile(fileId: string) {
    await removeNoteFile(fileId);
    router.refresh();
  }

  async function handleDelete() {
    setDeleting(true);
    await deleteNote(id);
    setDeleting(false);
    router.refresh();
  }

  /* ── Edit mode ── */
  if (editing) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <input
          ref={titleInputRef}
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSave();
            }
          }}
          className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
          placeholder="Title"
        />
        <div className="mt-2 border-t border-border pt-2">
          <NoteComposerEditor
            key={`${id}-editor`}
            initialContent={editBodyHtml}
            onUpdate={setEditBodyHtml}
            onPastedImage={(blobUrl, file) => {
              pendingImagesRef.current.set(blobUrl, file);
            }}
            placeholder="Write your note…"
          />
        </div>

        {files.length > 0 && (
          <div className="mt-2 space-y-1">
            {files.map((f) => (
              <div key={f.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Paperclip className="h-3 w-3 shrink-0" />
                <span className="truncate">{f.fileName}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveFile(f.id)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {links.length > 0 && (
          <div className="mt-2 space-y-1">
            {links.map((l) => (
              <div key={l.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Link2 className="h-3 w-3 shrink-0" />
                <span className="truncate">{l.label}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveLink(l.id)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
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
                  handleAddLink();
                }
              }}
            />
            <Button size="sm" variant="ghost" onClick={handleAddLink} disabled={!linkLabel.trim() || !linkUrl.trim()}>
              Add
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowLinkInput(false); setLinkLabel(""); setLinkUrl(""); }}>
              Cancel
            </Button>
          </div>
        )}

        <input ref={fileInputRef} type="file" className="hidden" onChange={handleAttachFile} />

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
            <Button variant="ghost" size="sm" onClick={cancelEdit}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !editTitle.trim()}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Read-only mode ── */
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4 text-sm",
        isDeleted && "opacity-70"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Link
            href={`/production/notes/${id}`}
            className={cn(
              "font-semibold text-primary hover:underline",
              isDeleted && "line-through"
            )}
          >
            {title}
          </Link>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {new Date(createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric"
            })}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {category && (
            <span className="shrink-0 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
              {category}
            </span>
          )}
          {isDeleted && onRestore && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onRestore(id)}
              disabled={restoringId === id}
            >
              {restoringId === id ? "Restoring…" : "Restore"}
            </Button>
          )}
        </div>
      </div>

      {body && (
        <div className="mt-2 text-muted-foreground line-clamp-3">
          <MarkdownRenderer content={body} />
        </div>
      )}

      {(files.length > 0 || links.length > 0) && (
        <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
          {files.length > 0 && (
            <span title="Attachments" className="inline-flex items-center gap-0.5">
              <Paperclip className="h-3 w-3" /> {files.length}
            </span>
          )}
          {links.length > 0 && (
            <span title="Links" className="inline-flex items-center gap-0.5">
              <Link2 className="h-3 w-3" /> {links.length}
            </span>
          )}
        </div>
      )}

      {!isDeleted && (
        <div className="mt-3 flex items-center gap-1 border-t border-border pt-3">
          <button
            type="button"
            onClick={startEdit}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Edit note"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setConvertOpen(true)}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Convert to a task"
          >
            <ListTodo className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
            title="Delete note"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}

      <ConvertToTaskModal
        open={convertOpen}
        onOpenChange={setConvertOpen}
        noteId={id}
        noteTitle={title}
        ownerOptions={ownerOptions}
      />
    </div>
  );
}
