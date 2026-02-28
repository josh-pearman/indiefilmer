import { VerifyForm } from "@/components/auth/verify-form";

export default async function VerifyPage({
  searchParams
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <VerifyForm email={email ?? ""} />
    </div>
  );
}
