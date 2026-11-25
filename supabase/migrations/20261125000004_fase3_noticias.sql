-- Rota do Milhão, Fase 3: revisão de notícias por IA (ADR-004, IA-01 a IA-05) e calendário da B3

-- =========================================================
-- Calendário da B3. Global (não é dado do usuário): leitura para todos, escrita só por migration.
-- =========================================================
create table public.feriado_b3 (
  data date primary key,
  descricao text not null,
  -- nacional = feriado bancário também (conta para o vencimento do DARF); 24/12 e 31/12 só fecham a bolsa
  nacional boolean not null,
  confirmado boolean not null default false
);

-- Datas do calendário legal (Páscoa 2027 = 28/03). Conferir com o calendário oficial da B3 todo ano.
insert into public.feriado_b3 (data, descricao, nacional) values
  ('2026-12-24', 'Véspera de Natal (sem pregão)', false),
  ('2026-12-25', 'Natal', true),
  ('2026-12-31', 'Último dia do ano (sem pregão)', false),
  ('2027-01-01', 'Confraternização Universal', true),
  ('2027-02-08', 'Carnaval', true),
  ('2027-02-09', 'Carnaval', true),
  ('2027-03-26', 'Sexta-feira Santa', true),
  ('2027-04-21', 'Tiradentes', true),
  ('2027-05-01', 'Dia do Trabalho', true),
  ('2027-05-27', 'Corpus Christi', true),
  ('2027-09-07', 'Independência', true),
  ('2027-10-12', 'Nossa Senhora Aparecida', true),
  ('2027-11-02', 'Finados', true),
  ('2027-11-15', 'Proclamação da República', true),
  ('2027-11-20', 'Dia da Consciência Negra', true),
  ('2027-12-24', 'Véspera de Natal (sem pregão)', false),
  ('2027-12-25', 'Natal', true),
  ('2027-12-31', 'Último dia do ano (sem pregão)', false);

alter table public.feriado_b3 enable row level security;
create policy leitura on public.feriado_b3 for select to authenticated using (true);
revoke all on public.feriado_b3 from anon, authenticated;
grant select on public.feriado_b3 to authenticated;

-- Dia de pregão: segunda a sexta, fora dos feriados da B3
create function public.e_dia_pregao(d date) returns boolean
language sql stable set search_path = '' as $$
  select extract(isodow from d) < 6 and not exists (select 1 from public.feriado_b3 f where f.data = d)
$$;

-- As travas reabrem no próximo dia de pregão, não só no próximo dia de semana (TR-05)
create or replace function public.proximo_dia_util(d date) returns date
language plpgsql stable set search_path = '' as $$
declare x date := d + 1;
begin
  while not public.e_dia_pregao(x) loop x := x + 1; end loop;
  return x;
end $$;

create or replace function public.primeiro_dia_util(d date) returns date
language plpgsql stable set search_path = '' as $$
declare x date := d;
begin
  while not public.e_dia_pregao(x) loop x := x + 1; end loop;
  return x;
end $$;

-- =========================================================
-- Watchlist (IA-01: no máximo 10 ativos ativos)
-- =========================================================
create table public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  ativo text not null check (ativo ~ '^[A-Z0-9]{3,12}$'),
  mercado text not null check (mercado in ('acoes', 'mini_indice')),
  ativa boolean not null default true,
  unique (user_id, ativo)
);

create function public.validar_watchlist() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.ativa and (select count(*) from public.watchlist w where w.user_id = new.user_id and w.ativa and w.id <> new.id) >= 10 then
    raise exception 'A watchlist tem no máximo 10 ativos ativos (IA-01).' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger watchlist_validar before insert or update on public.watchlist
  for each row execute function public.validar_watchlist();

-- =========================================================
-- Revisão de notícias e uso da IA. Só a Edge Function (service_role) grava.
-- =========================================================
create table public.revisao_noticias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  data date not null,
  gerada_em timestamptz not null default now(),
  origem text not null check (origem in ('agendada', 'manual')),
  modelo text,
  versao_prompt text not null,
  conteudo jsonb, -- ativos: resumo, possível impacto, riscos
  agenda jsonb,
  contexto_geral text,
  fontes jsonb,   -- IA-04
  custo_estimado_centavos bigint not null default 0 check (custo_estimado_centavos >= 0),
  status text not null check (status in ('ok', 'sem_orcamento', 'erro')),
  aviso_orcamento boolean not null default false, -- IA-03: 80% do teto
  erro text check (erro is null or char_length(erro) <= 300)
);
create index revisao_user_data on public.revisao_noticias (user_id, data desc, gerada_em desc);

create table public.uso_ia (
  user_id uuid not null references auth.users on delete cascade,
  mes date not null check (extract(day from mes) = 1),
  chamadas int not null default 0,
  tokens_entrada bigint not null default 0,
  tokens_saida bigint not null default 0,
  buscas int not null default 0,
  custo_estimado_centavos bigint not null default 0,
  primary key (user_id, mes)
);

-- Soma atômica do uso (IA-03). Só o service_role executa.
create function public.registrar_uso_ia(p_user uuid, p_mes date, p_tokens_entrada bigint, p_tokens_saida bigint, p_buscas int, p_custo bigint)
returns bigint language sql security definer set search_path = '' as $$
  insert into public.uso_ia (user_id, mes, chamadas, tokens_entrada, tokens_saida, buscas, custo_estimado_centavos)
  values (p_user, p_mes, 1, p_tokens_entrada, p_tokens_saida, p_buscas, p_custo)
  on conflict (user_id, mes) do update set
    chamadas = public.uso_ia.chamadas + 1,
    tokens_entrada = public.uso_ia.tokens_entrada + excluded.tokens_entrada,
    tokens_saida = public.uso_ia.tokens_saida + excluded.tokens_saida,
    buscas = public.uso_ia.buscas + excluded.buscas,
    custo_estimado_centavos = public.uso_ia.custo_estimado_centavos + excluded.custo_estimado_centavos
  returning custo_estimado_centavos
$$;

alter table public.watchlist enable row level security;
alter table public.revisao_noticias enable row level security;
alter table public.uso_ia enable row level security;

create policy dono_select on public.watchlist for select to authenticated using (public.e_dono(user_id));
create policy dono_insert on public.watchlist for insert to authenticated with check (public.e_dono(user_id));
create policy dono_update on public.watchlist for update to authenticated using (public.e_dono(user_id)) with check (public.e_dono(user_id));
create policy dono_delete on public.watchlist for delete to authenticated using (public.e_dono(user_id));
create policy dono_select on public.revisao_noticias for select to authenticated using (public.e_dono(user_id));
create policy dono_select on public.uso_ia for select to authenticated using (public.e_dono(user_id));

revoke all on public.watchlist, public.revisao_noticias, public.uso_ia from anon, authenticated;
grant select, insert, update, delete on public.watchlist to authenticated;
grant select on public.revisao_noticias, public.uso_ia to authenticated;
-- A Edge Function (service_role) lê a watchlist, o calendário e o uso, e grava revisões. O uso só pela função atômica.
grant select on public.watchlist, public.feriado_b3, public.uso_ia to service_role;
grant select, insert on public.revisao_noticias to service_role;

-- =========================================================
-- IA-05: a operação pode vincular a revisão do dia
-- =========================================================
alter table public.operacao
  add constraint operacao_revisao_fk foreign key (revisao_noticias_id) references public.revisao_noticias on delete restrict;

create function public.validar_revisao_da_operacao() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.revisao_noticias_id is not null and not exists (
    select 1 from public.revisao_noticias r where r.id = new.revisao_noticias_id and r.user_id = new.user_id and r.status = 'ok'
  ) then
    raise exception 'Revisão de notícias não encontrada.' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger operacao_revisao_validar before insert on public.operacao
  for each row execute function public.validar_revisao_da_operacao();

revoke execute on all functions in schema public from anon, public;
revoke execute on function public.registrar_uso_ia(uuid, date, bigint, bigint, int, bigint) from authenticated;
grant execute on function public.registrar_uso_ia(uuid, date, bigint, bigint, int, bigint), public.hoje_sp(), public.e_dia_pregao(date) to service_role;
grant execute on function public.e_dia_pregao(date), public.proximo_dia_util(date), public.primeiro_dia_util(date),
  public.status_travas(date), public.hoje_sp(), public.capital_trade_do_periodo(uuid, date, date), public.parametros_vigentes(uuid, date),
  public.meta_reserva(uuid), public.e_dono(uuid), public.abrir_orcamento_mes(date) to authenticated;
