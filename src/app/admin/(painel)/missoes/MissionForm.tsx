"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createMission } from "@/app/actions";
import { CreateMissionInput, STORE_CATEGORIES, type MissionKind, type StoreCategory } from "@/domain/schemas";
import { CATEGORY_NAMES, MISSION_KIND_LABELS } from "@/ui/labels";
import { formText } from "@/ui/form";

type Option = { id: string; label: string };

/** `datetime-local` usa o horário do navegador, sem fuso no texto. */
const toLocalInput = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const KINDS = ["qr_scan", "visit_streak", "event_checkin", "purchase_category", "purchase"] as const satisfies readonly MissionKind[];

const isKind = (v: string): v is MissionKind => KINDS.some((k) => k === v);
const isCategory = (v: string): v is StoreCategory => STORE_CATEGORIES.some((c) => c === v);

export function MissionForm({
  checkpoints,
  stores,
  nowIso,
}: {
  checkpoints: Option[];
  stores: Array<{ id: string; name: string }>;
  nowIso: string;
}) {
  const router = useRouter();
  const now = new Date(nowIso);
  const [kind, setKind] = useState<MissionKind>("purchase_category");
  const [flash, setFlash] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const err = (path: string) =>
    errors[path] === undefined ? null : (
      <small role="alert" style={{ color: "var(--color-text)" }}>
        ⚠️ {errors[path]}
      </small>
    );

  const buildRequirement = (data: FormData): unknown => {
    switch (kind) {
      case "qr_scan":
        return { kind, checkpointIds: data.getAll("checkpointIds").map(String), ordered: data.get("ordered") === "on" };
      case "visit_streak":
        return { kind, days: Number(data.get("days")) };
      case "event_checkin":
        return { kind, checkpointId: formText(data, "eventCheckpoint"), eventName: formText(data, "eventName") };
      case "purchase_category":
        return { kind, category: formText(data, "category") };
      case "purchase":
        return {
          kind,
          storeId: formText(data, "storeId"),
          minAmountCents: Math.round(Number((formText(data, "minAmount") || "0").replace(",", ".")) * 100),
        };
    }
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const storeId = formText(data, "sponsor");
        // O mesmo schema do servidor valida aqui, para o admin ver o erro na hora.
        const parsed = CreateMissionInput.safeParse({
          title: formText(data, "title"),
          description: formText(data, "description"),
          requirement: buildRequirement(data),
          pointsReward: Number(data.get("pointsReward")),
          startsAt: new Date(formText(data, "startsAt")),
          endsAt: new Date(formText(data, "endsAt")),
          maxCompletionsPerUser: Number(data.get("maxCompletionsPerUser")),
          storeId: storeId === "" ? null : storeId,
          launch: flash
            ? {
                type: "flash",
                pushTitle: formText(data, "pushTitle"),
                pushBody: formText(data, "pushBody"),
                pointsMultiplier: Number(data.get("pointsMultiplier")),
              }
            : { type: "scheduled" },
        });
        if (!parsed.success) {
          const next: Record<string, string> = {};
          for (const issue of parsed.error.issues) {
            const key = issue.path.map(String).join(".");
            next[key] ??= issue.message;
          }
          setErrors(next);
          setDone(null);
          return;
        }
        setErrors({});
        startTransition(async () => {
          const result = await createMission(parsed.data);
          if (result.ok) {
            setDone(parsed.data.title);
            form.reset();
            router.refresh();
          } else {
            setErrors({ form: result.message });
          }
        });
      }}
    >
      {done !== null && (
        <div className="alert" role="status">
          <span aria-hidden="true">✅</span>
          <span>
            Missão “{done}” criada.{flash ? " O card de Missão Relâmpago já aparece no início do app." : ""}
          </span>
        </div>
      )}
      {errors.form !== undefined && (
        <div className="alert alert-error" role="alert">
          <span aria-hidden="true">⚠️</span>
          <span>{errors.form}</span>
        </div>
      )}

      <div className="field">
        <label htmlFor="title">Título</label>
        <input id="title" name="title" className="input" maxLength={60} placeholder="Relâmpago da moda" />
        {err("title")}
      </div>
      <div className="field">
        <label htmlFor="description">Descrição</label>
        <textarea id="description" name="description" className="textarea" maxLength={280} />
        {err("description")}
      </div>

      <div className="field">
        <label htmlFor="kind">Tipo</label>
        <select
          id="kind"
          className="select"
          value={kind}
          onChange={(e) => {
            if (isKind(e.target.value)) setKind(e.target.value);
          }}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {MISSION_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </div>

      {kind === "qr_scan" && (
        <fieldset className="field" style={{ border: 0, padding: 0 }}>
          <legend>Pontos com QR (na ordem em que aparecem)</legend>
          <div className="stack" style={{ gap: 4, maxHeight: 220, overflowY: "auto" }}>
            {checkpoints.map((c) => (
              <label key={c.id} className="check" style={{ marginBottom: 0 }}>
                <input type="checkbox" name="checkpointIds" value={c.id} />
                <span>{c.label}</span>
              </label>
            ))}
          </div>
          <label className="check" style={{ marginTop: 8 }}>
            <input type="checkbox" name="ordered" />
            <span>Em ordem (caça ao tesouro)</span>
          </label>
          {err("requirement.checkpointIds")}
        </fieldset>
      )}
      {kind === "visit_streak" && (
        <div className="field">
          <label htmlFor="days">Dias seguidos</label>
          <input id="days" name="days" type="number" className="input" min={2} max={30} defaultValue={3} />
          {err("requirement.days")}
        </div>
      )}
      {kind === "event_checkin" && (
        <>
          <div className="field">
            <label htmlFor="eventName">Nome do evento</label>
            <input id="eventName" name="eventName" className="input" />
            {err("requirement.eventName")}
          </div>
          <div className="field">
            <label htmlFor="eventCheckpoint">QR do evento</label>
            <select id="eventCheckpoint" name="eventCheckpoint" className="select">
              {checkpoints.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </>
      )}
      {kind === "purchase_category" && (
        <div className="field">
          <label htmlFor="category">Categoria da compra</label>
          <select id="category" name="category" className="select" defaultValue="vestuario">
            {STORE_CATEGORIES.filter(isCategory).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_NAMES[c]}
              </option>
            ))}
          </select>
          <small>Validada pelo QR do cupom fiscal: vale qualquer loja do shopping dessa categoria.</small>
        </div>
      )}
      {kind === "purchase" && (
        <>
          <div className="field">
            <label htmlFor="storeId">Loja</label>
            <select id="storeId" name="storeId" className="select">
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="minAmount">Valor mínimo (R$)</label>
            <input id="minAmount" name="minAmount" className="input" inputMode="decimal" defaultValue="50" />
            {err("requirement.minAmountCents")}
          </div>
        </>
      )}

      <div className="row" style={{ gap: 12 }}>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="pointsReward">Pontos</label>
          <input id="pointsReward" name="pointsReward" type="number" className="input" min={1} defaultValue={200} />
          {err("pointsReward")}
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="maxCompletionsPerUser">Máx. por visitante</label>
          <input id="maxCompletionsPerUser" name="maxCompletionsPerUser" type="number" className="input" min={1} defaultValue={1} />
        </div>
      </div>

      <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
        <div className="field" style={{ flex: 1, minWidth: 180 }}>
          <label htmlFor="startsAt">Início</label>
          <input id="startsAt" name="startsAt" type="datetime-local" className="input" defaultValue={toLocalInput(now)} />
        </div>
        <div className="field" style={{ flex: 1, minWidth: 180 }}>
          <label htmlFor="endsAt">Fim</label>
          <input
            id="endsAt"
            name="endsAt"
            type="datetime-local"
            className="input"
            defaultValue={toLocalInput(new Date(now.getTime() + 2 * 60 * 60 * 1000))}
          />
          {err("endsAt")}
        </div>
      </div>

      <div className="field">
        <label htmlFor="sponsor">Loja patrocinadora (opcional)</label>
        <select id="sponsor" name="sponsor" className="select" defaultValue="">
          <option value="">Missão do shopping</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <label className="check">
        <input
          type="checkbox"
          checked={flash}
          onChange={(e) => {
            setFlash(e.target.checked);
          }}
        />
        <span>
          <strong>⚡ Lançar como Missão Relâmpago</strong>
          <br />
          <span className="muted small">Aparece em destaque com contagem regressiva e pontos multiplicados.</span>
        </span>
      </label>

      {flash && (
        <>
          <div className="field">
            <label htmlFor="pushTitle">Título do aviso</label>
            <input id="pushTitle" name="pushTitle" className="input" maxLength={50} defaultValue="MISSÃO RELÂMPAGO!" />
            {err("launch.pushTitle")}
          </div>
          <div className="field">
            <label htmlFor="pushBody">Texto do aviso</label>
            <input id="pushBody" name="pushBody" className="input" maxLength={120} placeholder="Compre uma peça de roupa até as 18h e ganhe pontos em dobro" />
            {err("launch.pushBody")}
          </div>
          <div className="field">
            <label htmlFor="pointsMultiplier">Multiplicador de pontos</label>
            <select id="pointsMultiplier" name="pointsMultiplier" className="select" defaultValue="2">
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  ×{n}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <button className="btn btn-block" type="submit" disabled={pending}>
        {pending ? "Criando…" : flash ? "Lançar Missão Relâmpago" : "Criar missão"}
      </button>
    </form>
  );
}
