# Rota do Milhão

Sistema financeiro pessoal do Matheus: orçamento, metas diárias, mensais e anuais, plano até o primeiro milhão, carteira de investimentos e diário detalhado de day trade com revisão de notícias por IA antes do pregão.

**Estado:** Fases 1 (MVP financeiro), 2 (diário de trade) e 3 (revisão de notícias por IA) construídas e testadas no ambiente local, mais a fila offline de gastos da Fase 4. Falta publicar (Supabase na nuvem + Vercel) e ligar a chave da API do Claude.
**Início da sistemática:** depois da mudança de moradia, prevista para fevereiro de 2027.

## Rodar localmente

Precisa de Node 20+, Docker e a Supabase CLI.

```bash
npm install
supabase start          # banco local nas portas 553xx (54xxx fica para outros projetos)
cp .env.example .env.local   # preencha com API_URL e ANON_KEY de `supabase status`
npm run dev
```

O cadastro público é desligado. No ambiente local, crie o usuário com `scripts/criar-usuario-local.mjs` (instruções no próprio arquivo). O login é só com e-mail e senha (ADR-005).

## Revisão de notícias (Fase 3)

```bash
cp supabase/functions/.env.example supabase/functions/.env   # preencha os valores
supabase functions serve revisao-noticias --env-file supabase/functions/.env
```

Para testar sem gastar: `node scripts/api-falsa-anthropic.mjs`, `ANTHROPIC_BASE_URL=http://host.docker.internal:8787` no `.env` e `bash scripts/e2e-revisao.sh`.
Em produção: `supabase secrets set --env-file supabase/functions/.env`, `supabase functions deploy revisao-noticias` e o SQL de `supabase/agendamento.sql` uma vez.

## Testes

```bash
npm test            # regras puras (M, P, PL, O, F, T, TR, IR, IA), dinheiro, datas, CSV
npm run test:db     # banco: RLS, só inclusão, estorno, fechamento, O-02, travas (ADR-003), T-04, T-08, P-02, P-04, calendário, IA-01, IA-05
npm run build       # typecheck + build do PWA
```

## Publicar (Supabase Free + Vercel Hobby, custo zero)

Em produção desde 26/11/2026: https://rota-do-milhao-ochre.vercel.app (Supabase `rota-do-milhao`, São Paulo). O projeto da Vercel está ligado ao GitHub: todo push no `master` publica sozinho. O passo a passo abaixo serve para recriar do zero.

1. **Supabase:** criar um projeto Free (região São Paulo). Depois, na pasta do projeto:
   ```bash
   supabase login
   supabase link --project-ref <ref-do-projeto>
   supabase db push            # aplica as migrations de supabase/migrations
   ```
2. **Auth, no painel do Supabase:** desligar "Allow new users to sign up"; senha mínima de 12 com letras, números e símbolos. Criar a conta do dono em Authentication, Users, Add user (com "Auto Confirm User").
3. **Vercel:** importar o repositório do GitHub (o `vercel.json` já traz build, reescrita de rotas e cabeçalhos de segurança). Em Environment Variables, só `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (Project Settings, API, no Supabase). Nunca a service_role.
4. **Revisão de notícias:** ver "Revisão de notícias" acima (secrets, deploy da função e `supabase/agendamento.sql`). Trocar `ORIGEM_APP` pela URL da Vercel.
5. **Conferir antes de publicar:** `npm run build && node scripts/servir-como-vercel.mjs 5182 http://127.0.0.1:55321` serve o build com os mesmos cabeçalhos; o console do navegador não deve mostrar bloqueio de CSP.

Se trocar o domínio do Supabase por um próprio, inclua-o no `connect-src` do `vercel.json`.

## Por onde começar

1. `CLAUDE.md`: a constituição (princípios, segurança, custo, stack).
2. `memory/identity.md`: o que o produto é e para que serve.
3. `docs/03_REGRAS_DE_NEGOCIO/`: as regras de metas, travas e trade.
4. `docs/08_DECISOES/`: as decisões tomadas (ADR-001 a ADR-004).
5. `docs/09_BACKLOG/`: o que vem em cada fase.

## Mapa

| Pasta | Conteúdo |
|---|---|
| `memory/` | identidade, decisões, padrões, aprendizados, restrições, bugs |
| `docs/00_VISAO` | visão, problema, métricas de sucesso |
| `docs/01_ARQUITETURA` | camadas, Edge Functions, agendamentos |
| `docs/02_DESIGN_SYSTEM` | cores, tipografia, padrões de tela |
| `docs/03_REGRAS_DE_NEGOCIO` | metas, travas, trade, IR, prioridade do dinheiro |
| `docs/04_MODELAGEM` | entidades e campos |
| `docs/05_FLUXOS` | rotina diária, fechamento mensal, revisão anual |
| `docs/06_COMPONENTES` | telas e componentes |
| `docs/07_APIS` | Edge Functions e contratos |
| `docs/08_DECISOES` | ADRs |
| `docs/09_BACKLOG` | fases e entregas |
| `docs/10_PROMPTS` | prompt da revisão de notícias |
| `docs/11_SEGURANCA` | plano de segurança e checklist |

> As projeções deste sistema são matemáticas, não promessa de rendimento. Não é recomendação de investimento.
