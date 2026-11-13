# CONTEXT.md — Glossário do Growlithe

> Linguagem única do projeto (prática de *domain modeling* do Matt Pocock). Use **estas** palavras no código, nas specs, nas issues e no pitch. Se um termo novo surgir numa sessão de `/grill-with-docs`, ele entra aqui antes de entrar no código.

| Termo | Significado | No código |
|---|---|---|
| **Visitante** | Pessoa que usa o app no shopping | `User` |
| **Checkpoint** | Ponto físico com um QR Code do Growlithe (loja, entrada, palco) | `CheckpointId`, tabela `checkpoints` |
| **Check-in** | Scan do QR da entrada; muda a presença para "no shopping" | `Presence` `at_mall` |
| **Missão** | Desafio que dá pontos ao ser cumprido | `Mission` |
| **Requisito** | *O que* a missão pede (QR, sequência, compra, evento) | `MissionRequirement` `kind` |
| **Lançamento** | *Como* a missão chega ao visitante: semanal ou relâmpago | `MissionLaunch` `type` |
| **Missão Relâmpago** | Missão surpresa, anunciada por push, curta e com pontos multiplicados | `launch.type = "flash"` |
| **Caça ao tesouro** | Missão de vários QR Codes em ordem | `qr_scan` com `ordered: true` |
| **Sequência** | Visitas em dias seguidos | `visit_streak` |
| **Cupom fiscal** | Comprovante da compra (NFC-e, modelo 65) com QR Code da SEFAZ | `NfceQrUrl`, tabela `receipts` |
| **Chave de acesso** | Identificador de 44 posições da nota; traz CNPJ e mês | `NfceAccessKey` |
| **Pontos** | Saldo gastável em recompensas | `User.points` |
| **Pontos históricos** | Total já ganho; nunca diminui; define o nível | `User.lifetimePoints` |
| **Nível** | Bronze, Prata, Ouro, Diamante | `Tier` (derivado, nunca armazenado) |
| **Recompensa** | Prêmio trocável por pontos | `Reward` |
| **Resgate** | Troca de pontos por recompensa; gera código de 6 dígitos | `Redemption` |
| **Cupom de resgate** | O código de 6 dígitos que o lojista valida. ⚠️ Não confundir com *cupom fiscal* | `Redemption.code` |
| **Lead** | Pessoa que se cadastrou na landing page | `LandingLead` |

## Termos proibidos (ambíguos)

| Evite | Use |
|---|---|
| "cupom" sozinho | **cupom fiscal** (NFC-e) ou **cupom de resgate** (código de 6 dígitos) |
| "usuário" no pitch | **visitante** (app) ou **lojista** / **admin** (painel) |
| "nota" | **cupom fiscal** |
| "XP" | **pontos históricos** |
