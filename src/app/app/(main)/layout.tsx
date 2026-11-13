import type { ReactNode } from "react";
import { requireVisitor } from "@/server/visitor";
import { TabBar } from "@/ui/components/TabBar";

export default async function VisitorLayout({ children }: { children: ReactNode }) {
  await requireVisitor();
  return (
    <>
      <main className="app">{children}</main>
      <TabBar />
    </>
  );
}
