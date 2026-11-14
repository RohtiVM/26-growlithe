import { describe, expect, it } from "vitest";
import {
  companyLabel,
  joinWaitlist,
  readUtm,
  readWaitlistForm,
  validateWaitlist,
  variantFromCookie,
  type JoinWaitlistRpc,
  type JoinWaitlistRpcArgs,
} from "./waitlist";

const form = (fields: Record<string, string>): FormData => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

const VALID = { name: "Marina Souza", email: "Marina@Exemplo.com", profile: "visitante", consentLgpd: "on" };

/** Banco falso: guarda os argumentos e devolve o que a função `join_waitlist` devolveria. */
const fakeRpc = (result: { data: unknown } | { error: string }) => {
  const calls: JoinWaitlistRpcArgs[] = [];
  const rpc: JoinWaitlistRpc = async (args) => {
    calls.push(args);
    return "data" in result ? { data: result.data, error: null } : { data: null, error: { message: result.error } };
  };
  return { rpc, calls };
};

describe("lista de espera · leitura do formulário", () => {
  it("lê os campos como texto e o aceite como booleano", () => {
    expect(readWaitlistForm(form({ ...VALID, company: "  " }))).toEqual({
      name: "Marina Souza",
      email: "Marina@Exemplo.com",
      profile: "visitante",
      company: "  ",
      consentLgpd: true,
    });
  });

  it("campo ausente vira texto vazio e aceite ausente vira false", () => {
    expect(readWaitlistForm(new FormData())).toEqual({
      name: "",
      email: "",
      profile: "",
      company: "",
      consentLgpd: false,
    });
  });
});

describe("lista de espera · validação (critério 4)", () => {
  it("aceita um visitante e normaliza e-mail, nome e empresa", () => {
    const result = validateWaitlist(readWaitlistForm(form({ ...VALID, name: "  Marina Souza ", company: "Loja X" })));
    expect(result).toEqual({
      ok: true,
      data: { name: "Marina Souza", email: "marina@exemplo.com", profile: "visitante", company: null, consentLgpd: true },
    });
  });

  it("mostra uma mensagem em cada campo inválido", () => {
    const result = validateWaitlist(readWaitlistForm(new FormData()));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors).toEqual({
      name: "Conta pra gente seu nome",
      email: "Confira o e-mail",
      profile: "Escolha se você é visitante, lojista ou shopping",
      consentLgpd: "Precisamos do seu aceite para entrar em contato",
    });
  });

  it("exige o aceite LGPD", () => {
    const result = validateWaitlist(readWaitlistForm(form({ ...VALID, consentLgpd: "" })));
    expect(result).toEqual({
      ok: false,
      fieldErrors: { consentLgpd: "Precisamos do seu aceite para entrar em contato" },
    });
  });

  it("exige o nome da loja para lojista e do shopping para shopping", () => {
    expect(validateWaitlist(readWaitlistForm(form({ ...VALID, profile: "lojista" })))).toEqual({
      ok: false,
      fieldErrors: { company: "Conta pra gente o nome da sua loja" },
    });
    expect(validateWaitlist(readWaitlistForm(form({ ...VALID, profile: "shopping", company: " " })))).toEqual({
      ok: false,
      fieldErrors: { company: "Conta pra gente o nome do shopping" },
    });
  });

  it("guarda a empresa de lojista e shopping", () => {
    const result = validateWaitlist(readWaitlistForm(form({ ...VALID, profile: "lojista", company: " Moda Cerrado " })));
    expect(result.ok && result.data.company).toBe("Moda Cerrado");
  });

  it("mostra o erro da empresa junto com os outros", () => {
    const result = validateWaitlist(readWaitlistForm(form({ profile: "shopping" })));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.fieldErrors).sort()).toEqual(["company", "consentLgpd", "email", "name"]);
  });

  it("rótulo da empresa muda com o perfil", () => {
    expect(companyLabel("lojista")).toBe("Nome da loja");
    expect(companyLabel("shopping")).toBe("Nome do shopping");
    expect(companyLabel("visitante")).toBeNull();
  });
});

describe("lista de espera · variante e UTM vêm do servidor (D6)", () => {
  it("variante vem do cookie; valor adulterado ou ausente vira A", () => {
    expect(variantFromCookie("B")).toBe("B");
    expect(variantFromCookie("A")).toBe("A");
    expect(variantFromCookie("Z")).toBe("A");
    expect(variantFromCookie(undefined)).toBe("A");
  });

  it("lê a UTM e descarta valor vazio, repetido ou longo demais", () => {
    expect(readUtm({ source: " cartaz ", medium: "qr", campaign: "ala-b" })).toEqual({
      source: "cartaz",
      medium: "qr",
      campaign: "ala-b",
    });
    expect(readUtm({ source: "", medium: ["qr", "x"], campaign: "x".repeat(61) })).toEqual({
      source: null,
      medium: null,
      campaign: null,
    });
    expect(readUtm({ source: undefined, medium: null, campaign: 42 })).toEqual({
      source: null,
      medium: null,
      campaign: null,
    });
  });
});

describe("lista de espera · cadastro (critérios 5 e 6)", () => {
  const context = { variantCookie: "B", utm: { source: "cartaz", medium: "qr", campaign: null } };

  it("grava o lead com a variante do cookie e a UTM do servidor", async () => {
    const { rpc, calls } = fakeRpc({ data: "joined" });
    const result = await joinWaitlist(form({ ...VALID, variant: "A" }), context, rpc);

    expect(result.status).toBe("joined");
    expect(result.status === "joined" && result.message).toMatch(/está na lista/);
    expect(calls).toEqual([
      {
        p_name: "Marina Souza",
        p_email: "marina@exemplo.com",
        p_profile: "visitante",
        p_company: null,
        p_variant: "B",
        p_utm_source: "cartaz",
        p_utm_medium: "qr",
        p_utm_campaign: null,
        p_consent_lgpd: true,
      },
    ]);
  });

  it("e-mail repetido devolve 'você já está na lista' sem erro", async () => {
    const { rpc } = fakeRpc({ data: "already_joined" });
    const result = await joinWaitlist(form(VALID), context, rpc);
    expect(result.status).toBe("already_joined");
    expect(result.status === "already_joined" && result.message).toMatch(/já está na lista/);
  });

  it("entrada inválida não chega ao banco e devolve os valores digitados", async () => {
    const { rpc, calls } = fakeRpc({ data: "joined" });
    const result = await joinWaitlist(form({ ...VALID, email: "marina@" }), context, rpc);
    expect(calls).toHaveLength(0);
    expect(result).toEqual({
      status: "invalid",
      fieldErrors: { email: "Confira o e-mail" },
      values: { ...readWaitlistForm(form({ ...VALID, email: "marina@" })) },
    });
  });

  it("falha do banco ou resposta inesperada vira mensagem amigável", async () => {
    for (const result of [{ error: "boom" }, { data: "talvez" }]) {
      const { rpc } = fakeRpc(result);
      const outcome = await joinWaitlist(form(VALID), context, rpc);
      expect(outcome.status).toBe("error");
    }
  });
});
