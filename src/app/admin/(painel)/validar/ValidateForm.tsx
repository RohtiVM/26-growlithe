"use client";

import { useState, useTransition } from "react";
import { validateRedemption } from "@/app/actions";
import { formatTime } from "@/domain/time";
import { TIER_NAMES } from "@/ui/labels";

type ValidateResult = Awaited<ReturnType<typeof validateRedemption>>;

export function ValidateForm() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<ValidateResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          setResult(await validateRedemption({ code }));
        });
      }}
    >
      <div className="field">
        <label htmlFor="code">Código</label>
        <input
          id="code"
          className="input"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
            setResult(null);
          }}
          style={{ fontSize: "1.75rem", letterSpacing: "0.4em", textAlign: "center", fontWeight: 800 }}
          placeholder="000000"
        />
      </div>
      <button className="btn btn-block" type="submit" disabled={pending || code.length !== 6}>
        {pending ? "Validando…" : "Validar"}
      </button>

      {result !== null && (
        <div className={`alert ${result.ok ? "" : "alert-error"} rise`} role={result.ok ? "status" : "alert"} style={{ marginTop: 16 }}>
          {result.ok ? (
            <>
              <span aria-hidden="true">✅</span>
              <span>
                <strong>{result.data.benefit}</strong>
                <br />
                {result.data.rewardTitle}
                <br />
                <span className="muted small">
                  {result.data.visitorName} · Nível {TIER_NAMES[result.data.visitorTier]} · validado às{" "}
                  {formatTime(result.data.redeemedAt)}
                </span>
              </span>
            </>
          ) : (
            <>
              <span aria-hidden="true">⛔</span>
              <span>{result.message}</span>
            </>
          )}
        </div>
      )}
    </form>
  );
}
