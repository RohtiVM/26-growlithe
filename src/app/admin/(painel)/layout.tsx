import type { ReactNode } from "react";
import { requireAdmin } from "@/server/visitor";
import { AdminNav } from "./AdminNav";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return (
    <div className="admin">
      <AdminNav />
      <main>{children}</main>
    </div>
  );
}
