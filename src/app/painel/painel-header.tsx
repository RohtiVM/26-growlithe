import { Flame, LogOut, Store, ShieldCheck } from "lucide-react";
import type { StaffMember } from "@/domain/schemas";
import { ThemeToggle } from "@/ui/theme-toggle";
import { signOut } from "./actions";

const ROLE_LABEL = { admin: "Admin do shopping", lojista: "Lojista" } as const satisfies Record<
  StaffMember["role"],
  string
>;

export function PainelHeader({ staff }: { staff: StaffMember }) {
  const RoleIcon = staff.role === "admin" ? ShieldCheck : Store;
  return (
    <header className="site-header no-print">
      <div className="container nav">
        <a className="brand" href="/painel">
          <Flame size={20} aria-hidden /> Painel
        </a>
        <form action={signOut} className="nav-actions">
          <ThemeToggle />
          <span className="role-chip">
            <RoleIcon size={14} aria-hidden /> {ROLE_LABEL[staff.role]}
          </span>
          <button className="btn btn-secondary btn-sm" type="submit">
            <LogOut size={16} aria-hidden /> Sair
          </button>
        </form>
      </div>
    </header>
  );
}
