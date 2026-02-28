"use client";

import * as React from "react";
import { createProject, type CreateProjectState } from "@/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: CreateProjectState = {};

export function CreateProjectForm() {
  const [state, formAction] = React.useActionState(createProject, initialState);

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Project name</Label>
        <Input
          id="name"
          name="name"
          type="text"
          placeholder="e.g. My Feature Film"
          defaultValue="Untitled Project"
        />
      </div>
      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      <Button type="submit">Create project</Button>
    </form>
  );
}
