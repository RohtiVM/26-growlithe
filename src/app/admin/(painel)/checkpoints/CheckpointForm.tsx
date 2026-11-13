"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createCheckpoint } from "@/app/actions";
import { CHECKPOINT_KINDS, CHECKPOINT_KIND_LABELS, CreateCheckpointInput } from "@/domain/schemas";
import { formText } from "@/ui/form";

export function CheckpointForm({ stores }: { stores: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const storeId = formText(data, "storeId");
        const hint = formText(data, "hint").trim();
        const parsed = CreateCheckpointInput.safeParse({
          label: formText(data, "label").trim(),
          kind: formText(data, "kind"),
          storeId: storeId === "" ? null : storeId,
          scanPoints: Number(data.get("scanPoints")),
          hint: hint === "" ? null : hint,
        });
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? "Confira os campos");
          return;
        }
        setError(null);
        startTransition(async () => {
          const result = await createCheckpoint(parsed.data);
          if (result.ok) {
            form.reset();
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
        <label htmlFor="label">Nome do ponto</label>
        <input id="label" name="label" className="input" placeholder="Burger X — balcão" maxLength={80} />
      </div>
      <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
        <div className="field" style={{ flex: 1, minWidth: 160 }}>
          <label htmlFor="kind">Tipo</label>
          <select id="kind" name="kind" className="select" defaultValue="store">
            {CHECKPOINT_KINDS.map((k) => (
              <option key={k} value={k}>
                {CHECKPOINT_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: 1, minWidth: 120 }}>
          <label htmlFor="scanPoints">Pontos por scan</label>
          <input id="scanPoints" name="scanPoints" type="number" className="input" min={0} max={500} defaultValue={20} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="storeId">Loja (opcional)</label>
        <select id="storeId" name="storeId" className="select" defaultValue="">
          <option value="">Ponto do shopping</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="hint">Pista para a caça ao tesouro (opcional)</label>
        <input id="hint" name="hint" className="input" maxLength={140} />
      </div>
      <button className="btn btn-block" type="submit" disabled={pending}>
        {pending ? "Criando…" : "Criar ponto e gerar QR"}
      </button>
    </form>
  );
}
