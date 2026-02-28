"use client";

import * as React from "react";
import {
  updateProjectMemberSections,
  updateProjectMemberRole,
  removeProjectMember
} from "@/actions/project-members";
import { Button } from "@/components/ui/button";
import { SECTION_LABELS } from "@/lib/sections";

type Member = {
  id: string;
  userId: string;
  userName: string;
  username: string | null;
  email: string | null;
  role: string;
  allowedSections: string[];
};

export function ProjectMemberList({ members }: { members: Member[] }) {
  if (members.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No collaborators yet. Add one above.</p>
    );
  }

  return (
    <ul className="space-y-4">
      {members.map((m) => (
        <ProjectMemberRow key={m.id} member={m} />
      ))}
    </ul>
  );
}

function ProjectMemberRow({ member }: { member: Member }) {
  const [editingSections, setEditingSections] = React.useState(false);
  const [selectedSections, setSelectedSections] = React.useState<Set<string>>(
    () => new Set(member.allowedSections)
  );
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const handleSaveSections = async () => {
    setPending(true);
    setMessage(null);
    const result = await updateProjectMemberSections(member.id, [...selectedSections]);
    setPending(false);
    setMessage(result.error ?? result.success ?? null);
    if (result.success) setEditingSections(false);
  };

  const handleRoleChange = async (newRole: "admin" | "collaborator") => {
    setPending(true);
    setMessage(null);
    const result = await updateProjectMemberRole(member.id, newRole);
    setPending(false);
    setMessage(result.error ?? result.success ?? null);
  };

  const handleRemove = async () => {
    if (!confirm("Remove this collaborator from the project?")) return;
    setPending(true);
    setMessage(null);
    const result = await removeProjectMember(member.id);
    setPending(false);
    setMessage(result.error ?? result.success ?? null);
  };

  return (
    <li className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border p-3">
      <div>
        <div className="font-medium">{member.userName}</div>
        <div className="text-xs text-muted-foreground">
          {member.username ?? member.email ?? member.userId}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            {member.role === "admin" ? "Admin" : "Collaborator"}
          </span>
          {member.role === "collaborator" && member.allowedSections.length > 0 && !editingSections && (
            <span className="flex flex-wrap gap-1">
              {member.allowedSections.map((s) => (
                <span
                  key={s}
                  className="rounded bg-secondary px-1.5 py-0.5 text-xs"
                >
                  {SECTION_LABELS[s as keyof typeof SECTION_LABELS] ?? s}
                </span>
              ))}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {member.role === "admin" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => handleRoleChange("collaborator")}
          >
            Demote to collaborator
          </Button>
        ) : (
          <>
            {!editingSections ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => setEditingSections(true)}
              >
                Edit sections
              </Button>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {(["dashboard", "cast", "crew", "scenes", "locations", "schedule", "budget", "tasks", "notes", "gear", "craft-services", "script", "contacts", "activity"] as const).map((key) => (
                    <label key={key} className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedSections.has(key)}
                        onChange={(e) => {
                          const next = new Set(selectedSections);
                          if (e.target.checked) next.add(key);
                          else next.delete(key);
                          setSelectedSections(next);
                        }}
                      />
                      {SECTION_LABELS[key]}
                    </label>
                  ))}
                </div>
                <Button type="button" size="sm" disabled={pending} onClick={handleSaveSections}>
                  Save sections
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => setEditingSections(false)}
                >
                  Cancel
                </Button>
              </>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => handleRoleChange("admin")}
            >
              Promote to admin
            </Button>
          </>
        )}
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={pending}
          onClick={handleRemove}
        >
          Remove
        </Button>
      </div>
      {message && (
        <p className={`w-full text-sm ${message.startsWith("Failed") || message.includes("error") ? "text-destructive" : "text-green-600 dark:text-green-400"}`}>
          {message}
        </p>
      )}
    </li>
  );
}
