import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { COOKIE_NAME } from "@/lib/auth";

export async function GET() {
  const cookieStore = await cookies();
  const value = cookieStore.get(COOKIE_NAME)?.value;
  if (!value) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: value },
    select: { id: true, approved: true, siteRole: true }
  });
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const memberships = await prisma.projectMember.findMany({
    where: { userId: user.id },
    select: { projectId: true, role: true, allowedSections: true }
  });
  return NextResponse.json({
    ok: true,
    approved: user.approved,
    siteRole: user.siteRole,
    projectIds: memberships.map((m) => m.projectId),
    memberships: memberships.map((m) => ({
      projectId: m.projectId,
      role: m.role,
      allowedSections: m.allowedSections
    }))
  });
}
