import { redirect } from "next/navigation";
import { getAuthMode } from "@/lib/auth";
import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  if (getAuthMode() !== "email") {
    redirect("/login");
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <SignupForm />
    </div>
  );
}
