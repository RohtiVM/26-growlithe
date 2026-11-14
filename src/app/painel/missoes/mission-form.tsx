"use client";

import { useActionState, useState, type ReactNode } from "react";
import { AlertTriangle, Zap } from "lucide-react";
import { CATEGORY_LABELS, STORE_CATEGORIES } from "@/domain/schemas";
import {
  MISSION_FORM_KINDS,
  MISSION_FORM_KIND_LABELS,
  type MissionFieldErrors,
  type MissionFormField,
  type MissionFormKind,
} from "@/painel/missions";
import { createMissionAction, type CreateMissionState } from "./actions";
import styles from "./missoes.module.css";

const initial: CreateMissionState = { status: "idle" };

type Option = { id: string; label: string };
type Defaults = { startsAt: string; endsAt: string };

const isKind = (v: string): v is MissionFormKind => MISSION_FORM_KINDS.some((k) => k === v);

/** Mensagem de erro do campo, com ícone e texto (RNF09: não só cor). */
function FieldError({ field, errors }: { field: MissionFormField; errors: MissionFieldErrors }) {
  const message = errors[field];
  if (message === undefined) return null;
  return (
    <p id={`${field}-erro`} className="field-error" role="alert">
      <AlertTriangle size={18} aria-hidden style={{ flex: "none", marginTop: 2 }} />
      {message}
    </p>
  );
}

function Group({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.group}>
      <h3 className={styles["group-title"]}>{title}</h3>
      {children}
    </div>
  );
}

/** Formulário A3 (UC3, UC5). Os campos do requisito mudam conforme o tipo (critério 8). */
export function MissionForm({ checkpoints, defaults }: { checkpoints: readonly Option[]; defaults: Defaults }) {
  const [state, action, pending] = useActionState(createMissionAction, initial);
  const [kind, setKind] = useState<MissionFormKind>("qr_scan");
  const [launchType, setLaunchType] = useState<"scheduled" | "flash">("scheduled");

  const errors: MissionFieldErrors = state.status === "error" ? state.fieldErrors : {};
  const values = state.status === "error" ? state.values : {};
  const checked = new Set(values.checkpointIds ?? []);

  /** Liga o campo à mensagem de erro dele para leitores de tela. */
  const a11y = (field: MissionFormField) => ({
    "aria-invalid": errors[field] !== undefined,
    "aria-describedby": errors[field] !== undefined ? `${field}-erro` : undefined,
  });

  return (
    <form action={action} className={`form card ${styles["form-card"]}`} noValidate>
      <h2 style={{ margin: 0, fontSize: "1.25rem" }}>Nova missão</h2>

      <label htmlFor="title">Título</label>
      <input
        id="title"
        name="title"
        required
        maxLength={60}
        placeholder="Ex.: Caça ao tesouro de Natal"
        defaultValue={values.title ?? ""}
        {...a11y("title")}
      />
      <FieldError field="title" errors={errors} />

      <label htmlFor="description">Descrição</label>
      <textarea
        id="description"
        name="description"
        className={styles.textarea}
        maxLength={280}
        placeholder="O que o visitante precisa fazer, em uma ou duas frases."
        defaultValue={values.description ?? ""}
        {...a11y("description")}
      />
      <FieldError field="description" errors={errors} />

      <fieldset className={styles.fieldset}>
        <legend>Tipo</legend>
        <div className={styles.choices}>
          {MISSION_FORM_KINDS.map((k) => (
            <label key={k} className={styles.choice}>
              <input
                type="radio"
                name="kind"
                value={k}
                checked={kind === k}
                onChange={(e) => {
                  if (isKind(e.target.value)) setKind(e.target.value);
                }}
              />
              {MISSION_FORM_KIND_LABELS[k]}
            </label>
          ))}
        </div>
        <FieldError field="kind" errors={errors} />
      </fieldset>

      {kind === "qr_scan" && (
        <Group title="Campos do tipo QR Code">
          {checkpoints.length === 0 ? (
            <p className="alert" role="status">
              Nenhum checkpoint cadastrado. <a href="/painel/checkpoints">Cadastre um checkpoint</a> antes de criar a
              missão.
            </p>
          ) : (
            <fieldset className={styles.fieldset} aria-describedby={errors.checkpointIds ? "checkpointIds-erro" : undefined}>
              <legend>Checkpoints</legend>
              <p className={styles.hint}>Um checkpoint = missão simples. Vários = caça ao tesouro.</p>
              {checkpoints.map((cp) => (
                <label key={cp.id} className={styles.choice}>
                  <input type="checkbox" name="checkpointIds" value={cp.id} defaultChecked={checked.has(cp.id)} />
                  {cp.label}
                </label>
              ))}
            </fieldset>
          )}
          <FieldError field="checkpointIds" errors={errors} />
          <fieldset className={styles.fieldset}>
            <legend>Em ordem?</legend>
            <label className={styles.choice}>
              <input type="checkbox" name="ordered" defaultChecked={values.ordered === "on"} />
              Sim, é uma caça ao tesouro: os QR Codes valem na ordem da lista
            </label>
          </fieldset>
        </Group>
      )}

      {kind === "visit_streak" && (
        <Group title="Campos do tipo Sequência de visitas">
          <label htmlFor="days">Dias seguidos</label>
          <input
            id="days"
            name="days"
            type="number"
            inputMode="numeric"
            min={2}
            max={30}
            defaultValue={values.days ?? "3"}
            {...a11y("days")}
          />
          <FieldError field="days" errors={errors} />
        </Group>
      )}

      {kind === "event_checkin" && (
        <Group title="Campos do tipo Evento">
          <label htmlFor="eventName">Nome do evento</label>
          <input
            id="eventName"
            name="eventName"
            maxLength={60}
            placeholder="Ex.: Show de Natal"
            defaultValue={values.eventName ?? ""}
            {...a11y("eventName")}
          />
          <FieldError field="eventName" errors={errors} />
          <label htmlFor="checkpointId">Checkpoint do evento</label>
          <select id="checkpointId" name="checkpointId" defaultValue={values.checkpointId ?? ""} {...a11y("checkpointId")}>
            <option value="">Escolha onde o visitante faz check-in</option>
            {checkpoints.map((cp) => (
              <option key={cp.id} value={cp.id}>
                {cp.label}
              </option>
            ))}
          </select>
          <FieldError field="checkpointId" errors={errors} />
        </Group>
      )}

      {kind === "purchase_category" && (
        <Group title="Campos do tipo Compra por categoria">
          <label htmlFor="category">O visitante compra</label>
          <select id="category" name="category" defaultValue={values.category ?? ""} {...a11y("category")}>
            <option value="">Escolha a categoria</option>
            {STORE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <p className={styles.hint}>Vale em qualquer loja do shopping: o visitante escaneia o cupom fiscal.</p>
          <FieldError field="category" errors={errors} />
        </Group>
      )}

      <fieldset className={styles.fieldset}>
        <legend>Lançamento</legend>
        <div className={styles.choices}>
          <label className={styles.choice}>
            <input
              type="radio"
              name="launchType"
              value="scheduled"
              checked={launchType === "scheduled"}
              onChange={() => {
                setLaunchType("scheduled");
              }}
            />
            Semanal
          </label>
          <label className={styles.choice}>
            <input
              type="radio"
              name="launchType"
              value="flash"
              checked={launchType === "flash"}
              onChange={() => {
                setLaunchType("flash");
              }}
            />
            <Zap size={16} aria-hidden /> Relâmpago (push)
          </label>
        </div>
        <FieldError field="launchType" errors={errors} />
      </fieldset>

      {launchType === "flash" && (
        <Group
          title={
            <>
              <Zap size={16} aria-hidden /> Missão Relâmpago
            </>
          }
        >
          <label htmlFor="pushTitle">Título do push</label>
          <input
            id="pushTitle"
            name="pushTitle"
            maxLength={50}
            placeholder="Ex.: Pontos em dobro agora!"
            defaultValue={values.pushTitle ?? ""}
            {...a11y("pushTitle")}
          />
          <FieldError field="pushTitle" errors={errors} />
          <label htmlFor="pushBody">Texto do push</label>
          <input
            id="pushBody"
            name="pushBody"
            maxLength={120}
            placeholder="Ex.: Escaneie o QR da praça de alimentação até as 15h."
            defaultValue={values.pushBody ?? ""}
            {...a11y("pushBody")}
          />
          <FieldError field="pushBody" errors={errors} />
          <label htmlFor="pointsMultiplier">Multiplicador de pontos</label>
          <select
            id="pointsMultiplier"
            name="pointsMultiplier"
            defaultValue={values.pointsMultiplier ?? "2"}
            {...a11y("pointsMultiplier")}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={String(n)}>
                {n === 1 ? "Sem multiplicador (×1)" : `×${n}`}
              </option>
            ))}
          </select>
          <FieldError field="pointsMultiplier" errors={errors} />
        </Group>
      )}

      <label htmlFor="pointsReward">Pontos</label>
      <input
        id="pointsReward"
        name="pointsReward"
        type="number"
        inputMode="numeric"
        min={1}
        defaultValue={values.pointsReward ?? "150"}
        {...a11y("pointsReward")}
      />
      <FieldError field="pointsReward" errors={errors} />

      <div className={styles.row}>
        <div className={styles.cell}>
          <label htmlFor="startsAt">Início</label>
          <input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            defaultValue={values.startsAt ?? defaults.startsAt}
            {...a11y("startsAt")}
          />
          <FieldError field="startsAt" errors={errors} />
        </div>
        <div className={styles.cell}>
          <label htmlFor="endsAt">Fim</label>
          <input
            id="endsAt"
            name="endsAt"
            type="datetime-local"
            defaultValue={values.endsAt ?? defaults.endsAt}
            {...a11y("endsAt")}
          />
          <FieldError field="endsAt" errors={errors} />
        </div>
      </div>
      <p className={styles.hint}>Horário de Palmas.</p>

      <label htmlFor="maxCompletionsPerUser">Máximo por visitante</label>
      <input
        id="maxCompletionsPerUser"
        name="maxCompletionsPerUser"
        type="number"
        inputMode="numeric"
        min={1}
        defaultValue={values.maxCompletionsPerUser ?? "1"}
        {...a11y("maxCompletionsPerUser")}
      />
      <FieldError field="maxCompletionsPerUser" errors={errors} />

      {state.status === "error" && (
        <p className="field-error" role="alert">
          <AlertTriangle size={18} aria-hidden style={{ flex: "none", marginTop: 2 }} />
          {state.message}
        </p>
      )}

      <button className="btn btn-block" type="submit" disabled={pending}>
        {pending ? "Criando…" : "Criar missão"}
      </button>
    </form>
  );
}
