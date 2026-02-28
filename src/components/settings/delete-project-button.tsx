"use client";

import * as React from "react";
import { deleteProject } from "@/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  projectName: string;
};

export function DeleteProjectButton({ projectName }: Props) {
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [confirmation, setConfirmation] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      const result = await deleteProject(confirmation);
      if (result?.error) {
        setError(result.error);
      }
    });
  };

  if (!showConfirm) {
    return (
      <Button
        type="button"
        variant="destructive"
        className="w-full justify-center"
        onClick={() => setShowConfirm(true)}
      >
        Delete this project
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        This will permanently delete <strong>{projectName}</strong> and all its data,
        including uploaded files and backups. All collaborators will lose access.
        This action cannot be undone.
      </p>
      <div className="space-y-2">
        <label htmlFor="delete-project-confirm" className="text-sm font-medium">
          Type <span className="font-mono font-bold">{projectName}</span> to confirm
        </label>
        <Input
          id="delete-project-confirm"
          type="text"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder={projectName}
          disabled={isPending}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="destructive"
          onClick={handleDelete}
          disabled={isPending || confirmation.trim() !== projectName.trim()}
        >
          {isPending ? "Deleting..." : "Permanently delete project"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setShowConfirm(false);
            setConfirmation("");
            setError(null);
          }}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
