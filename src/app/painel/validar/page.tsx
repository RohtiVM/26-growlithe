import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
      <main className="container narrow">
        <h1>Validar cupom de resgate</h1>
        <p className="lead">A validação pelo código de 6 dígitos chega no ticket T8.</p>
      </main>
    </>
  );
}
