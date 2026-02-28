"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  updateNote,
  deleteNote,
  restoreNote,
  addNoteLink,
  removeNoteLink,
  addNoteFile,
  removeNoteFile
} from "@/actions/notes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LinksSection } from "@/components/shared/links-section";
import { FilesSection } from "@/components/shared/files-section";
import { NoteHistory } from "@/components/notes/note-history";
import { ConvertToTaskModal } from "@/components/notes/convert-to-task-modal";
import { MarkdownRenderer } from "@/components/shared/markdown-renderer";
import { ArrowLeft, ListTodo } from "lucide-react";

const SUGGESTED_CATEGORIES = [
  "Ideas",
  "Reference",
  "Legal",
  "Equipment",
  "Vendors",
  "Music",
  "Permits",
  "Meeting Notes"
];

type AuditEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  before: string | null;
  after: string | null;
  changeNote: string | null;
  performedBy: string | null;
  createdAt: Date;
};

type NoteDetailProps = {
  note: {
    id: string;
    title: string;
    category: string | null;
    body: string | null;
    isDeleted: boolean;
    files: Array< { id: string; fileName: string; filePath: string }>;
    links: Array< { id: string; label: string; url: string }>;
  };
  auditEntries: AuditEntry[];
  categories: string[];
  ownerOptions: Array<{ value: string; label: string }>;
};

export function NoteDetail({
  note,
  auditEntries,
  categories,
  ownerOptions
}: NoteDetailProps) {
  const router = useRouter();
  const [convertOpen, setConvertOpen] = React.useState(false);
  const [pendingSave, setPendingSave] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState(false);
  const [pendingRestore, setPendingRestore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [bodyValue, setBodyValue] = React.useState(note.body ?? "");
  const [uploadingImage, setUploadingImage] = React.useState(false);
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  const allCategories = [...new Set([...SUGGESTED_CATEGORIES, ...categories])];

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPendingSave(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const result = await updateNote(note.id, formData);
    setPendingSave(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  async function handleDelete() {
    setPendingDelete(true);
    await deleteNote(note.id);
    setPendingDelete(false);
    router.push("/production/notes");
  }

  async function handleRestore() {
    setPendingRestore(true);
    await restoreNote(note.id);
    setPendingRestore(false);
    router.refresh();
  }

  async function handleAddLink(label: string, url: string) {
    await addNoteLink(note.id, label, url);
    router.refresh();
  }

  async function handleRemoveLink(id: string) {
    await removeNoteLink(id);
    router.refresh();
  }

  async function handleAttachFile(formData: FormData) {
    await addNoteFile(note.id, formData);
    router.refresh();
  }

  // Use a ref to track bodyValue inside the native paste listener
  const bodyValueRef = React.useRef(bodyValue);
  bodyValueRef.current = bodyValue;

  React.useEffect(() => {
    const textarea = bodyRef.current;
    if (!textarea) return;

    function handlePaste(e: ClipboardEvent) {
      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      let imageFile: File | null = null;
      for (const file of Array.from(clipboardData.files)) {
        if (file.type.startsWith("image/")) {
          imageFile = file;
          break;
        }
      }
      if (!imageFile && clipboardData.items) {
        for (const item of Array.from(clipboardData.items)) {
          if (item.kind === "file" && item.type.startsWith("image/")) {
            imageFile = item.getAsFile();
            break;
          }
        }
      }
      if (!imageFile) return;

      e.preventDefault();

      const cursorPos = textarea?.selectionStart ?? bodyValueRef.current.length;

      setUploadingImage(true);
      const formData = new FormData();
      formData.set("file", imageFile, imageFile.name || "pasted-image.png");

      addNoteFile(note.id, formData).then((result) => {
        setUploadingImage(false);

        if (result.filePath) {
          const imageMarkdown = `![image](/api/note-files/${result.filePath})`;
          const currentBody = bodyValueRef.current;
          const before = currentBody.slice(0, cursorPos);
          const after = currentBody.slice(cursorPos);
          const newValue = before + imageMarkdown + after;
          setBodyValue(newValue);
          router.refresh();

          requestAnimationFrame(() => {
            const el = bodyRef.current;
            if (el) {
              const newPos = cursorPos + imageMarkdown.length;
              el.selectionStart = newPos;
              el.selectionEnd = newPos;
              el.focus();
            }
          });
        } else if (result.error) {
          setError(result.error);
        }
      });
    }

    textarea.addEventListener("paste", handlePaste);
    return () => textarea.removeEventListener("paste", handlePaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  async function handleRemoveFile(id: string) {
    await removeNoteFile(id);
    router.refresh();
  }

  const linkItems = note.links.map((l) => ({
    id: l.id,
    label: l.label,
    url: l.url
  }));

  const fileItems = note.files.map((f) => ({
    id: f.id,
    fileName: f.fileName,
    filePath: f.filePath
  }));

  return (
    <div className="space-y-6">
      <Link
        href="/production/notes"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Notes
      </Link>

      {note.isDeleted && (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm">
          <span className="font-medium">This note has been deleted.</span>{" "}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-2"
            onClick={handleRestore}
            disabled={pendingRestore}
          >
            {pendingRestore ? "Restoring…" : "Restore"}
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className={note.isDeleted ? "line-through" : ""}>
            {note.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="note-detail-title">Title</Label>
              <Input
                id="note-detail-title"
                name="title"
                required
                defaultValue={note.title}
                placeholder="Note title"
                disabled={note.isDeleted}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note-detail-category">Category</Label>
              <Input
                id="note-detail-category"
                name="category"
                list="note-detail-category-list"
                defaultValue={note.category ?? ""}
                placeholder="e.g. Reference, Vendors"
                className="w-full"
                disabled={note.isDeleted}
              />
              <datalist id="note-detail-category-list">
                {allCategories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="note-detail-body">Body</Label>
              <div className="relative">
                <textarea
                  ref={bodyRef}
                  id="note-detail-body"
                  name="body"
                  rows={8}
                  value={bodyValue}
                  onChange={(e) => setBodyValue(e.target.value)}
                  placeholder="Main content of the note… (paste images here)"
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                  disabled={note.isDeleted || uploadingImage}
                />
                {uploadingImage && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/60">
                    <span className="text-xs text-muted-foreground">Uploading image…</span>
                  </div>
                )}
              </div>
              {bodyValue && (
                <div className="rounded-md border border-border p-3">
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Preview</p>
                  <MarkdownRenderer content={bodyValue} className="text-sm" />
                </div>
              )}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={note.isDeleted || pendingSave}>
                {pendingSave ? "Saving…" : "Save"}
              </Button>
              {!note.isDeleted && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConvertOpen(true)}
                >
                  <ListTodo className="mr-1.5 h-4 w-4" />
                  Convert to Task
                </Button>
              )}
              {!note.isDeleted && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={pendingDelete}
                >
                  {pendingDelete ? "Deleting…" : "Delete"}
                </Button>
              )}
            </div>
          </form>

          {!note.isDeleted && (
            <>
              <div className="border-t border-border pt-6">
                <h3 className="mb-3 text-sm font-medium">Links</h3>
                <LinksSection
                  items={linkItems}
                  onAdd={handleAddLink}
                  onRemove={handleRemoveLink}
                />
              </div>

              <div className="border-t border-border pt-6">
                <h3 className="mb-3 text-sm font-medium">Files</h3>
                <FilesSection
                  items={fileItems}
                  onAttach={handleAttachFile}
                  onRemove={handleRemoveFile}
                  fileServeBasePath="/api/note-files"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <NoteHistory entries={auditEntries} initialVisible={20} />

      <ConvertToTaskModal
        open={convertOpen}
        onOpenChange={setConvertOpen}
        noteId={note.id}
        noteTitle={note.title}
        ownerOptions={ownerOptions}
      />
    </div>
  );
}
