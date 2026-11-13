/**
 * Testa a migração do Supabase num Postgres de verdade (PGlite, Postgres em WebAssembly).
 * Garante que as regras de antifraude valem no banco, e não só no adaptador em memória.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";

const MIGRATIONS = join(import.meta.dirname, "../../supabase/migrations");

const U = "00000001-0000-4000-8000-000000000001";
const STORE = "00000002-0000-4000-8000-000000000001";
const ENTRANCE = "00000003-0000-4000-8000-000000000001";
const MISSION = "00000004-0000-4000-8000-000000000001";
const REWARD = "00000005-0000-4000-8000-000000000001";

let db: PGlite;

const one = async <T,>(sql: string, params: unknown[] = []): Promise<T> => {
  const { rows } = await db.query<T>(sql, params);
  const row = rows[0];
  if (row === undefined) throw new Error(`sem resultado: ${sql}`);
  return row;
};

const balance = () => one<{ points: number; lifetime_points: number }>(
  "select points, lifetime_points from profiles where id = $1",
  [U],
);

beforeEach(async () => {
  db = new PGlite();
  for (const file of readdirSync(MIGRATIONS).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
  }
  await db.exec(`
    insert into profiles (id, name, email, points, lifetime_points) values ('${U}', 'Marina', 'marina@example.com', 1000, 1000);
    insert into stores (id, name, cnpj, category) values ('${STORE}', 'Moda Center', '12345678000195', 'vestuario');
    insert into checkpoints (id, label, kind, scan_points) values ('${ENTRANCE}', 'Entrada Norte', 'entrance', 10);
    insert into missions (id, title, requirement, launch, points_reward, starts_at, ends_at)
      values ('${MISSION}', 'Relâmpago da moda', '{"kind":"purchase_category","category":"vestuario"}',
              '{"type":"flash"}', 200, now() - interval '1 hour', now() + interval '2 hours');
    insert into rewards (id, title, cost_points, benefit, stock)
      values ('${REWARD}', 'Estacionamento grátis', 800, '{"kind":"free_parking","hours":2}', 1);
  `);
});

describe("migração do Supabase", () => {
  it("liga RLS em todas as tabelas", async () => {
    const { rows } = await db.query<{ relname: string }>(
      "select relname from pg_class where relkind = 'r' and relnamespace = 'public'::regnamespace and not relrowsecurity",
    );
    expect(rows).toEqual([]);
  });

  it("scan: pontua uma vez por dia, faz check-in na entrada", async () => {
    const scan = (cp: string) => one<{ r: string }>("select record_scan($1, $2, '2026-11-13') as r", [U, cp]);
    expect((await scan(ENTRANCE)).r).toBe("ok");
    expect((await scan(ENTRANCE)).r).toBe("already_scanned_today");
    expect((await scan(MISSION)).r).toBe("invalid_qr");
    expect(await balance()).toEqual({ points: 1010, lifetime_points: 1010 });
    const p = await one<{ presence_status: string; entrance: string }>(
      "select presence_status, entrance from profiles where id = $1",
      [U],
    );
    expect(p).toEqual({ presence_status: "at_mall", entrance: "Entrada Norte" });
  });

  it("missão não paga além do limite por visitante", async () => {
    const a = await one<{ ok: boolean }>("select award_mission($1, $2, 200) as ok", [U, MISSION]);
    const b = await one<{ ok: boolean }>("select award_mission($1, $2, 200) as ok", [U, MISSION]);
    expect([a.ok, b.ok]).toEqual([true, false]);
    expect((await balance()).points).toBe(1200);
  });

  it("cupom fiscal vale uma vez no sistema inteiro", async () => {
    const OTHER = "00000001-0000-4000-8000-000000000002";
    await db.query("insert into profiles (id, name, email) values ($1, 'Ana', 'ana@example.com')", [OTHER]);
    const hash = "a".repeat(64);
    const award = (user: string) =>
      one<{ r: string }>("select award_receipt($1, $2, $3, $4, 400, 'local') as r", [user, MISSION, STORE, hash]);
    expect((await award(U)).r).toBe("ok");
    expect((await award(OTHER)).r).toBe("receipt_already_used");
    expect((await balance()).points).toBe(1400);
  });

  it("segundo cupom para a mesma missão: mission_already_completed", async () => {
    await one("select award_receipt($1, $2, $3, $4, 400, 'local')", [U, MISSION, STORE, "a".repeat(64)]);
    const second = await one<{ r: string }>("select award_receipt($1, $2, $3, $4, 400, 'local') as r", [
      U,
      MISSION,
      STORE,
      "b".repeat(64),
    ]);
    expect(second.r).toBe("mission_already_completed");
  });

  it("resgate debita, baixa estoque e o código vale uma vez", async () => {
    const { id } = await one<{ id: string }>("select redemption_id as id from reserve_reward($1, $2)", [U, REWARD]);
    expect(await balance()).toEqual({ points: 200, lifetime_points: 1000 }); // gastar não baixa o nível
    const { code } = await one<{ code: string }>("select code from redemptions where id = $1", [id]);
    expect(code).toMatch(/^\d{6}$/);

    const first = await one<{ v: string | null }>("select validate_redemption($1) as v", [code]);
    const again = await one<{ v: string | null }>("select validate_redemption($1) as v", [code]);
    expect([first.v, again.v]).toEqual([id, null]);
  });

  it("resgate recusa saldo insuficiente e estoque esgotado", async () => {
    const reserve = () => one<{ error: string | null }>("select error from reserve_reward($1, $2)", [U, REWARD]);
    expect((await reserve()).error).toBeNull(); // estoque 1 → 0
    expect((await reserve()).error).toBe("out_of_stock");
    await db.query("update rewards set stock = null");
    expect((await reserve()).error).toBe("insufficient_points");
    expect(await balance()).toEqual({ points: 200, lifetime_points: 1000 }); // recusas não debitam
  });

  it("cupom de resgate vencido expira e devolve pontos e estoque", async () => {
    const { id } = await one<{ id: string }>("select redemption_id as id from reserve_reward($1, $2)", [U, REWARD]);
    await db.query("update redemptions set expires_at = now() - interval '1 minute' where id = $1", [id]);
    expect((await one<{ n: number }>("select expire_redemptions() as n")).n).toBe(1);
    expect(await balance()).toEqual({ points: 1000, lifetime_points: 1000 }); // estorno não infla o nível
    expect((await one<{ stock: number }>("select stock from rewards where id = $1", [REWARD])).stock).toBe(1);
  });

  it("estados inválidos não entram no banco", async () => {
    await expect(
      db.query("update profiles set presence_status = 'at_mall', checked_in_at = null where id = $1", [U]),
    ).rejects.toThrow("presence_consistent");
    await expect(
      db.query("insert into redemptions (user_id, reward_id, status) values ($1, $2, 'redeemed')", [U, REWARD]),
    ).rejects.toThrow("redemption_state");
    await expect(
      db.query(
        "insert into missions (title, requirement, launch, points_reward, starts_at, ends_at) values ('Errada', '{\"kind\":\"x\"}', '{\"type\":\"scheduled\"}', 10, now(), now() - interval '1 hour')",
      ),
    ).rejects.toThrow("ends_after_start");
  });
});
