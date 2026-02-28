import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { COOKIE_NAME } from "@/lib/auth";
import { PROJECT_COOKIE_NAME, PROJECT_MEMBER_COOKIE_NAME } from "@/lib/project";

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("id");
  if (!projectId) {
    return NextResponse.redirect(new URL("/projects", request.url));
  }

  const cookieStore = await cookies();
  const userId = cookieStore.get(COOKIE_NAME)?.value;
  if (!userId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
    select: { role: true, allowedSections: true }
  });

  if (!member) {
    return NextResponse.redirect(new URL("/projects", request.url));
  }

  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set(PROJECT_COOKIE_NAME, projectId, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/"
  });
  response.cookies.set(PROJECT_MEMBER_COOKIE_NAME, JSON.stringify({
    role: member.role,
    allowedSections: member.allowedSections
  }), {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/"
  });

  return response;
}
