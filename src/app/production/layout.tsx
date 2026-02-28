import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export default function ProductionLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Breadcrumbs />
      {children}
    </>
  );
}
