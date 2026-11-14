import { describe, expect, it } from "vitest";
import {
  MissionRow,
  StoreId,
  UserId,
  groupMissionsByPeriod,
  missionPeriod,
  type Mission,
  type PainelAccess,
} from "@/domain/schemas";
import { createMission, endMission, formatMissionPeriod, missionFromRow, toMallInputValue } from "./missions";

const ADMIN_ID = "7d0e4c4a-1f2b-4c3d-8e9f-0a1b2c3d4e5f";
const ADMIN: PainelAccess = { kind: "staff", staff: { role: "admin", userId: UserId.parse(ADMIN_ID) } };
const LOJISTA: PainelAccess = {
  kind: "staff",
  staff: {
    role: "lojista",
    userId: UserId.parse(ADMIN_ID),
    storeId: StoreId.parse("1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed"),
  },
};
const CP1 = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const CP2 = "3f2504e0-4f89-41d3-9a0c-0305e82c3302";
const MISSION_ID = "6ba7b810-9dad-41d1-80b4-00c04fd430c8";
const NOW = new Date("2026-11-14T13:00:00Z"); // 10:00 em Palmas

/** O que a Server Action monta a partir do FormData do formulário A3. */
const FORM = {
  title: "Caça ao tesouro",
  description: "Ache os QR Codes do shopping",
  kind: "qr_scan",
  checkpointIds: [CP1, CP2],
  ordered: "on",
  days: "",
  checkpointId: "",
  eventName: "",
  category: "",
  launchType: "scheduled",
  pushTitle: "",
  pushBody: "",
  pointsMultiplier: "",
  pointsReward: "150",
  startsAt: "2026-11-14T10:00",
  endsAt: "2026-11-20T22:00",
  maxCompletionsPerUser: "1",
};

const ROW = {
  id: MISSION_ID,
  title: "Caça ao tesouro",
  description: "Ache os QR Codes do shopping",
  requirement: { kind: "qr_scan", checkpointIds: [CP1, CP2], ordered: true },
  points_reward: 150,
  starts_at: "2026-11-14T13:00:00+00:00",
  ends_at: "2026-11-21T01:00:00+00:00",
  max_completions_per_user: 1,
  store_id: null,
  launch: { type: "scheduled" },
  created_by: ADMIN_ID,
  created_at: "2026-11-14T12:00:00+00:00",
};

/** Banco falso: guarda o que chegou e devolve a linha ou um erro do Postgres. */
const fakeDb = (result: { row: unknown } | { code: string }) => {
  const calls: unknown[] = [];
  const run = async (values: unknown) => {
    calls.push(values);
    return "row" in result ? { data: result.row, error: null } : { data: null, error: { code: result.code } };
  };
  return { run, calls };
};

const mission = (startsAt: string, endsAt: string, id = MISSION_ID): Mission =>
  missionFromRow({ ...ROW, id, starts_at: startsAt, ends_at: endsAt });

describe("MissionRow (borda do banco)", () => {
  it("converte a linha do banco para o domínio", () => {
    expect(missionFromRow(ROW)).toEqual({
      id: MISSION_ID,
      title: "Caça ao tesouro",
      description: "Ache os QR Codes do shopping",
      requirement: { kind: "qr_scan", checkpointIds: [CP1, CP2], ordered: true },
      pointsReward: 150,
      startsAt: new Date("2026-11-14T13:00:00Z"),
      endsAt: new Date("2026-11-21T01:00:00Z"),
      maxCompletionsPerUser: 1,
      storeId: null,
      launch: { type: "scheduled" },
      createdAt: new Date("2026-11-14T12:00:00Z"),
    });
  });

  it("recusa requisito desconhecido", () => {
    expect(MissionRow.safeParse({ ...ROW, requirement: { kind: "dance" } }).success).toBe(false);
  });
});

describe("createMission (UC3, UC5)", () => {
  it("admin cria missão de QR Code; o banco recebe snake_case e o horário de Palmas em UTC", async () => {
    const db = fakeDb({ row: ROW });
    const r = await createMission(ADMIN, FORM, db.run);
    expect(r).toEqual({ ok: true, data: missionFromRow(ROW) });
    expect(db.calls).toEqual([
      {
        title: "Caça ao tesouro",
        description: "Ache os QR Codes do shopping",
        requirement: { kind: "qr_scan", checkpointIds: [CP1, CP2], ordered: true },
        points_reward: 150,
        starts_at: "2026-11-14T13:00:00.000Z",
        ends_at: "2026-11-21T01:00:00.000Z",
        max_completions_per_user: 1,
        store_id: null,
        launch: { type: "scheduled" },
        created_by: ADMIN_ID,
      },
    ]);
  });

  it("critério 3: lojista recebe forbidden e nada é gravado", async () => {
    const db = fakeDb({ row: ROW });
    const r = await createMission(LOJISTA, FORM, db.run);
    expect(r).toMatchObject({ ok: false, error: "forbidden" });
    expect(db.calls).toEqual([]);
  });

  it("sem sessão recebe not_authenticated", async () => {
    const db = fakeDb({ row: ROW });
    const r = await createMission({ kind: "anonymous" }, FORM, db.run);
    expect(r).toMatchObject({ ok: false, error: "not_authenticated" });
    expect(db.calls).toEqual([]);
  });

  it("critério 9: fim antes do início dá erro no campo Fim e nada é gravado", async () => {
    const db = fakeDb({ row: ROW });
    const r = await createMission(ADMIN, { ...FORM, endsAt: "2026-11-13T10:00" }, db.run);
    expect(r).toMatchObject({
      ok: false,
      error: "invalid_input",
      fieldErrors: { endsAt: "A missão precisa terminar depois de começar" },
    });
    expect(db.calls).toEqual([]);
  });

  it("critério 11: relâmpago sem título do push dá erro no campo do push", async () => {
    const db = fakeDb({ row: ROW });
    const r = await createMission(
      ADMIN,
      { ...FORM, launchType: "flash", pushTitle: "", pushBody: "Corra até a praça!", pointsMultiplier: "2" },
      db.run,
    );
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error === "invalid_input" && r.fieldErrors.pushTitle).toBeTruthy();
    expect(db.calls).toEqual([]);
  });

  it("relâmpago completo grava título, texto do push e multiplicador", async () => {
    const db = fakeDb({ row: ROW });
    await createMission(
      ADMIN,
      { ...FORM, launchType: "flash", pushTitle: "Pontos em dobro!", pushBody: "Corra até a praça!", pointsMultiplier: "2" },
      db.run,
    );
    expect(db.calls[0]).toMatchObject({
      launch: { type: "flash", pushTitle: "Pontos em dobro!", pushBody: "Corra até a praça!", pointsMultiplier: 2 },
    });
  });

  it("multiplicador fora de 1 a 5 é recusado (RF09)", async () => {
    const db = fakeDb({ row: ROW });
    const r = await createMission(
      ADMIN,
      { ...FORM, launchType: "flash", pushTitle: "Pontos!", pushBody: "Corra até a praça!", pointsMultiplier: "6" },
      db.run,
    );
    expect(!r.ok && r.error === "invalid_input" && r.fieldErrors.pointsMultiplier).toBeTruthy();
    expect(db.calls).toEqual([]);
  });

  it("critério 8: só os campos do tipo escolhido entram no requisito", async () => {
    const cases = [
      [{ kind: "visit_streak", days: "3" }, { kind: "visit_streak", days: 3 }],
      [
        { kind: "event_checkin", checkpointId: CP1, eventName: "Show de Natal" },
        { kind: "event_checkin", checkpointId: CP1, eventName: "Show de Natal" },
      ],
      [{ kind: "purchase_category", category: "vestuario" }, { kind: "purchase_category", category: "vestuario" }],
    ] as const;
    for (const [fields, requirement] of cases) {
      const db = fakeDb({ row: ROW });
      await createMission(ADMIN, { ...FORM, ...fields }, db.run);
      expect(db.calls[0]).toMatchObject({ requirement });
      expect(db.calls[0]).not.toMatchObject({ requirement: { checkpointIds: [CP1, CP2] } });
    }
  });

  it("QR Code sem checkpoint dá erro no campo de checkpoints", async () => {
    const db = fakeDb({ row: ROW });
    const r = await createMission(ADMIN, { ...FORM, checkpointIds: [] }, db.run);
    expect(!r.ok && r.error === "invalid_input" && r.fieldErrors.checkpointIds).toBeTruthy();
    expect(db.calls).toEqual([]);
  });

  it("título curto e pontos vazios dão erro em cada campo", async () => {
    const db = fakeDb({ row: ROW });
    const r = await createMission(ADMIN, { ...FORM, title: "Oi", pointsReward: "" }, db.run);
    const fieldErrors = !r.ok && r.error === "invalid_input" ? r.fieldErrors : {};
    expect(fieldErrors.title).toContain("título");
    expect(fieldErrors.pointsReward).toContain("pontos");
    expect(db.calls).toEqual([]);
  });

  it("tipo fora do MVP é recusado", async () => {
    const db = fakeDb({ row: ROW });
    const r = await createMission(ADMIN, { ...FORM, kind: "purchase" }, db.run);
    expect(r).toMatchObject({ ok: false, error: "invalid_input" });
    expect(db.calls).toEqual([]);
  });

  it("erro do banco vira save_failed, sem vazar detalhe", async () => {
    const db = fakeDb({ code: "XX000" });
    const r = await createMission(ADMIN, FORM, db.run);
    expect(r).toMatchObject({ ok: false, error: "save_failed" });
  });
});

describe("groupMissionsByPeriod (critério 10)", () => {
  it("separa ativas, futuras e encerradas e ordena cada grupo", () => {
    const activeLate = mission("2026-11-10T00:00:00Z", "2026-11-30T00:00:00Z", "00000000-0000-4000-8000-000000000001");
    const activeSoon = mission("2026-11-14T13:00:00Z", "2026-11-15T00:00:00Z", "00000000-0000-4000-8000-000000000002");
    const future = mission("2026-11-20T00:00:00Z", "2026-11-25T00:00:00Z", "00000000-0000-4000-8000-000000000003");
    const endedOld = mission("2026-11-01T00:00:00Z", "2026-11-02T00:00:00Z", "00000000-0000-4000-8000-000000000004");
    const endedNow = mission("2026-11-01T00:00:00Z", "2026-11-14T13:00:00Z", "00000000-0000-4000-8000-000000000005");

    expect(groupMissionsByPeriod([endedOld, future, activeLate, endedNow, activeSoon], NOW)).toEqual({
      active: [activeSoon, activeLate],
      upcoming: [future],
      ended: [endedNow, endedOld],
    });
  });

  it("começa no instante do início e termina no instante do fim", () => {
    expect(missionPeriod(mission("2026-11-14T13:00:00Z", "2026-11-15T00:00:00Z"), NOW)).toBe("active");
    expect(missionPeriod(mission("2026-11-01T00:00:00Z", "2026-11-14T13:00:00Z"), NOW)).toBe("ended");
    expect(missionPeriod(mission("2026-11-14T13:00:01Z", "2026-11-15T00:00:00Z"), NOW)).toBe("upcoming");
  });
});

describe("endMission (UC4, critério 12)", () => {
  const endedRow = { ...ROW, starts_at: "2026-11-10T00:00:00Z", ends_at: NOW.toISOString() };

  it("admin encerra uma missão ativa: o fim vira agora e ela vai para Encerradas", async () => {
    const db = fakeDb({ row: endedRow });
    const r = await endMission(ADMIN, { missionId: MISSION_ID }, NOW, db.run);
    expect(db.calls).toEqual([{ id: MISSION_ID, now: NOW.toISOString() }]);
    expect(r.ok && missionPeriod(r.data, NOW)).toBe("ended");
  });

  it("lojista recebe forbidden e nada muda", async () => {
    const db = fakeDb({ row: endedRow });
    const r = await endMission(LOJISTA, { missionId: MISSION_ID }, NOW, db.run);
    expect(r).toMatchObject({ ok: false, error: "forbidden" });
    expect(db.calls).toEqual([]);
  });

  it("missão que não está ativa (futura ou já encerrada) não é encerrada", async () => {
    const db = fakeDb({ row: null });
    const r = await endMission(ADMIN, { missionId: MISSION_ID }, NOW, db.run);
    expect(r).toMatchObject({ ok: false, error: "mission_not_active" });
  });

  it("check do banco (fim antes do início) também vira mission_not_active", async () => {
    const db = fakeDb({ code: "23514" });
    const r = await endMission(ADMIN, { missionId: MISSION_ID }, NOW, db.run);
    expect(r).toMatchObject({ ok: false, error: "mission_not_active" });
  });

  it("id malformado é invalid_input e não chega ao banco", async () => {
    const db = fakeDb({ row: endedRow });
    const r = await endMission(ADMIN, { missionId: "x" }, NOW, db.run);
    expect(r).toMatchObject({ ok: false, error: "invalid_input" });
    expect(db.calls).toEqual([]);
  });

  it("outro erro do banco vira save_failed", async () => {
    const db = fakeDb({ code: "XX000" });
    const r = await endMission(ADMIN, { missionId: MISSION_ID }, NOW, db.run);
    expect(r).toMatchObject({ ok: false, error: "save_failed" });
  });
});

describe("formatMissionPeriod", () => {
  it("mostra início e fim no horário de Palmas", () => {
    expect(formatMissionPeriod(missionFromRow(ROW))).toBe("14/11, 10:00 – 20/11, 22:00");
  });
});

describe("toMallInputValue", () => {
  it("preenche o datetime-local com a hora de Palmas", () => {
    expect(toMallInputValue(NOW)).toBe("2026-11-14T10:00");
  });
});
