import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Flame } from "lucide-react";
import { painelHomePath } from "@/painel/access";
import { getPainelAccess } from "@/server/staff";
import { LoginForm } from "./login-form";
import { EvaluatorButton } from "@/visitor/evaluator-button";
import { isEvaluatorWindowOpen } from "@/painel/evaluator";

export const metadata: Metadata = { title: "Entrar no painel · Growlithe" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const access = await getPainelAccess();
  if (access.kind === "staff") redirect(painelHomePath(access.staff));
  const { erro } = await searchParams;

  return (
    <main className="auth-shell">
      <div className="auth-card card reveal reveal-1">
        <a className="brand" href="/">
          <Flame size={20} aria-hidden /> Growlithe
        </a>
        <h1>Painel do shopping</h1>
        <p className="lead">Entre com o e-mail cadastrado pelo marketing do shopping. Sem senha: enviamos um link.</p>
        {isEvaluatorWindowOpen(new Date()) && <EvaluatorButton next="/painel" label="Entrar no painel como avaliador" />}
        <LoginForm linkError={erro === "link"} />
      </div>
    </main>
  );
}
