# ADR-001, Stack: React + Vite + Supabase + Vercel, como PWA

**Status:** Aceito
**Data:** 2026-11-25
**Decisores:** Matheus

## Contexto
O sistema precisa funcionar igual no celular e no computador, sincronizar os dados entre os dois, ter login, guardar dados financeiros com isolamento forte e rodar tarefas agendadas (revisão de notícias às 8h30). Fase bootstrap: custo zero, exceto a IA (ADR-004). O Matheus já domina essa stack em outros projetos da Kora.

## Decisão
- Front: React + Vite + TypeScript, como PWA instalável.
- Backend: Supabase (Auth, Postgres com RLS, Edge Functions em Deno, pg_cron).
- Rotas: React Router. Estado: Context API.
- Deploy: Vercel (Hobby).

## Alternativas consideradas
1. **Evoluir o artifact atual.** Prós: zero deploy, já existe. Contras: sem banco relacional, sem tarefa agendada, sem RLS, estado como HTML republicado. Descartado para o sistema definitivo, mantido como ferramenta da Fase 0.
2. **Local-first no PC.** Prós: dados só no computador. Contras: sem uso no celular, sem cron confiável, backup manual. Descartado pelo uso em dois aparelhos.
3. **API própria (Node + Postgres).** Prós: controle total. Contras: mais infraestrutura sem necessidade para um usuário. Descartado.

## Consequências
- Positivas: sincronização nativa, RLS por usuário, cron e Edge Functions no mesmo lugar, custo zero.
- Negativas: dependência do Supabase (mitigada: Postgres puro, exportável); projeto Free pode pausar por inatividade (mitigado em `memory/restrictions.md`).
- Offline: a Fase 1 exige conexão. Fila offline de lançamentos fica no backlog.

## Referências
- `docs/01_ARQUITETURA/`
- `memory/restrictions.md`
