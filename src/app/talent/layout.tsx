import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export default function TalentLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Breadcrumbs />
      {children}
    </>
  );
}
