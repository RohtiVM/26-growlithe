/**
 * Banco em memória — adaptador do MVP enquanto o Supabase não está conectado.
 *
 * - Toda leitura+escrita de uma operação acontece sem `await` no meio, então
 *   é atômica dentro da instância (o JavaScript roda uma coisa por vez). É o
 *   mesmo papel que a transação/`UNIQUE` faz no Postgres (supabase/migrations).
 * - Os dados voltam ao seed quando o servidor reinicia. Os IDs do seed são
 *   fixos, então os QR Codes impressos continuam válidos.
 */
import type { ProgressRecord } from "@/domain/game";
import {
  Checkpoint,
  Mission,
  Reward,
  Store,
  User,
  type CheckpointId,
  type LandingLead,
  type MissionId,
  type Redemption,
  type StoreId,
  type UserId,
} from "@/domain/schemas";
import { localDay } from "@/domain/time";

export type ScanRecord = { userId: UserId; checkpointId: CheckpointId; day: string; at: Date };

export const LEDGER_REASONS = [
  "checkpoint_scan",
  "mission_completed",
  "receipt",
  "redemption",
  "redemption_refund",
] as const;
export type LedgerReason = (typeof LEDGER_REASONS)[number];

export type LedgerEntry = {
  userId: UserId;
  delta: number;
  reason: LedgerReason;
  refId: string;
  at: Date;
};

export type ReceiptRecord = {
  accessKeyHash: string;
  userId: UserId;
  storeId: StoreId;
  missionId: MissionId;
  scannedAt: Date;
  verifiedBy: "local" | "sefaz";
};

export type Db = {
  users: User[];
  stores: Store[];
  checkpoints: Checkpoint[];
  missions: Mission[];
  progress: ProgressRecord[];
  scans: ScanRecord[];
  ledger: LedgerEntry[];
  receipts: ReceiptRecord[];
  rewards: Reward[];
  redemptions: Redemption[];
  leads: LandingLead[];
};

/* ------------------------------------------------------------------ */
/* Seed — um shopping de exemplo em Palmas (TO)                        */
/* ------------------------------------------------------------------ */

const id = (prefix: string, n: number): string =>
  `${prefix}-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const SEED_IDS = {
  marina: id("00000001", 1),
  store: (n: number) => id("00000002", n),
  checkpoint: (n: number) => id("00000003", n),
  mission: (n: number) => id("00000004", n),
  reward: (n: number) => id("00000005", n),
} as const;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const createSeedDb = (now: Date = new Date()): Db => {
  const s = SEED_IDS.store;
  const stores = [
    { id: s(1), name: "Moda Center", cnpj: "12345678000195", category: "vestuario" },
    { id: s(2), name: "Estilo Jovem", cnpj: "11222333000181", category: "vestuario" },
    { id: s(3), name: "Passo Certo", cnpj: "22333444000172", category: "calcados" },
    { id: s(4), name: "Burger X", cnpj: "33444555000163", category: "alimentacao" },
    { id: s(5), name: "Café Capim Dourado", cnpj: "44555666000154", category: "alimentacao" },
    { id: s(6), name: "Livraria Jalapão", cnpj: "55666777000145", category: "livraria" },
    { id: s(7), name: "Tech Point", cnpj: "66777888000136", category: "eletronicos" },
    { id: s(8), name: "Bela Pele", cnpj: "77888999000127", category: "beleza" },
  ].map((store) => Store.parse({ ...store, active: true }));

  const c = SEED_IDS.checkpoint;
  const checkpoints = [
    { id: c(1), label: "Entrada Norte", kind: "entrance", storeId: null, scanPoints: 10, hint: null },
    { id: c(2), label: "Entrada Sul", kind: "entrance", storeId: null, scanPoints: 10, hint: null },
    { id: c(3), label: "Burger X — balcão", kind: "store", storeId: s(4), scanPoints: 20, hint: null },
    { id: c(4), label: "Café Capim Dourado", kind: "store", storeId: s(5), scanPoints: 20, hint: null },
    { id: c(5), label: "Livraria Jalapão", kind: "store", storeId: s(6), scanPoints: 20, hint: null },
    { id: c(6), label: "Ala B · Pista 1", kind: "spot", storeId: null, scanPoints: 15, hint: "Comece onde se lê histórias: a vitrine da livraria." },
    { id: c(7), label: "Ala B · Pista 2", kind: "spot", storeId: null, scanPoints: 15, hint: "Agora procure o cheiro de café perto da escada rolante." },
    { id: c(8), label: "Ala B · Pista 3", kind: "spot", storeId: null, scanPoints: 15, hint: "Siga até onde os pés ganham tênis novos." },
    { id: c(9), label: "Ala B · Pista 4", kind: "spot", storeId: null, scanPoints: 15, hint: "Tecnologia brilha no fim do corredor. O QR está no balcão." },
    { id: c(10), label: "Ala B · Pista 5", kind: "spot", storeId: null, scanPoints: 15, hint: "Última pista: o jardim de capim dourado no centro da ala." },
    { id: c(11), label: "Palco Central", kind: "event", storeId: null, scanPoints: 30, hint: null },
  ].map((cp) => Checkpoint.parse({ ...cp, active: true }));

  const m = SEED_IDS.mission;
  const weekStart = new Date(now.getTime() - DAY);
  const weekEnd = new Date(now.getTime() + 7 * DAY);
  const base = { maxCompletionsPerUser: 1, storeId: null, createdAt: weekStart };
  const missions = [
    {
      ...base,
      id: m(1),
      title: "Caça ao tesouro da Ala B",
      description: "Siga as pistas e encontre os 5 QR Codes escondidos na Ala B, em ordem.",
      requirement: { kind: "qr_scan", checkpointIds: [c(6), c(7), c(8), c(9), c(10)], ordered: true },
      pointsReward: 150,
      startsAt: weekStart,
      endsAt: weekEnd,
      launch: { type: "scheduled" },
    },
    {
      ...base,
      id: m(2),
      title: "Volte 3 dias seguidos",
      description: "Escaneie qualquer QR Code do Growlithe no shopping em três dias seguidos.",
      requirement: { kind: "visit_streak", days: 3 },
      pointsReward: 200,
      startsAt: weekStart,
      endsAt: weekEnd,
      launch: { type: "scheduled" },
    },
    {
      ...base,
      id: m(3),
      title: "Café da manhã",
      description: "Passe no Café Capim Dourado e escaneie o QR do balcão.",
      requirement: { kind: "qr_scan", checkpointIds: [c(4)], ordered: false },
      pointsReward: 50,
      startsAt: weekStart,
      endsAt: weekEnd,
      storeId: s(5),
      launch: { type: "scheduled" },
    },
    {
      ...base,
      id: m(4),
      title: "Show de sábado",
      description: "Faça check-in no Palco Central durante o show.",
      requirement: { kind: "event_checkin", checkpointId: c(11), eventName: "Show de sábado" },
      pointsReward: 100,
      startsAt: weekStart,
      endsAt: weekEnd,
      launch: { type: "scheduled" },
    },
    {
      ...base,
      id: m(5),
      title: "Relâmpago da moda",
      description: "Compre uma peça de roupa em qualquer loja do shopping e escaneie o cupom fiscal.",
      requirement: { kind: "purchase_category", category: "vestuario" },
      pointsReward: 200,
      startsAt: new Date(now.getTime() - HOUR),
      endsAt: new Date(now.getTime() + 3 * HOUR),
      createdAt: new Date(now.getTime() - HOUR),
      launch: {
        type: "flash",
        pushTitle: "MISSÃO RELÂMPAGO!",
        pushBody: "Compre uma peça de roupa nas próximas 3 horas e ganhe pontos em dobro.",
        pointsMultiplier: 2,
      },
    },
  ].map((mission) => Mission.parse(mission));

  const r = SEED_IDS.reward;
  const rewards = [
    { id: r(1), title: "Estacionamento grátis", costPoints: 800, benefit: { kind: "free_parking", hours: 2 }, stock: null, minTier: "bronze" },
    { id: r(2), title: "Desconto no Burger X", costPoints: 500, benefit: { kind: "discount_percent", percent: 15, storeId: s(4) }, stock: 50, minTier: "bronze" },
    { id: r(3), title: "Café expresso grátis", costPoints: 300, benefit: { kind: "gift", description: "Um café expresso grátis", storeId: s(5) }, stock: 100, minTier: "bronze" },
    { id: r(4), title: "Vale-compras Moda Center", costPoints: 1200, benefit: { kind: "discount_fixed", amountCents: 2000, storeId: s(1) }, stock: 30, minTier: "prata" },
    { id: r(5), title: "Brinde exclusivo da Livraria", costPoints: 1500, benefit: { kind: "gift", description: "Ecobag + marcador exclusivos", storeId: s(6) }, stock: 10, minTier: "ouro" },
    { id: r(6), title: "Kit Diamante Tech Point", costPoints: 3000, benefit: { kind: "discount_percent", percent: 30, storeId: s(7) }, stock: 5, minTier: "diamante" },
  ].map((reward) => Reward.parse({ ...reward, active: true }));

  const marinaId = SEED_IDS.marina;
  const marina = User.parse({
    id: marinaId,
    name: "Marina Souza",
    email: "marina@example.com",
    phone: null,
    points: 1240,
    lifetimePoints: 1240,
    presence: { status: "away", lastVisitAt: new Date(now.getTime() - DAY) },
    marketingOptIn: true,
    pushToken: null,
    createdAt: new Date(now.getTime() - 20 * DAY),
    deletedAt: null,
  });

  // Dois dias seguidos de check-in (ontem e anteontem) e 2/5 na caça ao tesouro.
  const entranceId = Checkpoint.shape.id.parse(c(1));
  const scans: ScanRecord[] = [2, 1].map((daysAgo) => {
    const at = new Date(now.getTime() - daysAgo * DAY);
    return { userId: marina.id, checkpointId: entranceId, day: localDay(at), at };
  });
  const hunt = missions[0];
  const progress: ProgressRecord[] =
    hunt?.requirement.kind === "qr_scan"
      ? [
          {
            userId: marina.id,
            missionId: hunt.id,
            found: hunt.requirement.checkpointIds.slice(0, 2),
            startedAt: new Date(now.getTime() - DAY),
            completions: 0,
            lastCompletedAt: null,
            pointsAwarded: 0,
          },
        ]
      : [];

  return {
    users: [marina],
    stores,
    checkpoints,
    missions,
    progress,
    scans,
    ledger: [],
    receipts: [],
    rewards,
    redemptions: [],
    leads: [],
  };
};

/* ------------------------------------------------------------------ */
/* Singleton — sobrevive ao hot reload do `next dev`                   */
/* ------------------------------------------------------------------ */

declare global {
  var growlitheDb: Db | undefined;
}

export const getDb = (): Db => {
  globalThis.growlitheDb ??= createSeedDb();
  return globalThis.growlitheDb;
};

/** Para testes: começa de um banco limpo. */
export const resetDb = (db: Db = createSeedDb()): Db => {
  globalThis.growlitheDb = db;
  return db;
};
