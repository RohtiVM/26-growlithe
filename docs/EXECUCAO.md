# Instruções de execução

Como instalar, configurar e rodar o Growlithe do zero, inclusive com um banco Supabase próprio. Para só ver funcionando, use o site publicado: **https://growlithe-flax.vercel.app**.

## 1. Pré-requisitos

| Ferramenta | Versão | Observação |
|---|---|---|
| Node.js | 22 ou mais novo | `node -v` |
| pnpm | 9.15 | `npm install -g pnpm@9.15.0` |
| Git | qualquer recente | |
| Conta no Supabase | plano gratuito | só se for usar um banco próprio |

> **Windows (PowerShell):** o PowerShell bloqueia os atalhos `.ps1`. Use `pnpm.cmd` no lugar de `pnpm`, ou rode uma vez `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.

## 2. Baixar e instalar

```bash
git clone https://github.com/RohtiVM/26-growlithe.git
cd 26-growlithe
pnpm install
```

## 3. Banco de dados (Supabase)

O app precisa de um projeto Supabase com as migrations deste repositório aplicadas.

1. Crie um projeto em https://supabase.com (região sugerida: São Paulo).
2. **SQL Editor:** rode, **nesta ordem**, o conteúdo de cada arquivo de `supabase/migrations/` (do mais antigo para o mais novo, pelo número no nome) e depois `supabase/seed.sql` (lojas, checkpoints e recompensas de demonstração).
   Com a [Supabase CLI](https://supabase.com/docs/guides/cli), o equivalente é `supabase link` e `supabase db push`.
3. Marque o checkpoint de entrada (check-in vale 20 pontos):
   ```sql
   update public.checkpoints set is_entrance = true where label = 'Entrada principal';
   ```
4. **Authentication → URL Configuration:**
   - **Site URL:** o endereço do app (ex.: `http://localhost:3000`).
   - **Redirect URLs:** adicione `http://localhost:3000/**` e o endereço publicado com `/**`.
5. Copie a URL do projeto e a chave **publishable** (Project Settings → API keys).

O segredo que assina os QR Codes é **gerado pela própria migration** dentro do banco (`private.app_secrets`): não há nada a configurar.

## 4. Variáveis de ambiente

```bash
cp .env.example .env.local
```

Preencha as duas variáveis em `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

## 5. Rodar

```bash
pnpm dev          # desenvolvimento: http://localhost:3000
pnpm build        # versão de produção
pnpm start        # serve a versão de produção
```

## 6. Primeiro acesso ao painel (admin)

1. Abra `http://localhost:3000/painel`, informe seu e-mail e clique no link mágico que chegar.
   A tela "Você não tem acesso ao painel" é esperada: a conta acabou de ser criada sem papel.
2. No SQL Editor do Supabase, torne-se admin:
   ```sql
   select private.grant_staff('seu@email.com', 'admin', null);
   ```
   Para um lojista: `select private.grant_staff('loja@email.com', 'lojista', '<id da loja em public.stores>');`
3. Recarregue `/painel`.

## 7. Testar o fluxo completo

1. **Painel → Checkpoints:** abra o QR da "Entrada principal" e imprima (ou mostre na tela).
2. **Painel → Missões:** crie uma missão do tipo QR Code com esse checkpoint (pode ser Relâmpago, com multiplicador).
3. **Celular:** aponte a câmera para o QR → informe outro e-mail → clique no link → informe o nome → veja os pontos e a missão concluída. Depois abra `/app`.
4. **Painel → Dashboard:** confira check-ins, scans por checkpoint e a conversão do teste A/B da landing.
5. **Easter egg:** `/?easter=noite` e `/?easter=chuva`.

> O QR aponta para o endereço onde o painel foi aberto. Para testar no celular com o app rodando no computador, use o endereço publicado ou o IP do computador na rede (ex.: `http://192.168.0.10:3000`).

## 8. Verificações de qualidade

```bash
pnpm typecheck    # TypeScript strict (inclui testes de tipo)
pnpm lint         # sem any, sem as, switch exaustivo
pnpm test         # testes Vitest (regras de domínio)
pnpm test:db      # migrations + RLS + regras num Postgres temporário (precisa de Postgres 15+; roda no CI)
```

O GitHub Actions roda tudo isso em cada pull request.

## 9. Publicar (Vercel)

1. Importe o repositório na Vercel (framework Next.js detectado automaticamente).
2. Cadastre `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` em *Settings → Environment Variables*.
3. Em *Settings → Functions*, escolha a região mais perto do banco (ex.: `gru1`, São Paulo).
4. Adicione o domínio publicado nas Redirect URLs do Supabase (passo 3.4).

Cada merge na `main` publica sozinho; cada pull request ganha um link de prévia.

## Problemas comuns

| Sintoma | Causa e solução |
|---|---|
| O link mágico abre a página inicial em vez do painel | Faltou `.../**` nas Redirect URLs do Supabase |
| "Você não tem acesso ao painel" depois do login | A conta não tem papel: rode `private.grant_staff` (passo 6) |
| `pnpm : ... execução de scripts foi desabilitada` | PowerShell: use `pnpm.cmd` ou ajuste a política (passo 1) |
| QR sempre "não é do Growlithe" | O QR foi gerado em outro banco: cada projeto Supabase tem seu próprio segredo |
| Página não carrega e acusa variável ausente | `.env.local` sem as duas variáveis do passo 4 |
