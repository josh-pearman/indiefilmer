import { cookies } from "next/headers";
import { prisma, ensureSqlitePragmas } from "./db";
import { getSessionUser } from "./auth";
import { hasAccess, type SectionKey } from "./sections";

export const PROJECT_COOKIE_NAME = "indiefilmer-project";
export const PROJECT_MEMBER_COOKIE_NAME = "indiefilmer-project-member";

/** Get the current project ID from the project cookie. Returns null if not set. */
export async function getCurrentProjectId(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(PROJECT_COOKIE_NAME)?.value ?? null;
  return value && value.trim() ? value : null;
}

/** Get current project ID or throw. Use at the start of server actions that need a project. */
export async function requireCurrentProjectId(): Promise<string> {
  await ensureSqlitePragmas();
  const projectId = await getCurrentProjectId();
  if (!projectId) {
    throw new Error("No project selected. Please select or create a project.");
  }
  return projectId;
}

/** Set the current project cookie (e.g. after selecting or creating a project). */
export async function setCurrentProject(projectId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(PROJECT_COOKIE_NAME, projectId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: "/"
  });
}

/** Clear the project cookie (e.g. on logout). */
export async function clearCurrentProject(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(PROJECT_COOKIE_NAME);
  cookieStore.delete(PROJECT_MEMBER_COOKIE_NAME);
}

/** Set the project member cookie (role + allowedSections) for section enforcement in middleware. */
export async function setProjectMemberCookie(
  projectId: string,
  userId: string
): Promise<void> {
  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
    select: { role: true, allowedSections: true }
  });
  const cookieStore = await cookies();
  if (!member) {
    cookieStore.delete(PROJECT_MEMBER_COOKIE_NAME);
    return;
  }
  const value = JSON.stringify({
    role: member.role,
    allowedSections: member.allowedSections
  });
  cookieStore.set(PROJECT_MEMBER_COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/"
  });
}

/** Throws if the user does not have access to the given section. Use at top of server actions. */
export async function requireSectionAccess(section: SectionKey): Promise<void> {
  const userId = await getSessionUser();
  if (!userId) throw new Error("You must be logged in.");
  const projectId = await getCurrentProjectId();
  if (!projectId) throw new Error("No project selected.");
  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
    select: { role: true, allowedSections: true }
  });
  if (!member) throw new Error("You do not have access to this project.");
  if (!hasAccess(member, section)) {
    throw new Error("You don't have access to this section.");
  }
}

/** Get current project member (role + allowedSections) for layout/sidebar. */
export async function getCurrentProjectMember(projectId: string | null, userId: string | null) {
  if (!projectId || !userId) return null;
  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
    select: { role: true, allowedSections: true }
  });
  return member;
}

/** Throws if the user is not a member of the project. Use in server actions. */
export async function requireProjectMembership(
  userId: string,
  projectId: string
): Promise<void> {
  const member = await prisma.projectMember.findUnique({
    where: {
      userId_projectId: { userId, projectId }
    }
  });
  if (!member) {
    throw new Error("You do not have access to this project.");
  }
}

/** Returns the user's role in the project: "admin" | "collaborator", or null if not a member. */
export async function getProjectRole(
  userId: string,
  projectId: string
): Promise<"admin" | "collaborator" | null> {
  const member = await prisma.projectMember.findUnique({
    where: {
      userId_projectId: { userId, projectId }
    },
    select: { role: true }
  });
  if (!member) return null;
  return member.role === "admin" ? "admin" : "collaborator";
}

/** Get project IDs the user is a member of. Used by middleware to auto-select or redirect. */
export async function getUserProjectIds(userId: string): Promise<string[]> {
  const members = await prisma.projectMember.findMany({
    where: { userId },
    select: { projectId: true }
  });
  return members.map((m) => m.projectId);
}
