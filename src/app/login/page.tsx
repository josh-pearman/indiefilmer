import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getAuthMode, getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function LoginPage() {
  const userId = await getSessionUser();
  if (userId) {
    redirect("/");
  }
  const authMode = getAuthMode();
  const userCount = await prisma.user.count();
  if (authMode === "password" && userCount === 0) {
    redirect("/setup");
  }
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <LoginForm authMode={authMode} />
    </div>
  );
}


