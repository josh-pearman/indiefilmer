import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export default function ScriptLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Breadcrumbs />
      {children}
    </>
  );
}
