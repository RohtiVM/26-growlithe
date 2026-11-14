"use client";

import { useActionState } from "react";
import { AlertTriangle, MailCheck } from "lucide-react";
import { sendMagicLink, type MagicLinkState } from "../actions";

const initial: MagicLinkState = { status: "idle" };

export function LoginForm({ linkError }: { linkError: boolean }) {
  const [state, action, pending] = useActionState(sendMagicLink, initial);

  if (state.status === "sent") {
    return (
      <div className="alert" role="status">
        <MailCheck size={20} aria-hidden style={{ flex: "none", marginTop: 2 }} />
        <div>
          <strong>Confira o seu e-mail</strong>
          <p style={{ margin: "4px 0 0" }}>
            Enviamos um link de acesso para <strong>{state.email}</strong>. Abra o e-mail neste aparelho e toque no
            link.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="form" noValidate>
      {linkError && (
        <p className="alert" role="alert">
          <AlertTriangle size={18} aria-hidden style={{ flex: "none", marginTop: 2 }} />
          Esse link expirou ou já foi usado. Peça um novo abaixo.
        </p>
      )}
      <label htmlFor="email">E-mail</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="voce@shopping.com.br"
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
        {pending ? "Enviando…" : "Enviar link de acesso"}
      </button>
    </form>
  );
}
