"use client";

import { useActionState } from "react";
import { AlertTriangle } from "lucide-react";
import { saveVisitorName, type VisitorNameState } from "@/app/app/actions";

const initial: VisitorNameState = { status: "idle" };

export function NameForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(saveVisitorName, initial);
  return (
    <form action={action} className="form" noValidate>
      <input type="hidden" name="next" value={next} />
      <label htmlFor="name">Como podemos te chamar?</label>
      <input
        id="name"
        name="name"
        autoComplete="given-name"
        maxLength={80}
        placeholder="Ex.: Marina"
        required
        autoFocus
        aria-invalid={state.status === "error"}
        aria-describedby={state.status === "error" ? "nome-erro" : undefined}
      />
      {state.status === "error" && (
        <p id="nome-erro" className="field-error">
          <AlertTriangle size={18} aria-hidden style={{ flex: "none", marginTop: 2 }} />
          {state.message}
        </p>
      )}
      <button className="btn btn-block" type="submit" disabled={pending}>
        {pending ? "Salvando…" : "Continuar"}
      </button>
    </form>
  );
}
