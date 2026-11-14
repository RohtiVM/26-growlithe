import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlertTriangle, Flame } from "lucide-react";
import { safeNextPath } from "@/painel/access";
import { getVisitor } from "@/server/visitor";
import { VisitorLoginForm } from "@/visitor/visitor-login-form";
import { EvaluatorButton } from "@/visitor/evaluator-button";
import { isEvaluatorWindowOpen } from "@/painel/evaluator";

export const metadata: Metadata = { title: "Entrar · Growlithe" };

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ next?: string; erro?: string }> }) {
  const { next: rawNext, erro } = await searchParams;
  const safe = safeNextPath(rawNext ?? null);
  const next = safe.startsWith("/painel") ? "/app" : safe;
  if ((await getVisitor()).kind === "visitor") redirect(next);

  return (
    <main className="auth-shell">
      <div className="auth-card card reveal reveal-1">
        <a className="brand" href="/">
          <Flame size={20} aria-hidden /> Growlithe
        </a>
        <h1>Seus pontos te esperam</h1>
        <p className="lead">Entre com seu e-mail para guardar pontos, subir de nível e trocar por prêmios.</p>
        {erro === "link" && (
          <p className="alert" role="alert" style={{ marginBottom: 12 }}>
            <AlertTriangle size={18} aria-hidden style={{ flex: "none", marginTop: 2 }} />
            Esse link expirou ou já foi usado. Peça um novo abaixo.
          </p>
        )}
        {isEvaluatorWindowOpen(new Date()) && <EvaluatorButton next={next} />}
        <VisitorLoginForm next={next} />
      </div>
    </main>
  );
}
