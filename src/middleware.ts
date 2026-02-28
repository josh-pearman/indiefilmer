import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { COOKIE_NAME } from "@/lib/auth";
import { PROJECT_COOKIE_NAME, PROJECT_MEMBER_COOKIE_NAME } from "@/lib/project";
import { getSectionForPath, hasAccess } from "@/lib/sections";

const memberCookieSchema = z.object({
  role: z.string(),
  allowedSections: z.string(),
});

const PUBLIC_PATHS = [
  "/login",
  "/setup",
  "/signup",
  "/verify",
  "/pending",
  "/invite",
  "/terms",
  "/privacy",
  "/api/auth",
  "/docs",
  "/intake",
  "/api/intake"
];

const NO_PROJECT_PATHS = ["/projects"];

function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith("/_next") || pathname === "/favicon.ico") return true;
  // PWA static files must never be redirected — service worker spec disallows it
  if (pathname === "/sw.js" || pathname === "/offline.html" || pathname.startsWith("/icons/") || pathname === "/manifest.webmanifest") return true;
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isNoProjectPath(pathname: string): boolean {
  return NO_PROJECT_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    const res = NextResponse.next();
    res.headers.set("x-pathname", pathname);
    return res;
  }

  const sessionCookie = request.cookies.get(COOKIE_NAME)?.value;
  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Build absolute session URL from headers so Edge middleware fetch succeeds
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost:3001";
  const proto = request.headers.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const base = `${proto}://${host}`;
  let data: {
    ok?: boolean;
    approved?: boolean;
    siteRole?: string;
    projectIds?: string[];
    memberships?: Array<{ projectId: string; role: string; allowedSections: string }>;
  } | null = null;
  try {
    const sessionRes = await fetch(`${base}/api/auth/session`, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store"
    });
    data = sessionRes.ok ? await sessionRes.json() : null;
  } catch {
    // fetch failed (e.g. Edge / Turbopack): redirect to login to be safe
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (!data?.ok) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (!data.approved && pathname !== "/setup") {
    const pendingUrl = new URL("/pending", request.url);
    return NextResponse.redirect(pendingUrl);
  }

  if (pathname.startsWith("/admin") && data.siteRole !== "superadmin") {
    const settingsUrl = new URL("/settings", request.url);
    return NextResponse.redirect(settingsUrl);
  }

  if (isNoProjectPath(pathname)) {
    const res = NextResponse.next();
    res.headers.set("x-pathname", pathname);
    return res;
  }

  const projectId = request.cookies.get(PROJECT_COOKIE_NAME)?.value;
  const memberCookie = request.cookies.get(PROJECT_MEMBER_COOKIE_NAME)?.value;
  if (!projectId || !memberCookie) {
    const userProjectIds: string[] = Array.isArray(data.projectIds) ? data.projectIds : [];
    const memberships: Array<{ projectId: string; role: string; allowedSections: string }> =
      Array.isArray(data.memberships) ? data.memberships : [];
    if (userProjectIds.length === 0) {
      const target = new URL("/projects/new", request.url);
      return NextResponse.redirect(target);
    }
    if (userProjectIds.length > 1) {
      const target = new URL("/projects", request.url);
      return NextResponse.redirect(target);
    }
    const onlyProjectId = userProjectIds[0];
    const membership = memberships.find((m) => m.projectId === onlyProjectId);
    const res = NextResponse.redirect(new URL("/", request.url));
    const secureCookie = proto === "https";
    res.cookies.set(PROJECT_COOKIE_NAME, onlyProjectId, {
      httpOnly: true,
      secure: secureCookie,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/"
    });
    if (membership) {
      res.cookies.set(PROJECT_MEMBER_COOKIE_NAME, JSON.stringify({
        role: membership.role,
        allowedSections: membership.allowedSections
      }), {
        httpOnly: true,
        secure: secureCookie,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
        path: "/"
      });
    }
    res.headers.set("x-pathname", pathname);
    return res;
  }

  let member: { role: string; allowedSections: string };
  try {
    const parsed = memberCookieSchema.safeParse(JSON.parse(memberCookie));
    if (!parsed.success) {
      const res = NextResponse.next();
      res.headers.set("x-pathname", pathname);
      return res;
    }
    member = parsed.data;
  } catch {
    const res = NextResponse.next();
    res.headers.set("x-pathname", pathname);
    return res;
  }

  const section = getSectionForPath(pathname);
  if (!section) {
    const res = NextResponse.next();
    res.headers.set("x-pathname", pathname);
    return res;
  }

  if (section === "settings" && member.role !== "admin") {
    const denied = new URL("/", request.url);
    denied.searchParams.set("error", "section-denied");
    return NextResponse.redirect(denied);
  }

  if (!hasAccess(member, section)) {
    const denied = new URL("/", request.url);
    denied.searchParams.set("error", "section-denied");
    return NextResponse.redirect(denied);
  }

  const res = NextResponse.next();
  res.headers.set("x-pathname", pathname);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|icons/).*)"]
};
