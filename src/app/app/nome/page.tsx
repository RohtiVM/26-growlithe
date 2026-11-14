import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Flame } from "lucide-react";
import { safeNextPath } from "@/painel/access";
import { getVisitor } from "@/server/visitor";
import { NameForm } from "@/visitor/name-form";

export const metadata: Metadata = { title: "Seu nome · Growlithe" };

export default async function NomePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next: rawNext } = await searchParams;
  const safe = safeNextPath(rawNext ?? null);
  const next = safe.startsWith("/painel") ? "/app" : safe;
  const visitor = await getVisitor();
  if (visitor.kind === "anonymous") redirect(`/app/entrar?next=${encodeURIComponent(next)}`);
  if (visitor.name !== "") redirect(next);

  return (
    <main className="auth-shell">
      <div className="auth-card card reveal reveal-1">
        <a className="brand" href="/">
          <Flame size={20} aria-hidden /> Growlithe
        </a>
        <h1>Bem-vindo ao Growlithe!</h1>
        <p className="lead">Só falta uma coisa antes dos seus pontos.</p>
        <NameForm next={next} />
      </div>
    </main>
  );
}
