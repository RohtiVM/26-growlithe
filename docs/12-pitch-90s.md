# 12 · Pitch em vídeo de 90 segundos

> Entrega de 14/11 (HackaRun 2026, Shopping Capim Dourado). Este documento resume e explica o que é dito no vídeo, bloco a bloco, e mostra onde cada afirmação está no MVP.
>
> ⚠️ **RASCUNHO** — falta conferir com o vídeo gravado.

## Estrutura

O roteiro segue a "Régua dos 90 segundos" da mentoria: apresentação, problema, solução e MVP. O apresentador fala direto para a câmera.

| Bloco | Tempo | Pergunta que responde |
|---|---|---|
| 1. Apresentação | ~15s | Quem somos e qual é o projeto? |
| 2. Problema | ~33s | Qual situação precisa ser resolvida e quem é afetado? |
| 3. Solução | ~24s | O que o grupo propõe? |
| 4. MVP | ~18s | O que já foi construído e como funciona na prática? |

## 1. Apresentação

> "Olá! Somos o Time 26: Bruno, Jhuan, Ricardo e Vithor. E este é o Growlithe: missões que fazem você voltar ao shopping."

**O que significa:** o nome e a frase de efeito já dizem o objetivo do produto, que é fazer o visitante **voltar**. É o tema do desafio 05 (engajamento e fidelização).

## 2. Problema

> "Por que um shopping precisa ter vínculo com as pessoas? Segundo Philip Kotler, referência em marketing, conquistar um novo cliente custa de 5 a 7 vezes mais do que manter um atual. Só que o shopping costuma ser mais caro, e com o poder de compra apertado, muita gente só vai quando precisa: entra, compra e vai embora. Não tem motivo para voltar, e o shopping nem sabe quem veio."

**O que significa, em três passos:**

1. **Por que importa (valor financeiro):** a frase atribuída a Philip Kotler, professor e referência mundial em marketing, mostra que fidelizar sai muito mais barato do que atrair alguém novo. Para o shopping, perder o visitante custa caro.
2. **Por que as pessoas não voltam (poder de compra):** o shopping costuma ter preços mais altos. Com o orçamento apertado, a visita vira uma obrigação de gastar: a pessoa só vai quando precisa e vai embora logo depois.
3. **O que o shopping perde (falta de dados):** sem relacionamento, o Capim Dourado não sabe quem veio, com que frequência, nem quais ações funcionam.

**Quem é afetado:** o visitante, que não tem motivo para passear; o lojista, sobretudo de alas menos movimentadas, que não recebe fluxo; e o shopping, que perde receita e informação.

> **Sobre a citação:** a estatística "5 a 7 vezes" é amplamente citada e associada a Kotler em seus livros de marketing (por exemplo, *Administração de Marketing*). No vídeo usamos "segundo Philip Kotler", sem apresentá-la como citação literal.

## 3. Solução

> "O Growlithe é um web app que abre pela câmera do celular, sem instalar nada. O visitante escaneia QR Codes, cumpre missões e ganha pontos só por passear, sem precisar gastar. E com a Missão Relâmpago, o shopping movimenta uma ala vazia em minutos."

**O que significa:**

- **Sem instalar nada:** a câmera nativa do celular lê o QR e abre o app no navegador. Isso elimina a maior barreira dos programas de fidelidade em aplicativo.
- **Pontos só por passear, sem precisar gastar:** esta frase responde ao problema do poder de compra. O Growlithe recompensa **comportamento** (circular, voltar, ir a eventos), não só gasto. Assim o visitante tem um motivo para ir ao shopping mesmo quando não vai comprar.
- **Missão Relâmpago:** um desafio surpresa, curto e com pontos multiplicados. É a ferramenta do marketing para levar gente a uma ala ou loja num horário de pouco movimento.

## 4. MVP

> "Nosso MVP já está no ar: o visitante escaneia e ganha pontos, e o shopping cria missões e acompanha tudo num dashboard. Aponte a câmera para o QR na tela e experimente!"

**O que significa:** tudo o que o vídeo afirma já funciona em produção, em **https://growlithe-flax.vercel.app**.

| Afirmação no vídeo | Onde está no MVP | Spec |
|---|---|---|
| "O visitante escaneia e ganha pontos" | Scan do QR com pontos na hora, login por link mágico, Home com saldo, nível e presença | 004 |
| "Cumpre missões" | Caça ao tesouro em ordem, check-in em evento, Missão Relâmpago com multiplicador | 004 |
| "O shopping cria missões" | `/painel/missoes`: criar, listar e encerrar | 003 |
| "Imprime os QR Codes" (no corte do painel) | `/painel/checkpoints`: cadastrar ponto e imprimir QR assinado | 003 |
| "Acompanha tudo num dashboard" | `/painel/dashboard`: check-ins, visitantes, scans por checkpoint, resultado das ações | 003 |
| "Aponte a câmera e experimente" | Modo avaliador: a banca testa sem e-mail | 008 |

## O que o vídeo não diz (de propósito)

Para não prometer o que ainda não está pronto, o vídeo **não** afirma:

- **Validação da compra pelo QR do cupom fiscal (NFC-e).** Está especificada e modelada (spec 001), e a leitura da chave já é testada, mas o fluxo não está implementado. É o próximo passo.
- **O visitante trocar pontos por prêmio no app.** O painel já valida o cupom de resgate de 6 dígitos, mas a tela de catálogo e resgate do visitante ainda não existe.

## Como o vídeo atende aos critérios da avaliação

| Critério | Peso | Onde aparece |
|---|---|---|
| Resolução do problema | 25 | Problema do vínculo e do poder de compra respondido por "pontos só por passear" |
| Qualidade da implementação | 25 | MVP no ar, testado pela banca na hora |
| Inovação e viabilidade | 20 | Sem instalação, sem integração com lojistas, Missão Relâmpago |
| Experiência do usuário | 15 | Abre pela câmera, sem cadastro com senha |
| Apresentação e pitch | 15 | Régua de 90s, rosto na câmera, dado de autoridade (Kotler) |
