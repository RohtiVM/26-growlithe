import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowRight, BarChart3, QrCode, Target, TicketCheck, type LucideIcon } from "lucide-react";
import { painelHomePath } from "@/painel/access";
import { getPainelAccess } from "@/server/staff";
import { NoAccess } from "./no-access";
import { PainelHeader } from "./painel-header";

export const metadata: Metadata = { title: "Painel · Growlithe" };

type Tile = { icon: LucideIcon; title: string; text: string } & ({ href: string } | { ticket: string });

const TILES: readonly Tile[] = [
  { icon: TicketCheck, title: "Validar cupom de resgate", text: "Digite os 6 dígitos que o visitante mostrar.", href: "/painel/validar" },
  { icon: QrCode, title: "Checkpoints e QR", text: "Cadastre pontos físicos e imprima os QR Codes.", href: "/painel/checkpoints" },
  { icon: Target, title: "Missões", text: "Crie missões e lance uma Missão Relâmpago.", href: "/painel/missoes" },
  { icon: BarChart3, title: "Dashboard", text: "Check-ins, scans por checkpoint, resgates e leads da landing.", ticket: "T9" },
];

export default async function PainelPage() {
  const access = await getPainelAccess();
  if (access.kind === "anonymous") redirect("/painel/login");
  if (access.kind === "no_access") return <NoAccess />;
  const home = painelHomePath(access.staff);
  if (home !== "/painel") redirect(home);

  return (
    <>
      <PainelHeader staff={access.staff} />
      <main className="container painel-main">
        <div className="painel-title reveal reveal-1">
          <span className="eyebrow">Shopping Capim Dourado</span>
          <h1>Painel do shopping</h1>
          <p className="lead">O que você quer fazer agora?</p>
        </div>
        <div className="grid reveal reveal-2">
          {TILES.map((t) =>
            "href" in t ? (
              <a className="card card-link tile" href={t.href} key={t.title}>
                <span className="icon-tile"><t.icon size={22} aria-hidden /></span>
                <h3>{t.title}</h3>
                <p>{t.text}</p>
                <span className="tile-foot">
                  Abrir <ArrowRight size={16} aria-hidden />
                </span>
              </a>
            ) : (
              <article className="card tile tile-soon" key={t.title}>
                <span className="icon-tile"><t.icon size={22} aria-hidden /></span>
                <h3>{t.title}</h3>
                <p>{t.text}</p>
                <span className="tile-foot">Em breve ({t.ticket})</span>
              </article>
            ),
          )}
        </div>
      </main>
    </>
  );
}
