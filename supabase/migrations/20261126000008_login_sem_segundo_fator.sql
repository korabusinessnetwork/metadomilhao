-- ADR-005 (2026-11-26): o dono decidiu que o login é só com e-mail e senha.
-- As regras de acesso deixam de exigir sessão com segundo fator (aal2); o isolamento por dono continua igual.
create or replace function public.e_dono(dono uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select dono = (select auth.uid())
$$;
