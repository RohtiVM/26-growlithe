# 08 · QR Code e Gamificação (núcleo da solução)

> QR Code é a tecnologia central do Growlithe: a ponte entre o shopping físico e a gamificação. A prática sorteada (landing page) está em [`07-pratica-sorteada-landing-page.md`](07-pratica-sorteada-landing-page.md).

## Resumo

O QR Code é a **ponte entre o mundo físico do shopping e o progresso digital** do visitante. Cada QR é um *checkpoint* (loja, entrada, palco de evento). Escanear prova que a pessoa **esteve lá**, e isso alimenta toda a gamificação: missões, pontos, níveis, sequências e recompensas.

## Onde o QR Code aparece na solução

| Uso | Quem escaneia | O que acontece | Tipo no modelo |
|---|---|---|---|
| **Check-in na entrada** | Visitante | `Presence` muda para `at_mall`; conta para sequências | `Presence`, `visit_streak` |
| **Missão em loja** | Visitante | Ganha pontos, avança na missão | `MissionRequirement` `qr_scan` |
| **Caça ao tesouro** | Visitante | N QRs em ordem, com pista do próximo após cada scan | `qr_scan` com `ordered: true` |
| **Evento** (show, oficina) | Visitante | Pontos por presença no evento | `event_checkin` |
| **QR dinâmico no tablet da loja** | Visitante | QR que muda a cada 60 s, para missões de alto valor | `QrPayload.exp` curto |
| **⚡ QR do cupom fiscal** | Visitante | Valida a compra da Missão Relâmpago em **qualquer** loja da categoria | `purchase_category` + `NfceQrUrl` |

E as camadas de **gamificação** que o QR alimenta:

| Mecânica | Implementação | Por que engaja |
|---|---|---|
| Pontos | `point_ledger` + `profiles.points` | Recompensa imediata e visível |
| Níveis | `Tier` derivado de `lifetimePoints` | Status e progresso de longo prazo; recompensas exclusivas (`minTier`) |
| Sequência | `visit_streak` + push "sua sequência acaba amanhã" | Aversão à perda: o principal gatilho de **retorno** |
| Missões com prazo | `startsAt`/`endsAt` | Urgência e novidade semanal |
| Caça ao tesouro | `qr_scan` ordenado | Exploração: leva o visitante a alas que ele não conhecia |
| Recompensas reais | `RewardBenefit` | Converte engajamento em valor (e em venda para o lojista) |

## Como o QR funciona por dentro

### Formato do token

```
https://growlithe.app/s/<token>
token = base64url( JSON.stringify({ v: 1, cp: "<CheckpointId>", exp: 1763000000, sig: "<HMAC>" }) )
sig   = HMAC-SHA256( `${v}.${cp}.${exp}`, QR_SIGNING_SECRET )
```

- **URL, não texto puro:** a câmera nativa de qualquer celular abre o app. Funciona sem o app instalado.
- **Assinado:** ninguém gera um QR válido sem o segredo do servidor. Impossível "inventar" um checkpoint.
- **Versionado** (`v: 1`): `z.literal(1)` permite evoluir o formato sem quebrar QRs já impressos.

### Verificação type-safe (sem `as`, sem `any`)

```ts
// src/server/qr.ts
import { QrPayload, CheckpointId, type Result } from "@/domain/schemas";

type QrError = "invalid_qr" | "expired_qr";

const decode = (token: string): unknown => {
  try {
    return JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
  } catch {
    return null; // vira invalid_qr no safeParse abaixo
  }
};

export const verifyQrToken = async (
  token: string,
  now: Date = new Date(),
): Promise<Result<CheckpointId, QrError>> => {
  const parsed = QrPayload.safeParse(decode(token));
  if (!parsed.success) return { ok: false, error: "invalid_qr", message: "QR malformado" };

  const { v, cp, exp, sig } = parsed.data; // tudo tipado; `cp` já é CheckpointId com brand
  const expected = await hmac(`${v}.${cp}.${exp}`);
  if (!timingSafeEqual(sig, expected)) return { ok: false, error: "invalid_qr", message: "Assinatura inválida" };
  if (exp * 1000 < now.getTime()) return { ok: false, error: "expired_qr", message: "QR expirado" };

  return { ok: true, data: cp };
};
```

O retorno `Result<CheckpointId, QrError>` faz com que o chamador **seja obrigado** a tratar o erro antes de acessar o `CheckpointId`.

### Antifraude

| Ataque | Defesa |
|---|---|
| Forjar um QR | Assinatura HMAC com segredo só no servidor |
| Fotografar o QR e escanear de casa | Limite de 1 scan por checkpoint por dia (`UNIQUE` no banco); missões de alto valor usam **QR dinâmico** (expira em 60 s) exibido no tablet da loja; scans só contam com o shopping aberto (`mall_closed`) |
| Escanear 2 vezes ao mesmo tempo | `UNIQUE (user_id, checkpoint_id, scanned_on)` na transação `award_points` |
| Alterar pontos pelo cliente | Cliente não escreve saldo; RLS + função `SECURITY DEFINER` |
| Contas falsas em massa | Login por e-mail verificado; rate limit por usuário na Server Action |

### Painel do shopping: gerar e imprimir

O admin cria um *checkpoint* (por exemplo, "Burger X — balcão"), e o painel gera o QR em SVG com a lib `qrcode`, pronto para imprimir em display de mesa. Para QR dinâmico, o painel abre uma página em tela cheia, para o tablet da loja, que gera um novo token a cada 60 s.

## Métricas que a tecnologia habilita

Cada scan é um evento com `user_id`, `checkpoint_id` e horário. Com isso o shopping obtém, **pela primeira vez**:
- mapa de calor de circulação por loja e horário;
- conversão "viu a missão → foi até a loja";
- frequência real de retorno por visitante;
- retorno de cada campanha patrocinada por lojista.

---

## ⚡ Missão Relâmpago: o QR Code que já existe em todo cupom

**A mecânica:** o shopping sorteia e lança uma missão genérica, sem marca, por exemplo *"Compre uma peça de roupa em qualquer loja até as 18h: pontos em dobro"*. O visitante escolhe onde comprar, e no fim escaneia o **QR Code impresso no rodapé do cupom fiscal**.

**Por que é forte:**
- **Zero integração com lojistas.** O QR da NFC-e é obrigatório e padronizado nacionalmente; toda loja já imprime. No dia 1, todas as lojas do shopping participam.
- **Justo com todas as lojas.** A missão não favorece uma marca: direciona fluxo para uma **categoria** inteira, e o shopping pode alternar categorias com movimento fraco no dia.
- **Gera venda de verdade**, e não só circulação. É o argumento que o lojista e o shopping mais querem ouvir.
- **Urgência + surpresa.** Prazo curto e multiplicador de pontos criam o hábito de abrir o app ao chegar.

**O que o app lê do QR (sem consultar ninguém):** a chave de acesso de 44 posições traz o **CNPJ da loja** (é do shopping? qual categoria?), o **mês da emissão** e o **modelo 65** (é NFC-e de consumidor). O dígito verificador (módulo 11) barra chaves digitadas ou inventadas.

| Regra | Como é garantida |
|---|---|
| Loja precisa ser do shopping | CNPJ da chave precisa existir em `stores` |
| Compra precisa ser da categoria da missão | `stores.category === requirement.category` |
| Um cupom vale uma única vez (para todos) | `UNIQUE (access_key_hash)` em `receipts` |
| Cupom precisa ser recente | Mês e ano da chave = período da missão; o scan só é aceito durante a janela da missão |
| Chave forjada ou digitada errada | Dígito verificador módulo 11 + modelo 65 |

**Limitação assumida no MVP:** o QR padrão da emissão normal não traz o **valor** nem os **itens** da compra, e a data vem só como mês e ano. No MVP, a categoria é inferida pela **categoria da loja** (comprou numa loja de roupas, conta como roupa). Num cupom antigo do mesmo mês, a janela curta e o uso único do cupom limitam o abuso. **Solução já desenhada e testada:** consultar a nota na SEFAZ pela chave (API da Infosimples) para conferir data e hora exatas, valor mínimo, itens e cancelamento, com queda automática para a validação local. Ver [`09-integracao-sefaz.md`](09-integracao-sefaz.md).

**Privacidade (LGPD):** o app não guarda o cupom nem o CPF que possa estar nele. Guarda só o hash da chave, a loja e a hora do scan.

## Extensões futuras

O domínio foi desenhado para trocar o **gatilho físico** sem reescrever a gamificação. Basta adicionar um membro à união `MissionRequirement`, e o compilador aponta cada `switch` que precisa tratar o caso novo.

| Sorteio | Mudança no modelo | Encaixe |
|---|---|---|
| **Beacons / BLE** | `{ kind: "beacon_proximity", beaconId, minSeconds }` | Check-in automático por proximidade em vez de scan |
| **IA** | Serviço que recebe histórico de `scans` e gera `CreateMissionInput` personalizado | Missões recomendadas por perfil; saída da IA validada com `CreateMissionInput.safeParse`, para que a IA não injete missão inválida |
| **Geolocalização** | `{ kind: "geofence", lat, lng, radiusM }` | Presença detectada pelo GPS |
| **NFC** | Mesmo `QrPayload` gravado em tag NFC | Reaproveita 100% da verificação HMAC |
