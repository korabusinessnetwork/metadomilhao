# Rota do Milhão

Sistema financeiro pessoal do Matheus: orçamento, metas diárias, mensais e anuais, plano até o primeiro milhão, carteira de investimentos e diário detalhado de day trade com revisão de notícias por IA antes do pregão.

**Estado:** Fases 1 (MVP financeiro) e 2 (diário de trade) construídas e testadas no ambiente local. Falta publicar (Supabase na nuvem + Vercel).
**Início da sistemática:** depois da mudança de moradia, prevista para fevereiro de 2027.

## Rodar localmente

Precisa de Node 20+, Docker e a Supabase CLI.

```bash
npm install
supabase start          # banco local nas portas 553xx (54xxx fica para outros projetos)
cp .env.example .env.local   # preencha com API_URL e ANON_KEY de `supabase status`
npm run dev
```

O cadastro público é desligado. No ambiente local, crie o usuário com `scripts/criar-usuario-local.mjs` (instruções no próprio arquivo). No primeiro acesso o app pede o segundo fator (TOTP): sem ele, o banco não libera nenhum dado.

## Testes

```bash
npm test            # regras puras (M, P, PL, O, F, T, TR, IR), dinheiro, datas, CSV
npm run test:db     # banco: RLS, MFA, só inclusão, estorno, fechamento, O-02, travas (ADR-003), T-04, T-08, P-02, P-04
npm run build       # typecheck + build do PWA
```

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
