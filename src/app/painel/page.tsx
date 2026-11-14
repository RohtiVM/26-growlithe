import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { painelHomePath } from "@/painel/access";
import { getPainelAccess } from "@/server/staff";
import { NoAccess } from "./no-access";
import { PainelHeader } from "./painel-header";

export const metadata: Metadata = { title: "Painel · Growlithe" };

const SECTIONS = [
  { title: "Dashboard", text: "Check-ins, scans por checkpoint, resgates e leads da landing.", ticket: "T9" },
  { title: "Missões", text: "Criar missões e lançar Missão Relâmpago.", ticket: "T6" },
  { title: "Checkpoints e QR", text: "Cadastrar pontos físicos e imprimir os QR Codes.", ticket: "T5" },
] as const;

export default async function PainelPage() {
  const access = await getPainelAccess();
  if (access.kind === "anonymous") redirect("/painel/login");
  if (access.kind === "no_access") return <NoAccess />;
  const home = painelHomePath(access.staff);
  if (home !== "/painel") redirect(home);

  return (
    <>
      <PainelHeader staff={access.staff} />
      <main className="container">
        <h1>Painel do shopping</h1>
        <div className="grid">
          <a className="card card-link" href="/painel/validar">
            <h3>Validar cupom de resgate</h3>
            <p>Digite os 6 dígitos que o visitante mostrar.</p>
          </a>
          {SECTIONS.map((s) => (
            <article className="card" key={s.title}>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
              <p className="muted">Em construção ({s.ticket})</p>
            </article>
          ))}
        </div>
      </main>
    </>
  );
}
