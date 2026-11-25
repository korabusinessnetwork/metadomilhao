# ADR-002, Usuário único, sem multi-tenant

**Status:** Aceito
**Data:** 2026-11-25
**Decisores:** Matheus

## Contexto
O padrão da fundação Kora pede multi-tenant e white-label desde a linha 1. O Rota do Milhão é uma ferramenta pessoal, usada só pelo Matheus, sem plano de virar produto.

## Decisão
- Sem tabela de tenant, sem white-label, sem planos ou feature flags por cliente.
- Toda tabela mantém `user_id` com RLS `user_id = auth.uid()` em select, insert, update e delete.
- Cadastro público desativado no Supabase Auth: só a conta do dono existe.

## Alternativas consideradas
1. **Multi-tenant completo.** Prós: pronto para virar SaaS. Contras: complexidade sem uso real. Descartado.
2. **Sem `user_id` e sem RLS.** Prós: mais simples. Contras: qualquer erro de configuração expõe tudo. Descartado.

## Consequências
- Positivas: modelagem enxuta, segurança equivalente a multi-tenant para dados de uma pessoa.
- Negativas: se um dia virar produto, precisa de ADR novo e migração para tenant. O `user_id` em todas as tabelas reduz esse custo.
