"use client";

import { useActionState } from "react";
import { sendMagicLink, type MagicLinkState } from "../actions";

const initial: MagicLinkState = { status: "idle" };

export function LoginForm({ linkError }: { linkError: boolean }) {
  const [state, action, pending] = useActionState(sendMagicLink, initial);

  if (state.status === "sent") {
    return (
      <div className="card" role="status">
        <h2>Confira o seu e-mail</h2>
        <p>
          Enviamos um link de acesso para <strong>{state.email}</strong>. Abra o e-mail neste aparelho e toque no
          link.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="form" noValidate>
      {linkError && (
        <p className="alert" role="alert">
          ⚠️ Esse link expirou ou já foi usado. Peça um novo abaixo.
        </p>
      )}
      <label htmlFor="email">E-mail</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        aria-invalid={state.status === "error"}
        aria-describedby={state.status === "error" ? "email-erro" : undefined}
      />
      {state.status === "error" && (
        <p id="email-erro" className="field-error">
          ⚠️ {state.message}
        </p>
      )}
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Enviando…" : "Enviar link de acesso"}
      </button>
    </form>
  );
}
