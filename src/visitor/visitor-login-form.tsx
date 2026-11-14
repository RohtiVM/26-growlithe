"use client";

import { useActionState } from "react";
import { AlertTriangle, MailCheck } from "lucide-react";
import { sendVisitorMagicLink, type VisitorLinkState } from "@/app/app/actions";

const initial: VisitorLinkState = { status: "idle" };

/** Login do visitante por link mágico. `next` é para onde voltar (o scan ou a Home). */
export function VisitorLoginForm({ next, cta = "Receber link de acesso" }: { next: string; cta?: string }) {
  const [state, action, pending] = useActionState(sendVisitorMagicLink, initial);

  if (state.status === "sent") {
    return (
      <div className="alert" role="status">
        <MailCheck size={20} aria-hidden style={{ flex: "none", marginTop: 2 }} />
        <div>
          <strong>Confira o seu e-mail</strong>
          <p style={{ margin: "4px 0 0" }}>
            Enviamos o link para <strong>{state.email}</strong>. Abra neste celular e toque no link: seus pontos
            entram na hora.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="form" noValidate>
      <input type="hidden" name="next" value={next} />
      <label htmlFor="email">Seu e-mail</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="voce@email.com"
        required
        aria-invalid={state.status === "error"}
        aria-describedby={state.status === "error" ? "email-erro" : undefined}
      />
      {state.status === "error" && (
        <p id="email-erro" className="field-error">
          <AlertTriangle size={18} aria-hidden style={{ flex: "none", marginTop: 2 }} />
          {state.message}
        </p>
      )}
      <button className="btn btn-block" type="submit" disabled={pending}>
        {pending ? "Enviando…" : cta}
      </button>
      <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.875rem" }}>
        Sem senha e sem instalar nada. Usamos seu e-mail só para guardar seus pontos (LGPD).
      </p>
    </form>
  );
}
