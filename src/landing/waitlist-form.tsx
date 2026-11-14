"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { LEAD_PROFILES, LeadProfile, type Utm, type WaitlistField } from "@/domain/schemas";
import { joinWaitlistAction } from "./actions";
import { companyLabel, type WaitlistState } from "./waitlist";

const PROFILE_LABELS = {
  visitante: "Visitante",
  lojista: "Lojista",
  shopping: "Shopping",
} as const satisfies Record<LeadProfile, string>;

const initial: WaitlistState = { status: "idle" };

const EMPTY = { name: "", email: "", profile: "visitante", company: "", consentLgpd: false };

function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (message === undefined) return null;
  return (
    <p id={id} className="field-error">
      <AlertTriangle size={18} aria-hidden style={{ flex: "none", marginTop: 2 }} />
      {message}
    </p>
  );
}

/** Formulário da lista de espera (spec 002, T4). Variante e UTM não são escolhas do usuário. */
export function WaitlistForm({ utm }: { utm: Utm }) {
  const [state, action, pending] = useActionState(joinWaitlistAction, initial);
  const values = state.status === "invalid" || state.status === "error" ? state.values : EMPTY;
  const errors = state.status === "invalid" ? state.fieldErrors : {};
  // Rádios não controlados: o React reinicia o formulário depois da ação e volta ao `defaultChecked`
  // (o perfil enviado); este estado só decide se o campo de empresa aparece.
  const [profile, setProfile] = useState<LeadProfile>(LeadProfile.catch("visitante").parse(values.profile));

  if (state.status === "joined" || state.status === "already_joined") {
    return (
      <p className="alert waitlist-done" role="status">
        <CheckCircle2 size={20} aria-hidden style={{ flex: "none", marginTop: 2 }} />
        {state.message}
      </p>
    );
  }

  const errorId = (field: WaitlistField) => `waitlist-${field}-erro`;
  const describedBy = (field: WaitlistField) => (errors[field] === undefined ? undefined : errorId(field));
  const company = companyLabel(profile);

  return (
    <form action={action} className="form waitlist-form" noValidate>
      {utm.source !== null && <input type="hidden" name="utm_source" value={utm.source} />}
      {utm.medium !== null && <input type="hidden" name="utm_medium" value={utm.medium} />}
      {utm.campaign !== null && <input type="hidden" name="utm_campaign" value={utm.campaign} />}

      <div className="waitlist-row">
        <div className="form">
          <label htmlFor="waitlist-name">Nome</label>
          <input
            id="waitlist-name"
            name="name"
            autoComplete="name"
            maxLength={80}
            required
            defaultValue={values.name}
            aria-invalid={errors.name !== undefined}
            aria-describedby={describedBy("name")}
          />
          <FieldError id={errorId("name")} message={errors.name} />
        </div>
        <div className="form">
          <label htmlFor="waitlist-email">E-mail</label>
          <input
            id="waitlist-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="voce@exemplo.com"
            maxLength={254}
            required
            defaultValue={values.email}
            aria-invalid={errors.email !== undefined}
            aria-describedby={describedBy("email")}
          />
          <FieldError id={errorId("email")} message={errors.email} />
        </div>
      </div>

      <fieldset className="choice-group" aria-describedby={describedBy("profile")}>
        <legend>Eu sou</legend>
        <div className="choices">
          {LEAD_PROFILES.map((option) => (
            <label className="choice" key={option}>
              <input
                type="radio"
                name="profile"
                value={option}
                defaultChecked={values.profile === option}
                onChange={() => {
                  setProfile(option);
                }}
              />
              {PROFILE_LABELS[option]}
            </label>
          ))}
        </div>
        <FieldError id={errorId("profile")} message={errors.profile} />
      </fieldset>

      {company !== null && (
        <>
          <label htmlFor="waitlist-company">{company}</label>
          <input
            id="waitlist-company"
            name="company"
            autoComplete="organization"
            maxLength={80}
            required
            defaultValue={values.company}
            aria-invalid={errors.company !== undefined}
            aria-describedby={describedBy("company")}
          />
          <FieldError id={errorId("company")} message={errors.company} />
        </>
      )}

      <label className="consent">
        <input
          type="checkbox"
          name="consentLgpd"
          defaultChecked={values.consentLgpd}
          aria-invalid={errors.consentLgpd !== undefined}
          aria-describedby={describedBy("consentLgpd")}
        />
        <span>Aceito receber contato do Growlithe, conforme a política de privacidade (LGPD).</span>
      </label>
      <FieldError id={errorId("consentLgpd")} message={errors.consentLgpd} />

      {state.status === "error" && (
        <p className="alert" role="alert">
          <AlertTriangle size={18} aria-hidden style={{ flex: "none", marginTop: 2 }} />
          {state.message}
        </p>
      )}

      <button className="btn btn-block" type="submit" disabled={pending}>
        {pending ? "Enviando…" : "Entrar na lista de espera"}
      </button>
    </form>
  );
}
