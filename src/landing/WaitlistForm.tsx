"use client";

import { useState, useTransition } from "react";
import { joinWaitlist } from "@/app/actions";
import { JoinWaitlistInput, LEAD_PROFILES, type LeadProfile, type Utm } from "@/domain/schemas";
import { formText } from "@/ui/form";

const PROFILE_LABELS = {
  visitante: "Visitante",
  lojista: "Lojista",
  shopping: "Shopping",
} as const satisfies Record<LeadProfile, string>;

const SUBMIT_LABELS = {
  visitante: "Entrar na lista de espera",
  lojista: "Quero minha loja no Growlithe",
  shopping: "Agendar demonstração",
} as const satisfies Record<LeadProfile, string>;

const isProfile = (v: string): v is LeadProfile => LEAD_PROFILES.some((p) => p === v);

export function WaitlistForm({ defaultProfile, utm }: { defaultProfile: LeadProfile; utm: Utm }) {
  const [profile, setProfile] = useState<LeadProfile>(defaultProfile);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [position, setPosition] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  if (position !== null) {
    return (
      <div className="card pop" role="status" style={{ maxWidth: 520 }}>
        <h3>🎉 Você está na lista!</h3>
        <p>
          Você é a pessoa nº {position.toLocaleString("pt-BR")} na fila. Vamos avisar por e-mail quando o Growlithe
          chegar ao seu shopping.
        </p>
      </div>
    );
  }

  const err = (key: string) =>
    errors[key] === undefined ? null : (
      <small role="alert" style={{ color: "var(--color-text)" }}>
        ⚠️ {errors[key]}
      </small>
    );

  return (
    <form
      noValidate
      style={{ maxWidth: 520 }}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const company = formText(data, "company").trim();
        const parsed = JoinWaitlistInput.safeParse({
          name: formText(data, "name").trim(),
          email: formText(data, "email").trim(),
          profile,
          company: profile === "visitante" || company === "" ? null : company,
          consentLgpd: data.get("consent") === "on",
        });
        if (!parsed.success) {
          const next: Record<string, string> = {};
          for (const issue of parsed.error.issues) next[issue.path.map(String).join(".")] ??= issue.message;
          setErrors(next);
          return;
        }
        setErrors({});
        startTransition(async () => {
          const result = await joinWaitlist({ lead: parsed.data, utm });
          if (result.ok) setPosition(result.data.position);
          else setErrors({ form: result.message });
        });
      }}
    >
      {errors.form !== undefined && (
        <div className="alert alert-error" role="alert">
          <span aria-hidden="true">⚠️</span>
          <span>{errors.form}</span>
        </div>
      )}
      <fieldset className="choices">
        <legend className="small" style={{ fontWeight: 600, marginBottom: 8 }}>
          Eu sou
        </legend>
        {LEAD_PROFILES.map((p) => (
          <label key={p} className="choice">
            <input
              type="radio"
              name="profile"
              value={p}
              checked={profile === p}
              onChange={(e) => {
                if (isProfile(e.target.value)) setProfile(e.target.value);
              }}
            />
            {PROFILE_LABELS[p]}
          </label>
        ))}
      </fieldset>
      <div className="field">
        <label htmlFor="wl-name">Nome</label>
        <input id="wl-name" name="name" className="input" autoComplete="name" />
        {err("name")}
      </div>
      <div className="field">
        <label htmlFor="wl-email">E-mail</label>
        <input id="wl-email" name="email" type="email" inputMode="email" className="input" autoComplete="email" />
        {err("email")}
      </div>
      {profile !== "visitante" && (
        <div className="field">
          <label htmlFor="wl-company">{profile === "lojista" ? "Nome da loja" : "Nome do shopping"}</label>
          <input id="wl-company" name="company" className="input" autoComplete="organization" />
        </div>
      )}
      <label className="check">
        <input type="checkbox" name="consent" />
        <span className="small">
          Aceito receber contato do Growlithe por e-mail. Seus dados ficam só com a gente (LGPD) e você pode sair a
          qualquer momento.
        </span>
      </label>
      {err("consentLgpd")}
      <button className="btn btn-block" type="submit" disabled={pending} style={{ marginTop: 8 }}>
        {pending ? "Enviando…" : SUBMIT_LABELS[profile]}
      </button>
    </form>
  );
}
