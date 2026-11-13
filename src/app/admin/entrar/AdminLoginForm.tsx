"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adminLogin } from "@/app/actions";
import { formText } from "@/ui/form";

export function AdminLoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const passcode = formText(new FormData(event.currentTarget), "passcode");
        startTransition(async () => {
          const result = await adminLogin({ passcode });
          if (result.ok) {
            router.replace("/admin");
            router.refresh();
          } else {
            setError(result.message);
          }
        });
      }}
    >
      {error !== null && (
        <div className="alert alert-error" role="alert">
          <span aria-hidden="true">⚠️</span>
          <span>{error}</span>
        </div>
      )}
      <div className="field">
        <label htmlFor="passcode">Senha do painel</label>
        <input id="passcode" name="passcode" type="password" className="input" autoComplete="current-password" required />
      </div>
      <button className="btn btn-block" type="submit" disabled={pending}>
        {pending ? "Entrando…" : "Entrar no painel"}
      </button>
    </form>
  );
}
