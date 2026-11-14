import type { StaffMember } from "@/domain/schemas";
import { signOut } from "./actions";

const ROLE_LABEL = { admin: "Admin do shopping", lojista: "Lojista" } as const satisfies Record<
  StaffMember["role"],
  string
>;

export function PainelHeader({ staff }: { staff: StaffMember }) {
  return (
    <header className="container nav">
      <span className="brand">🔥 Painel</span>
      <form action={signOut} className="nav-actions">
        <span className="muted">{ROLE_LABEL[staff.role]}</span>
        <button className="btn btn-secondary" type="submit">
          Sair
        </button>
      </form>
    </header>
  );
}
