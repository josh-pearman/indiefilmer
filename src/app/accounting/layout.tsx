import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export default function AccountingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Breadcrumbs />
      {children}
    </>
  );
}
