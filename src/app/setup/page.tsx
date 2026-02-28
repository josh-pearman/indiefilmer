import { redirect } from "next/navigation";
import { checkSetupAllowed } from "@/actions/setup";
import { SetupForm } from "@/components/auth/setup-form";

export default async function SetupPage() {
  const allowed = await checkSetupAllowed();
  if (!allowed) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <SetupForm />
    </div>
  );
}
