"use client";

import { useActionState } from "react";
import { AlertTriangle, BadgeCheck } from "lucide-react";
import { enterAsEvaluator, type EvaluatorState } from "@/app/avaliador/actions";

const initial: EvaluatorState = { status: "idle" };

/** Spec 008: um toque e o avaliador está dentro, sem e-mail. */
export function EvaluatorButton({
  next,
  label = "Entrar como avaliador",
  inline = false,
}: {
  next: string;
  label?: string;
  /** Na landing: sem a linha divisória e com o botão no tamanho do conteúdo. */
  inline?: boolean;
}) {
  const [state, action, pending] = useActionState(enterAsEvaluator, initial);
  return (
    <form action={action} className={inline ? "evaluator evaluator-inline" : "evaluator"}>
      <input type="hidden" name="next" value={next} />
      <button className={inline ? "btn btn-secondary" : "btn btn-block"} type="submit" disabled={pending}>
        <BadgeCheck size={18} aria-hidden /> {pending ? "Entrando…" : label}
      </button>
      <p className="muted evaluator-note">Avaliadores do HackaRun: sem e-mail e com acesso ao painel, até 15/11.</p>
      {state.status === "error" && (
        <p className="field-error" role="alert">
          <AlertTriangle size={18} aria-hidden style={{ flex: "none", marginTop: 2 }} />
          {state.message}
        </p>
      )}
    </form>
  );
}
