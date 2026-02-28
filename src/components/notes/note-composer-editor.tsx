"use client";

import * as React from "react";
import { useEditor, useEditorState, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import type { EditorView } from "@tiptap/pm/view";
import { cn } from "@/lib/utils";

type NoteComposerEditorProps = {
  onUpdate: (html: string) => void;
  onPastedImage: (blobUrl: string, file: File) => void;
  placeholder?: string;
  initialContent?: string;
};

const imageSizes = ["small", "medium", "large"] as const;
type ImageSize = (typeof imageSizes)[number];

const ComposerImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      size: {
        default: "medium",
        parseHTML: (element) => element.getAttribute("data-size") || "medium",
        renderHTML: (attributes) => ({
          "data-size": attributes.size || "medium",
        }),
      },
    };
  },
});

export function NoteComposerEditor({
  onUpdate,
  onPastedImage,
  placeholder = "Write your note…",
  initialContent = "",
}: NoteComposerEditorProps) {
  const onPastedImageRef = React.useRef(onPastedImage);
  onPastedImageRef.current = onPastedImage;
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [toolbarPosition, setToolbarPosition] = React.useState<{
    top: number;
    left: number;
  } | null>(null);

  const handleImagePaste = React.useCallback(
    (view: EditorView, event: ClipboardEvent) => {
      const clipboardData = event.clipboardData;
      if (!clipboardData) return false;

      let imageFile: File | null = null;

      for (const file of Array.from(clipboardData.files)) {
        if (file.type.startsWith("image/")) {
          imageFile = file;
          break;
        }
      }

      if (!imageFile) {
        for (const item of Array.from(clipboardData.items ?? [])) {
          if (item.kind === "file" && item.type.startsWith("image/")) {
            imageFile = item.getAsFile();
            break;
          }
        }
      }

      if (!imageFile) return false;

      event.preventDefault();

      const blobUrl = URL.createObjectURL(imageFile);
      onPastedImageRef.current(blobUrl, imageFile);

      const { state, dispatch } = view;
      const imageNode = state.schema.nodes.image?.create({
        src: blobUrl,
        alt: imageFile.name || "image",
        size: "medium",
      });

      if (!imageNode) return true;

      dispatch(state.tr.replaceSelectionWith(imageNode).scrollIntoView());
      return true;
    },
    []
  );

  const editor = useEditor({
    extensions: [
      StarterKit,
      ComposerImage.configure({ inline: false, allowBase64: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: "tiptap-composer",
      },
      handlePaste: (view, event) => handleImagePaste(view, event),
    },
    onUpdate({ editor: ed }) {
      onUpdate(ed.getHTML());
    },
    immediatelyRender: true,
  });

  const editorState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => {
      if (!currentEditor?.isActive("image")) {
        return { hasSelectedImage: false, selectedImageSize: null as ImageSize | null };
      }

      return {
        hasSelectedImage: true,
        selectedImageSize:
          ((currentEditor.getAttributes("image").size as ImageSize | undefined) ?? "medium"),
      };
    },
  });

  function setImageSize(size: ImageSize) {
    if (!editor) return;
    editor.chain().focus().updateAttributes("image", { size }).run();
  }

  React.useEffect(() => {
    if (!editorState.hasSelectedImage || !editor || !containerRef.current) {
      setToolbarPosition(null);
      return;
    }

    const updateToolbarPosition = () => {
      const container = containerRef.current;
      if (!container) return;

      const imageElement = editor.view.nodeDOM(editor.state.selection.from);
      if (!(imageElement instanceof HTMLElement)) {
        setToolbarPosition(null);
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const imageRect = imageElement.getBoundingClientRect();
      const toolbarWidth = 184;
      const toolbarHeight = 36;
      const gap = 8;

      const centeredLeft =
        imageRect.left - containerRect.left + imageRect.width / 2 - toolbarWidth / 2;
      const maxLeft = Math.max(containerRect.width - toolbarWidth, 0);
      const left = Math.min(Math.max(centeredLeft, 0), maxLeft);

      const canPlaceAbove = imageRect.top - containerRect.top >= toolbarHeight + gap;
      const top = canPlaceAbove
        ? imageRect.top - containerRect.top - toolbarHeight - gap
        : imageRect.bottom - containerRect.top + gap;

      setToolbarPosition({ top, left });
    };

    updateToolbarPosition();

    window.addEventListener("resize", updateToolbarPosition);
    const container = containerRef.current;
    container?.addEventListener("scroll", updateToolbarPosition);

    return () => {
      window.removeEventListener("resize", updateToolbarPosition);
      container?.removeEventListener("scroll", updateToolbarPosition);
    };
  }, [editor, editorState.hasSelectedImage, editorState.selectedImageSize]);

  return (
    <div ref={containerRef} className="relative">
      {editorState.hasSelectedImage && toolbarPosition ? (
        <div
          className="absolute z-10 flex items-center gap-1 rounded-md border border-border bg-card p-1 shadow-sm"
          style={{ top: toolbarPosition.top, left: toolbarPosition.left }}
        >
          {imageSizes.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setImageSize(size)}
              className={cn(
                "rounded border px-2 py-1 text-xs capitalize transition-colors",
                editorState.selectedImageSize === size
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              title="Resize selected image"
            >
              {size}
            </button>
          ))}
        </div>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  );
}
