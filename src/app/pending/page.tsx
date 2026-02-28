import { PendingContent } from "@/components/auth/pending-content";

export default function PendingPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4 px-4">
      <PendingContent />
    </div>
  );
}
