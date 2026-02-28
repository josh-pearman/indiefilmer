"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateContactInfo } from "@/actions/contacts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ContactRow } from "@/app/talent/contacts/page";
import { IntakeEmailButton } from "@/components/shared/intake-email-button";
import { IntakeTemplateEditor } from "@/components/shared/intake-template-editor";
import { CreditsExportDialog } from "@/components/cast/credits-export-dialog";

type SortKey = "name" | "type" | "role";
type SortDir = "asc" | "desc";
type TypeFilter = "all" | "cast" | "crew";

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)})${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `(${digits.slice(1, 4)})${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw;
}

function EditableCell({
  value,
  onSave,
  isPhone = false,
}: {
  value: string;
  onSave: (value: string) => Promise<void>;
  isPhone?: boolean;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  React.useEffect(() => {
    setDraft(value);
  }, [value]);

  async function commit() {
    let trimmed = draft.trim();
    if (isPhone && trimmed) trimmed = formatPhone(trimmed);
    if (trimmed === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    await onSave(trimmed);
    setSaving(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        disabled={saving}
        className={cn(
          "w-full rounded border border-input bg-transparent px-1.5 py-0.5 text-sm outline-none focus:ring-1 focus:ring-ring",
          saving && "opacity-50"
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="w-full cursor-pointer rounded px-1.5 py-0.5 text-left text-sm hover:bg-accent"
      title="Click to edit"
    >
      {value || <span className="text-muted-foreground">—</span>}
    </button>
  );
}

export function ContactsList({ contacts, projectName, emailEnabled = false }: { contacts: ContactRow[]; projectName: string; emailEnabled?: boolean }) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all");
  const [sort, setSort] = React.useState<SortKey>("name");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");

  React.useEffect(() => {
    const interval = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(interval);
  }, [router]);

  function handleSort(key: SortKey) {
    if (key === sort) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(key);
      setSortDir("asc");
    }
  }

  const filtered = React.useMemo(() => {
    let list = contacts;
    if (typeFilter !== "all") list = list.filter((c) => c.type === typeFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.role.toLowerCase().includes(q) ||
          (c.phone?.toLowerCase().includes(q) ?? false) ||
          (c.email?.toLowerCase().includes(q) ?? false)
      );
    }
    const mult = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sort === "name") return mult * a.name.localeCompare(b.name);
      if (sort === "type") return mult * a.type.localeCompare(b.type);
      if (sort === "role") return mult * a.role.localeCompare(b.role);
      return 0;
    });
  }, [contacts, typeFilter, search, sort, sortDir]);

  async function handleSave(
    contact: ContactRow,
    field: "phone" | "email" | "emergencyContactName" | "emergencyContactPhone",
    value: string
  ) {
    const result = await updateContactInfo(contact.type, contact.id, field, value);
    if (result.error) {
      alert(result.error);
    } else {
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Search name, role, phone, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex h-9 max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          >
            <option value="all">All types</option>
            <option value="cast">Cast</option>
            <option value="crew">Crew</option>
          </select>
        </div>
        <IntakeTemplateEditor />
        <CreditsExportDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Contacts{" "}
            <span className="text-sm font-normal text-muted-foreground">
              ({filtered.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No contacts match the current filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 text-left font-medium">
                      <button
                        type="button"
                        onClick={() => handleSort("name")}
                        className="inline-flex items-center gap-1 hover:text-foreground focus:outline-none focus:underline"
                      >
                        Name
                        {sort === "name" && (sortDir === "asc" ? " ↑" : " ↓")}
                      </button>
                    </th>
                    <th className="pb-2 text-left font-medium">
                      <button
                        type="button"
                        onClick={() => handleSort("type")}
                        className="inline-flex items-center gap-1 hover:text-foreground focus:outline-none focus:underline"
                      >
                        Type
                        {sort === "type" && (sortDir === "asc" ? " ↑" : " ↓")}
                      </button>
                    </th>
                    <th className="pb-2 text-left font-medium">
                      <button
                        type="button"
                        onClick={() => handleSort("role")}
                        className="inline-flex items-center gap-1 hover:text-foreground focus:outline-none focus:underline"
                      >
                        Role
                        {sort === "role" && (sortDir === "asc" ? " ↑" : " ↓")}
                      </button>
                    </th>
                    <th className="pb-2 text-left font-medium">Phone</th>
                    <th className="pb-2 text-left font-medium">Email</th>
                    <th className="pb-2 text-left font-medium">
                      Emergency Contact
                    </th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr
                      key={`${c.type}-${c.id}`}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="py-2 pr-2">
                        <Link
                          href={c.type === "cast" ? `/talent/cast/${c.id}` : `/talent/crew/${c.id}`}
                          className={cn(
                            "hover:underline",
                            c.uncasted ? "text-red-500" : "text-primary"
                          )}
                        >
                          {c.uncasted ? "—" : c.name}
                        </Link>
                      </td>
                      <td className="py-2 pr-2">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-xs font-medium",
                            c.type === "cast"
                              ? "bg-purple-500/20 text-purple-700"
                              : "bg-blue-500/20 text-blue-700"
                          )}
                        >
                          {c.type === "cast" ? "Cast" : "Crew"}
                        </span>
                      </td>
                      <td className="py-2 pr-2">{c.role}</td>
                      <td className="py-2 pr-2">
                        <EditableCell
                          value={c.phone ?? ""}
                          onSave={(v) => handleSave(c, "phone", v)}
                          isPhone
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <EditableCell
                          value={c.email ?? ""}
                          onSave={(v) => handleSave(c, "email", v)}
                        />
                      </td>
                      <td className="py-2">
                        <div className="flex items-center gap-1">
                          <EditableCell
                            value={c.emergencyContactName ?? ""}
                            onSave={(v) =>
                              handleSave(c, "emergencyContactName", v)
                            }
                          />
                          <EditableCell
                            value={c.emergencyContactPhone ?? ""}
                            onSave={(v) =>
                              handleSave(c, "emergencyContactPhone", v)
                            }
                            isPhone
                          />
                        </div>
                      </td>
                      <td className="py-2 pl-2">
                        <IntakeEmailButton
                          type={c.type}
                          id={c.id}
                          name={c.name}
                          email={c.email}
                          intakeToken={c.intakeToken}
                          projectName={projectName}
                          emailEnabled={emailEnabled}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
