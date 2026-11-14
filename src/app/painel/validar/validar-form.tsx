"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, CheckCircle2, RotateCcw, TicketCheck } from "lucide-react";
import type { Tier } from "@/domain/schemas";
import { validarCupomAction, type ValidarState } from "./actions";
import styles from "./validar.module.css";

const initial: ValidarState = { step: "idle" };

const TIER_LABELS = {
  bronze: "Bronze",
  prata: "Prata",
  ouro: "Ouro",
  diamante: "Diamante",
} as const satisfies Record<Tier, string>;

/** A5. Remontar (key) zera o estado para conferir o próximo cupom de resgate. */
export function ValidarCupom() {
  const [round, setRound] = useState(0);
  return (
    <ValidarForm
      key={round}
      onNext={() => {
        setRound((n) => n + 1);
      }}
    />
  );
}

function ValidarForm({ onNext }: { onNext: () => void }) {
  const [state, action, pending] = useActionState(validarCupomAction, initial);

  if (state.step === "done") {
    return (
      <section className={`card ${styles.done}`} aria-live="polite">
        <p className={styles.status}>
          <CheckCircle2 size={22} aria-hidden /> Resgate confirmado
        </p>
        <p className={styles.benefit}>{state.benefitText}</p>
        <p className="muted">
          Entregue o benefício para {state.firstName}. Validado em {state.redeemedAt}.
        </p>
        <button className="btn btn-block" type="button" onClick={onNext} autoFocus>
          <RotateCcw size={18} aria-hidden /> Validar outro código
        </button>
      </section>
    );
  }

  const preview = state.step === "preview" ? state : null;
  const error = state.step === "error" ? state : null;
  const defaultCode = preview?.code ?? error?.code ?? "";

  return (
    <form action={action} className="form card" noValidate>
      <label htmlFor="code">Código do cupom de resgate</label>
      <input
        id="code"
        name="code"
        className={styles.code}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        placeholder="000000"
        defaultValue={defaultCode}
        readOnly={preview !== null}
        aria-invalid={error !== null}
        aria-describedby={error !== null ? "validar-erro" : "validar-dica"}
        autoFocus
      />
      {error === null && preview === null && (
        <p id="validar-dica" className={`muted ${styles.hint}`}>
          Os 6 dígitos aparecem no celular do visitante, na tela do resgate.
        </p>
      )}

      {error !== null && (
        <p id="validar-erro" className="field-error" role="alert">
          <AlertTriangle size={18} aria-hidden style={{ flex: "none", marginTop: 2 }} />
          {error.message}
        </p>
      )}

      {preview === null ? (
        <button className="btn btn-block" type="submit" name="intent" value="conferir" disabled={pending}>
          {pending ? "Conferindo…" : "Conferir código"}
        </button>
      ) : (
        <>
          <section className={styles.result} aria-live="polite" aria-label="Cupom de resgate encontrado">
            <p className={styles.status}>
              <TicketCheck size={20} aria-hidden /> Cupom de resgate válido
            </p>
            <p className={styles.benefit}>{preview.benefitText}</p>
            <p className={styles.who}>
              <span className={`${styles.tier} tier-${preview.tier}`} aria-hidden>
                {TIER_LABELS[preview.tier].charAt(0)}
              </span>
              <span>
                <strong>{preview.firstName}</strong> · Nível {TIER_LABELS[preview.tier]}
              </span>
            </p>
            <p className="muted">
              {preview.rewardTitle} · vale até {preview.expiresAt}
            </p>
          </section>
          <button className="btn btn-block" type="submit" name="intent" value="confirmar" disabled={pending}>
            {pending ? "Confirmando…" : "Confirmar resgate"}
          </button>
          <button className="btn btn-secondary btn-block" type="button" onClick={onNext} disabled={pending}>
            Conferir outro código
          </button>
        </>
      )}
    </form>
  );
}
