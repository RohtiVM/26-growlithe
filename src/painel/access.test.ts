import { describe, expect, it } from "vitest";
import { StaffMember } from "@/domain/schemas";
import { painelAccess, painelHomePath, requireStaffRole, safeNextPath } from "./access";

const USER = "7d0e4c4a-1f2b-4c3d-8e9f-0a1b2c3d4e5f";
const STORE = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";

const admin = StaffMember.parse({ role: "admin", userId: USER });
const lojista = StaffMember.parse({ role: "lojista", userId: USER, storeId: STORE });

describe("painelAccess: linha de profiles → acesso (critérios 1 e 2)", () => {
  it("sem sessão: anônimo", () => {
    expect(painelAccess(null)).toEqual({ kind: "anonymous" });
  });

  it("perfil sem papel: sem acesso ao painel (critério 1)", () => {
    expect(painelAccess({ id: USER, staff_role: null, store_id: null })).toEqual({ kind: "no_access" });
  });

  it("admin vira StaffMember admin", () => {
    expect(painelAccess({ id: USER, staff_role: "admin", store_id: null })).toEqual({ kind: "staff", staff: admin });
  });

  it("lojista vira StaffMember com a loja", () => {
    expect(painelAccess({ id: USER, staff_role: "lojista", store_id: STORE })).toEqual({ kind: "staff", staff: lojista });
  });

  it("linha inconsistente ou desconhecida nunca libera o painel", () => {
    for (const row of [
      { id: USER, staff_role: "lojista", store_id: null },
      { id: USER, staff_role: "dono", store_id: null },
      { id: "não-é-uuid", staff_role: "admin", store_id: null },
      "lixo",
      undefined,
    ]) {
      expect(painelAccess(row)).toEqual({ kind: "no_access" });
    }
  });
});

describe("painelHomePath (critério 2)", () => {
  it("admin vai para o início do painel; lojista direto para validar cupom de resgate", () => {
    expect(painelHomePath(admin)).toBe("/painel");
    expect(painelHomePath(lojista)).toBe("/painel/validar");
  });
});

describe("requireStaffRole: guarda das ações do servidor (critério 3)", () => {
  it("lojista chamando ação de admin recebe forbidden", () => {
    expect(requireStaffRole({ kind: "staff", staff: lojista }, ["admin"])).toMatchObject({ ok: false, error: "forbidden" });
  });

  it("sem sessão recebe not_authenticated; sem papel recebe forbidden", () => {
    expect(requireStaffRole({ kind: "anonymous" }, ["admin"])).toMatchObject({ ok: false, error: "not_authenticated" });
    expect(requireStaffRole({ kind: "no_access" }, ["admin", "lojista"])).toMatchObject({ ok: false, error: "forbidden" });
  });

  it("papel permitido passa e devolve o StaffMember", () => {
    expect(requireStaffRole({ kind: "staff", staff: admin }, ["admin"])).toEqual({ ok: true, data: admin });
    expect(requireStaffRole({ kind: "staff", staff: lojista }, ["admin", "lojista"])).toEqual({ ok: true, data: lojista });
  });
});

describe("safeNextPath: para onde voltar depois do link mágico", () => {
  it("aceita só caminhos internos do painel", () => {
    expect(safeNextPath("/painel/validar")).toBe("/painel/validar");
    expect(safeNextPath("/painel")).toBe("/painel");
  });

  it("recusa redirecionamento aberto e cai no painel", () => {
    for (const bad of ["https://evil.test", "//evil.test", "/painelx", "/\\evil.test", "/", null, ""]) {
      expect(safeNextPath(bad)).toBe("/painel");
    }
  });
});
