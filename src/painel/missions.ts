/**
 * Missões no painel (spec 003, ticket T6). Regras puras: o servidor injeta o
 * acesso de quem chamou, o relógio e as funções que falam com o banco.
 */
import { z } from "zod";
import {
  CreateMissionInput,
  EndMissionInput,
  MISSION_ADMIN_MESSAGES,
  MissionRow,
  assertNever,
  type Mission,
  type MissionAdminError,
  type MissionKind,
  type MissionLaunch,
  type MissionRequirement,
  type PainelAccess,
  type PainelAuthError,
  type Result,
} from "@/domain/schemas";
import { requireStaffRole } from "./access";

/**
 * Palmas (TO) fica em UTC−3 o ano todo, sem horário de verão. O `datetime-local`
 * do formulário não tem fuso, então lemos a hora como hora do shopping.
 */
export const MALL_UTC_OFFSET = "-03:00";
export const MALL_TIME_ZONE = "America/Araguaina";

/** Tipos oferecidos no formulário do MVP. `purchase` (loja + valor mínimo) fica para depois. */
export const MISSION_FORM_KINDS = [
  "qr_scan",
  "visit_streak",
  "event_checkin",
  "purchase_category",
] as const satisfies readonly MissionKind[];
export type MissionFormKind = (typeof MISSION_FORM_KINDS)[number];

export const MISSION_FORM_KIND_LABELS = {
  qr_scan: "QR Code",
  visit_streak: "Sequência de visitas",
  event_checkin: "Evento",
  purchase_category: "Compra por categoria",
} as const satisfies Record<MissionFormKind, string>;

const LAUNCH_TYPES = ["scheduled", "flash"] as const satisfies readonly MissionLaunch["type"][];

/** Campo do FormData: qualquer coisa que não seja texto vira vazio. */
const text = z.unknown().transform((v) => (typeof v === "string" ? v.trim() : ""));
const textList = z
  .unknown()
  .transform((v) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []));

/** O que a Server Action lê do formulário A3, campo a campo, antes de virar `CreateMissionInput`. */
const MissionForm = z.object({
  title: text,
  description: text,
  kind: text,
  checkpointIds: textList,
  ordered: text,
  days: text,
  checkpointId: text,
  eventName: text,
  category: text,
  launchType: text,
  pushTitle: text,
  pushBody: text,
  pointsMultiplier: text,
  pointsReward: text,
  startsAt: text,
  endsAt: text,
  maxCompletionsPerUser: text,
});
export type MissionFormField = keyof z.infer<typeof MissionForm>;
export type MissionFieldErrors = Partial<Record<MissionFormField, string>>;

/** Mensagem de cada campo, dizendo o que fazer. Refinamentos (`custom`) usam a mensagem do schema. */
const FIELD_HINTS = {
  title: "Dê um título de 3 a 60 caracteres.",
  description: "Use até 280 caracteres na descrição.",
  kind: "Escolha o tipo da missão.",
  checkpointIds: "Escolha pelo menos um checkpoint.",
  ordered: "Marque ou desmarque “Em ordem?”.",
  days: "Informe de 2 a 30 dias seguidos.",
  checkpointId: "Escolha o checkpoint do evento.",
  eventName: "Dê um nome ao evento, com pelo menos 3 caracteres.",
  category: "Escolha a categoria da compra.",
  launchType: "Escolha como a missão é lançada.",
  pushTitle: "Escreva o título do push, de 3 a 50 caracteres.",
  pushBody: "Escreva o texto do push, de 3 a 120 caracteres.",
  pointsMultiplier: "Escolha um multiplicador de 1 a 5.",
  pointsReward: "Informe os pontos da missão: um número inteiro maior que zero.",
  startsAt: "Informe a data e a hora de início.",
  endsAt: "Informe a data e a hora do fim.",
  maxCompletionsPerUser: "Informe quantas vezes cada visitante pode cumprir: 1 ou mais.",
} as const satisfies Record<MissionFormField, string>;

const isFormField = (key: string): key is MissionFormField => Object.hasOwn(FIELD_HINTS, key);

export type CreateMissionResult =
  | { ok: true; data: Mission }
  | { ok: false; error: PainelAuthError | MissionAdminError; message: string }
  | { ok: false; error: "invalid_input"; message: string; fieldErrors: MissionFieldErrors };

/** Resposta mínima do cliente Supabase que nos interessa. */
type DbResult = { data: unknown; error: { code?: string } | null };

export type InsertMission = (values: {
  title: string;
  description: string;
  requirement: MissionRequirement;
  points_reward: number;
  starts_at: string;
  ends_at: string;
  max_completions_per_user: number;
  store_id: string | null;
  launch: MissionLaunch;
  created_by: string;
}) => Promise<DbResult>;

/** Faz `ends_at = now` só se a missão estiver ativa; devolve a linha ou `null`. */
export type EndMissionInDb = (values: { id: string; now: string }) => Promise<DbResult>;

/** Violação de CHECK no Postgres (`missions_period`: fim depois do início). */
const CHECK_VIOLATION = "23514";

export const missionFromRow = (row: unknown): Mission => MissionRow.parse(row);

const fail = (error: MissionAdminError): { ok: false; error: MissionAdminError; message: string } => ({
  ok: false,
  error,
  message: MISSION_ADMIN_MESSAGES[error],
});

const invalid = (fieldErrors: MissionFieldErrors): CreateMissionResult => ({
  ok: false,
  error: "invalid_input",
  message: "Confira os campos destacados.",
  fieldErrors,
});

const toNumber = (s: string): number | undefined => (s === "" ? undefined : Number(s));

const toMallDate = (s: string): Date | undefined =>
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) ? new Date(`${s}:00${MALL_UTC_OFFSET}`) : undefined;

/** Monta o requisito só com os campos do tipo escolhido (critério 8). */
const requirementFrom = (kind: MissionFormKind, f: z.infer<typeof MissionForm>) => {
  switch (kind) {
    case "qr_scan":
      return { kind, checkpointIds: f.checkpointIds, ordered: f.ordered !== "" };
    case "visit_streak":
      return { kind, days: toNumber(f.days) };
    case "event_checkin":
      return { kind, checkpointId: f.checkpointId, eventName: f.eventName };
    case "purchase_category":
      return { kind, category: f.category };
    default:
      return assertNever(kind);
  }
};

const launchFrom = (type: (typeof LAUNCH_TYPES)[number], f: z.infer<typeof MissionForm>) => {
  switch (type) {
    case "scheduled":
      return { type };
    case "flash":
      return { type, pushTitle: f.pushTitle, pushBody: f.pushBody, pointsMultiplier: toNumber(f.pointsMultiplier) };
    default:
      return assertNever(type);
  }
};

/** Caminho do erro no `CreateMissionInput` → nome do campo no formulário. */
const fieldOf = (path: readonly PropertyKey[]): string => {
  const [head, sub] = path.map(String);
  if (head === "requirement") return sub ?? "kind";
  if (head === "launch") return sub === undefined || sub === "type" ? "launchType" : sub;
  return head ?? "";
};

/** UC3 + UC5. Critério 3: o papel é conferido antes de ler ou gravar qualquer coisa. */
export const createMission = async (
  access: PainelAccess,
  raw: unknown,
  insert: InsertMission,
): Promise<CreateMissionResult> => {
  const allowed = requireStaffRole(access, ["admin"]);
  if (!allowed.ok) return allowed;

  const form = MissionForm.safeParse(raw);
  if (!form.success) return invalid({});
  const f = form.data;

  const kind = z.enum(MISSION_FORM_KINDS).safeParse(f.kind);
  const launchType = z.enum(LAUNCH_TYPES).safeParse(f.launchType);
  if (!kind.success || !launchType.success) {
    return invalid({
      ...(kind.success ? {} : { kind: FIELD_HINTS.kind }),
      ...(launchType.success ? {} : { launchType: FIELD_HINTS.launchType }),
    });
  }

  const parsed = CreateMissionInput.safeParse({
    title: f.title,
    description: f.description,
    requirement: requirementFrom(kind.data, f),
    pointsReward: toNumber(f.pointsReward),
    startsAt: toMallDate(f.startsAt),
    endsAt: toMallDate(f.endsAt),
    maxCompletionsPerUser: toNumber(f.maxCompletionsPerUser),
    storeId: null,
    launch: launchFrom(launchType.data, f),
  });
  if (!parsed.success) {
    const fieldErrors: MissionFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const field = fieldOf(issue.path);
      if (!isFormField(field) || fieldErrors[field] !== undefined) continue;
      fieldErrors[field] = issue.code === "custom" ? issue.message : FIELD_HINTS[field];
    }
    return invalid(fieldErrors);
  }

  const m = parsed.data;
  const { data, error } = await insert({
    title: m.title,
    description: m.description,
    requirement: m.requirement,
    points_reward: m.pointsReward,
    starts_at: m.startsAt.toISOString(),
    ends_at: m.endsAt.toISOString(),
    max_completions_per_user: m.maxCompletionsPerUser,
    store_id: m.storeId,
    launch: m.launch,
    created_by: allowed.data.userId,
  });
  if (error !== null) return fail("save_failed");

  const row = MissionRow.safeParse(data);
  return row.success ? { ok: true, data: row.data } : fail("save_failed");
};

/**
 * UC4 / critério 12: encerrar = o fim vira agora. Só vale para missão ativa:
 * missão futura não pode ser encerrada (o fim ficaria antes do início) e
 * missão já encerrada não muda. O banco aplica a mesma regra no `where` e no CHECK.
 */
export const endMission = async (
  access: PainelAccess,
  raw: unknown,
  now: Date,
  end: EndMissionInDb,
): Promise<Result<Mission, PainelAuthError | MissionAdminError | "invalid_input">> => {
  const allowed = requireStaffRole(access, ["admin"]);
  if (!allowed.ok) return allowed;

  const parsed = EndMissionInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input", message: "Missão inválida. Recarregue a página." };

  const { data, error } = await end({ id: parsed.data.missionId, now: now.toISOString() });
  if (error !== null) return fail(error.code === CHECK_VIOLATION ? "mission_not_active" : "save_failed");
  if (data === null) return fail("mission_not_active");

  const row = MissionRow.safeParse(data);
  return row.success ? { ok: true, data: row.data } : fail("save_failed");
};

const mallDateTime = new Intl.DateTimeFormat("pt-BR", {
  timeZone: MALL_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** "14/11, 10:00 – 20/11, 22:00", sempre no horário do shopping. */
export const formatMissionPeriod = (m: Pick<Mission, "startsAt" | "endsAt">): string =>
  `${mallDateTime.format(m.startsAt)} – ${mallDateTime.format(m.endsAt)}`;

/** Valor para `<input type="datetime-local">` no horário do shopping. */
export const toMallInputValue = (d: Date): string => {
  const local = new Date(d.getTime() + Number(MALL_UTC_OFFSET.slice(0, 3)) * 60 * 60 * 1000);
  return local.toISOString().slice(0, 16);
};
