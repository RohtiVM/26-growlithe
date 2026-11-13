# 05 · Arquitetura Proposta

## Visão geral

Monólito modular em **Next.js (App Router)**. Um repositório e um deploy, com front-end e back-end compartilhando o mesmo domínio tipado. No hackathon, isso significa **zero tempo gasto sincronizando contratos de API**.

```mermaid
flowchart TB
    subgraph Cliente["Cliente — web app React no navegador do celular"]
        UI["React Server e Client Components<br/>Tailwind + shadcn/ui"]
        CAM["Scanner QR<br/>câmera do navegador"]
        FORM["Formulários<br/>react-hook-form + zodResolver"]
    end

    subgraph Dominio["src/domain — compartilhado"]
        SCHEMAS["schemas.ts<br/>Zod: fonte única da verdade"]
        RULES["Regras puras<br/>tierFromPoints, progressLabel"]
    end

    subgraph Servidor["Servidor Next.js — Vercel"]
        SA["Server Actions<br/>defineAction com schema e handler"]
        ROUTE["Route Handler /s/token<br/>link universal do QR"]
        QR["Serviço de QR<br/>assina e verifica HMAC"]
        RV["ReceiptVerifier<br/>cupom fiscal: SEFAZ ou local"]
        REPO["Repositórios<br/>linha do banco para domínio via Zod"]
    end

    subgraph Supabase
        AUTH["Auth<br/>link mágico"]
        PG[("Postgres<br/>RLS + função award_points")]
        RT["Realtime<br/>status do cupom"]
    end

    UI --> SA
    CAM --> SA
    FORM --> SA
    CAM -. câmera nativa .-> ROUTE
    ROUTE --> SA
    SA --> QR
    SA --> RV
    RV -. consulta NFC-e .-> INFO["API Infosimples<br/>SEFAZ"]
    SA --> REPO
    REPO --> PG
    UI --> AUTH
    RT --> UI
    PG --> RT

    SCHEMAS -. tipos e validação .-> UI
    SCHEMAS -. tipos e validação .-> FORM
    SCHEMAS -. tipos e validação .-> SA
    SCHEMAS -. parse .-> REPO
```

## Onde o tipo nasce e onde é validado

O ponto central da arquitetura: **cada fronteira de confiança tem um `parse`**, e todos os tipos vêm do mesmo lugar.

```mermaid
flowchart LR
    subgraph Nao_confiavel["Não confiável"]
        IN1[QR escaneado]
        IN2[Formulário]
        IN3[Linha do banco]
    end

    subgraph Borda["Borda — safeParse"]
        P1[ScanQrInput e QrPayload]
        P2[CreateMissionInput]
        P3[User, Mission, Redemption]
    end

    subgraph Confiavel["Domínio — tipos garantidos"]
        D[Lógica de negócio<br/>sem checagem defensiva]
    end

    subgraph Saida["Saída — allow-list"]
        O[UserDTO.parse<br/>Result tipado]
    end

    IN1 --> P1 --> D
    IN2 --> P2 --> D
    IN3 --> P3 --> D
    D --> O --> CLI[Cliente]
```

| Fronteira | Schema | O que protege |
|---|---|---|
| Câmera → servidor | `ScanQrInput`, `QrPayload` | QR forjado, expirado ou malformado |
| Formulário → servidor | `CreateMissionInput`, `UpdateProfileInput` | Admin enviando `id`; visitante tentando alterar `points` |
| Banco → domínio | `User`, `Mission`, `Redemption` | `jsonb` inconsistente, coluna nula inesperada |
| Domínio → cliente | `UserDTO` | Vazamento de telefone, token de push, flags internas |

## Fluxo crítico: escanear QR e ganhar pontos

```mermaid
sequenceDiagram
    autonumber
    actor V as Visitante
    participant C as Scanner — client
    participant A as scanQr — Server Action
    participant Q as Serviço QR
    participant DB as Postgres

    V->>C: aponta a câmera
    C->>A: scanQr com token
    A->>A: ScanQrInput.safeParse
    A->>Q: verify token
    Q->>Q: decodifica, QrPayload.safeParse, confere HMAC e exp
    alt token inválido ou expirado
        Q-->>A: invalid_qr ou expired_qr
        A-->>C: Result ok false
    else token válido
        Q-->>A: CheckpointId com brand
        A->>DB: rpc award_points com user e checkpoint
        Note over DB: transação: INSERT scan com UNIQUE por dia,<br/>INSERT point_ledger, UPSERT mission_progress,<br/>UPDATE profiles.points
        alt violação de UNIQUE
            DB-->>A: already_scanned_today
            A-->>C: Result ok false
        else sucesso
            DB-->>A: linhas atualizadas
            A->>A: MissionProgress.parse e tierFromPoints
            A-->>C: Result ok true com ScanSuccess
        end
    end
    C->>V: animação de pontos e level up
```

**Por que uma função Postgres (`award_points`)?** Para atomicidade e antifraude. Dois scans simultâneos do mesmo QR não geram pontos em dobro, porque o `UNIQUE (user_id, checkpoint_id, scanned_on)` resolve no banco, não no código.

## Fluxo: Missão Relâmpago validada pelo cupom fiscal

```mermaid
sequenceDiagram
    autonumber
    actor Adm as Admin do shopping
    actor V as Visitante
    participant A as Server Actions
    participant DB as Postgres

    Adm->>A: createMission com purchase_category vestuario e launch flash
    A->>V: push MISSÃO RELÂMPAGO com pontos em dobro
    V->>V: compra em qualquer loja de roupas
    V->>A: scanReceipt com missionId e URL do QR do cupom
    A->>A: NfceQrUrl.safeParse decompõe chave, CNPJ e mês
    A->>DB: busca loja pelo CNPJ e confere missão ativa
    alt CNPJ fora do shopping ou categoria errada
        A-->>V: store_not_in_mall ou wrong_category
    else ok
        A->>DB: rpc award_receipt: INSERT receipt com hash UNIQUE e lança pontos
        alt hash já existe
            DB-->>A: receipt_already_used
            A-->>V: erro com mensagem
        else sucesso
            A-->>V: pontos vezes multiplicador
        end
    end
```

## Fluxo: resgatar e validar cupom

```mermaid
sequenceDiagram
    actor V as Visitante
    actor L as Lojista
    participant A as Server Actions
    participant DB as Postgres
    participant RT as Realtime

    V->>A: redeemReward com rewardId
    A->>DB: rpc reserve_reward: debita pontos, baixa estoque, gera código
    DB-->>A: Redemption com status reserved
    A-->>V: código de 6 dígitos
    V->>RT: assina mudanças do resgate
    L->>A: validateRedemption com code
    A->>DB: UPDATE para redeemed se reserved e não expirado
    DB-->>RT: mudança no resgate
    RT-->>V: tela do cupom vira Usado
    A-->>L: Result ok true com o benefício
```

## Segurança

- **RLS (Row Level Security)** em todas as tabelas: o visitante só lê o próprio `profiles`, `mission_progress` e `redemptions`.
- **Pontos nunca são escritos pelo cliente.** Só a função `award_points` (`SECURITY DEFINER`), chamada pela Server Action, altera saldo.
- **Segredo do QR** (`QR_SIGNING_SECRET`) existe só no servidor. O cliente nunca assina nada.
- **Papéis**: `visitor`, `store_staff` (valida cupons da própria loja) e `mall_admin`. O papel fica em `app_metadata` do Supabase Auth e é checado na RLS.
- **LGPD**: `UserDTO` nunca expõe dados pessoais além do nome; `marketingOptIn` é explícito; `deletedAt` permite exclusão lógica.

## Decisões arquiteturais (ADR resumido)

| # | Decisão | Alternativa descartada | Motivo |
|---|---|---|---|
| 1 | Monólito Next.js | Front e API separados | Um deploy, tipos compartilhados sem pacote extra |
| 2 | Server Actions + `defineAction` | tRPC | Mesma type-safety, zero dependência e zero boilerplate de router |
| 3 | Zod na borda + tipos gerados do Supabase | ORM (Prisma/Drizzle) | Supabase já dá tipos, Auth e RLS; menos peças em 48 h |
| 4 | **Web app** (React no navegador) | App para instalar (Kotlin, React Native) | Pedir instalação reduz o alcance (orientação do mentor). QR pela câmera abre direto no navegador; um código para Android e iPhone |
| 5 | `jsonb` + união discriminada para requisitos e benefícios | Tabela por tipo | Tipo novo de missão sem migração; validação garantida pelo Zod |
| 6 | Livro-razão de pontos (append-only) | Só a coluna de saldo | Auditoria, estorno e antifraude |
