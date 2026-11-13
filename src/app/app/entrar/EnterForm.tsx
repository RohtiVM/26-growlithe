"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { enterAsVisitor } from "@/app/actions";
import { formText } from "@/ui/form";

export function EnterForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await enterAsVisitor({
            name: formText(data, "name"),
            email: formText(data, "email"),
          });
          if (result.ok) {
            router.replace(next);
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
        <label htmlFor="name">Seu nome</label>
        <input id="name" name="name" className="input" autoComplete="given-name" required minLength={2} />
      </div>
      <div className="field">
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" className="input" autoComplete="email" inputMode="email" required />
      </div>
      <button className="btn btn-block" type="submit" disabled={pending}>
        {pending ? "Entrando…" : "Entrar e jogar"}
      </button>
    </form>
  );
}
