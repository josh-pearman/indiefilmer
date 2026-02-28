import { prisma } from "@/lib/db";
import { requireCurrentProjectId } from "@/lib/project";
import { ScriptHub } from "@/components/script/script-hub";

async function getScriptData() {
  const projectId = await requireCurrentProjectId();
  const [current, all] = await Promise.all([
    prisma.scriptVersion.findFirst({
      where: { projectId, isCurrent: true, isDeleted: false },
      orderBy: { createdAt: "desc" }
    }),
    prisma.scriptVersion.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const map = (v: NonNullable<typeof current>) => ({
    id: v.id,
    versionName: v.versionName,
    filePath: v.filePath,
    fileName: v.fileName,
    pageCount: v.pageCount,
    notes: v.notes,
    isCurrent: v.isCurrent,
    isDeleted: v.isDeleted,
    createdAt: v.createdAt
  });

  return {
    currentVersion: current ? map(current) : null,
    allVersions: all.map(map)
  };
}

export default async function ScriptPage() {
  const { currentVersion, allVersions } = await getScriptData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Script Hub</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload screenplay drafts, track revisions, and keep the team on the same page.
        </p>
      </div>
      <ScriptHub currentVersion={currentVersion} allVersions={allVersions} />
    </div>
  );
}
