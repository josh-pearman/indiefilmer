"use client";

import { selectProjectForm } from "@/actions/projects";
import { Button } from "@/components/ui/button";

export function SelectProjectButton({ projectId }: { projectId: string }) {
  return (
    <form action={selectProjectForm}>
      <input type="hidden" name="projectId" value={projectId} readOnly />
      <Button type="submit" size="sm">
        Select
      </Button>
    </form>
  );
}
