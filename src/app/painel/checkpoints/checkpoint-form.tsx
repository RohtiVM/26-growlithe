"use client";

import { useActionState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { createCheckpointAction, type CreateCheckpointState } from "./actions";

const initial: CreateCheckpointState = { status: "idle" };

export function CheckpointForm({ stores }: { stores: ReadonlyArray<{ id: string; name: string }> }) {
  const [state, action, pending] = useActionState(createCheckpointAction, initial);

  return (
    <form action={action} className="form card" noValidate>
      <h2 style={{ margin: 0, fontSize: "1.25rem" }}>Novo checkpoint</h2>

      <label htmlFor="label">Nome do ponto</label>
      <input
        id="label"
        name="label"
        required
        maxLength={60}
        placeholder="Ex.: Entrada Norte"
        aria-invalid={state.status === "error"}
        aria-describedby={state.status === "error" ? "checkpoint-erro" : undefined}
      />

      <label htmlFor="storeId">Onde fica</label>
      <select id="storeId" name="storeId" defaultValue="">
        <option value="">Área do shopping (entrada, praça, palco)</option>
        {stores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      {state.status === "error" && (
        <p id="checkpoint-erro" className="field-error" role="alert">
          <AlertTriangle size={18} aria-hidden style={{ flex: "none", marginTop: 2 }} />
          {state.message}
        </p>
      )}
      {state.status === "created" && (
        <p className="alert" role="status">
          <CheckCircle2 size={18} aria-hidden style={{ flex: "none", marginTop: 2 }} />
          “{state.label}” criado. Abra o QR na lista para imprimir.
        </p>
      )}

      <button className="btn btn-block" type="submit" disabled={pending}>
        {pending ? "Criando…" : "Criar checkpoint"}
      </button>
    </form>
  );
}
