-- KORA TRADER saiu do escopo do Rota do Milhão (decisão do dono em 2026-11-25: é outro produto).
-- A origem de uma operação passa a ser só registro manual ou importação do MT5.
alter table public.operacao drop constraint operacao_origem_check;
alter table public.operacao add constraint operacao_origem_check check (origem in ('manual', 'mt5'));
