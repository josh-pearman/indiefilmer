"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { addSceneCast, removeSceneCast } from "@/actions/scenes";
import { runAction } from "@/hooks/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type CastMemberOption = { id: string; name: string; roleName: string | null; actorName: string | null };
type AssignedCast = { id: string; castMemberId: string; name: string; roleName: string | null; actorName: string | null };

type SceneCastListProps = {
  sceneId: string;
  assigned: AssignedCast[];
  allCast: CastMemberOption[];
};

export function SceneCastList({
  sceneId,
  assigned,
  allCast
}: SceneCastListProps) {
  const router = useRouter();
  const [addId, setAddId] = React.useState("");
  const [pending, setPending] = React.useState<string | null>(null);

  const assignedIds = new Set(assigned.map((a) => a.castMemberId));
  const available = allCast.filter((c) => !assignedIds.has(c.id));

  async function handleAdd() {
    if (!addId) return;
    setPending(addId);
    await runAction(() => addSceneCast(sceneId, addId), "Add cast failed");
    setAddId("");
    setPending(null);
    router.refresh();
  }

  async function handleRemove(castMemberId: string) {
    setPending(castMemberId);
    await runAction(() => removeSceneCast(sceneId, castMemberId), "Remove cast failed");
    setPending(null);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cast in scene</CardTitle>
        <p className="text-sm text-muted-foreground">
          Assign cast members from the Cast &amp; Roles module.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {allCast.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No cast members exist yet. Add them in the Cast &amp; Roles module,
            then assign them here.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={addId}
                onChange={(e) => setAddId(e.target.value)}
                className="flex h-9 min-w-[12rem] rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">Add cast…</option>
                {available.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.roleName ? ` — ${c.roleName}` : ""}
                    {c.actorName?.trim() ? ` (${c.actorName})` : ""}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAdd}
                disabled={!addId || pending !== null}
              >
                Add
              </Button>
            </div>
            <ul className="space-y-2">
              {assigned.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
                >
                  <span>
                    <span className="font-medium">{a.name}</span>
                    {a.roleName && (
                      <span className="text-muted-foreground"> — {a.roleName}</span>
                    )}
                    {a.actorName?.trim() && (
                      <span className="text-muted-foreground text-xs block mt-0.5">
                        Actor: {a.actorName}
                      </span>
                    )}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(a.castMemberId)}
                    disabled={pending !== null}
                    className="text-destructive hover:text-destructive"
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
            {assigned.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No cast assigned to this scene yet.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
