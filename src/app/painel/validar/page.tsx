import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft, TicketCheck } from "lucide-react";
import { requireStaffRole } from "@/painel/access";
import { getPainelAccess } from "@/server/staff";
import { NoAccess } from "../no-access";
import { PainelHeader } from "../painel-header";

export const metadata: Metadata = { title: "Validar cupom de resgate · Growlithe" };

export default async function ValidarPage() {
  const access = await getPainelAccess();
  if (access.kind === "anonymous") redirect("/painel/login");
  const allowed = requireStaffRole(access, ["admin", "lojista"]);
  if (!allowed.ok) return <NoAccess />;

  return (
    <>
      <PainelHeader staff={allowed.data} />
      <main className="container narrow painel-main">
        {allowed.data.role === "admin" && (
          <a className="back-link" href="/painel">
            <ArrowLeft size={16} aria-hidden /> Painel
          </a>
        )}
        <div className="painel-title reveal reveal-1">
          <h1>Validar cupom de resgate</h1>
          <p className="lead">Digite os 6 dígitos que o visitante mostrar no celular.</p>
        </div>
        <div className="empty reveal reveal-2">
          <TicketCheck size={28} aria-hidden />
          <strong>Validação chegando</strong>
          <span>A conferência pelo código de 6 dígitos entra no ticket T8.</span>
        </div>
      </main>
    </>
  );
}
