-- Rota do Milhão, Fase 1: MVP financeiro
-- Regras citadas: docs/03_REGRAS_DE_NEGOCIO. Modelagem: docs/04_MODELAGEM.
-- Dinheiro sempre em centavos (bigint). Toda tabela tem user_id com RLS de dono (ADR-002).

-- =========================================================
-- Perfil e plano
-- =========================================================
create table public.perfil (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  nome text not null check (char_length(nome) between 1 and 80),
  data_mudanca date,
  dia_fechamento smallint not null default 1 check (dia_fechamento between 1 and 28),
  fuso text not null default 'America/Sao_Paulo' check (fuso = 'America/Sao_Paulo'),
  criado_em timestamptz not null default now()
);

create table public.plano_milhao (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  meta_centavos bigint not null default 100000000 check (meta_centavos > 0),
  taxa_real_mensal numeric(6,4) not null default 0.0045 check (taxa_real_mensal >= 0 and taxa_real_mensal < 0.05),
  aporte_atual_centavos bigint not null default 0 check (aporte_atual_centavos >= 0),
  aporte_pos_mudanca_centavos bigint not null default 0 check (aporte_pos_mudanca_centavos >= 0),
  pct_lucro_trade_para_aporte smallint not null default 70 check (pct_lucro_trade_para_aporte between 0 and 100),
  atualizado_em timestamptz not null default now()
);

-- =========================================================
-- Orçamento (O-01, O-02, O-03)
-- =========================================================
create table public.categoria (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null check (char_length(nome) between 1 and 40),
  tipo text not null check (tipo in ('fixa', 'variavel')),
  ativa boolean not null default true,
  ordem smallint not null default 0,
  estimativa boolean not null default false,
  unique (user_id, nome)
);

create table public.orcamento_mes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  mes date not null check (extract(day from mes) = 1),
  renda_prevista_centavos bigint not null default 0 check (renda_prevista_centavos >= 0),
  travado_em timestamptz,
  unique (user_id, mes)
);

create table public.orcamento_item (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  orcamento_mes_id uuid not null references public.orcamento_mes on delete cascade,
  categoria_id uuid not null references public.categoria on delete restrict,
  valor_centavos bigint not null check (valor_centavos >= 0),
  unique (orcamento_mes_id, categoria_id)
);

-- O-02: depois do dia 5, toda mudança no orçamento fica registrada aqui.
create table public.orcamento_historico (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  orcamento_mes_id uuid not null references public.orcamento_mes on delete cascade,
  categoria_id uuid not null references public.categoria on delete restrict,
  valor_anterior_centavos bigint,
  valor_novo_centavos bigint,
  alterado_em timestamptz not null default now()
);

-- =========================================================
-- Renda e lançamentos (O-04, O-05)
-- =========================================================
create table public.renda (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  mes date not null check (extract(day from mes) = 1),
  fonte text not null check (fonte in ('salario', 'renda_extra', 'outro')),
  valor_centavos bigint not null check (valor_centavos > 0),
  recebido_em date not null,
  criado_em timestamptz not null default now()
);

create table public.lancamento (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  data date not null,
  categoria_id uuid not null references public.categoria on delete restrict,
  valor_centavos bigint not null check (valor_centavos <> 0),
  descricao text check (descricao is null or char_length(descricao) <= 120),
  estorno_de uuid unique references public.lancamento on delete restrict,
  criado_em timestamptz not null default now(),
  -- O-04 e O-05: valor negativo só em estorno, e estorno sempre negativo
  constraint lancamento_sinal check ((estorno_de is null and valor_centavos > 0) or (estorno_de is not null and valor_centavos < 0))
);
create index lancamento_user_data on public.lancamento (user_id, data);

-- O-05: o estorno anula exatamente o original, do mesmo dono, e não se estorna um estorno.
create function public.validar_estorno() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  original public.lancamento%rowtype;
begin
  if new.estorno_de is null then
    return new;
  end if;
  select * into original from public.lancamento where id = new.estorno_de;
  if not found or original.user_id <> new.user_id then
    raise exception 'Lançamento original não encontrado.' using errcode = 'P0001';
  end if;
  if original.estorno_de is not null then
    raise exception 'Não é possível estornar um estorno.' using errcode = 'P0001';
  end if;
  if new.valor_centavos <> -original.valor_centavos or new.categoria_id <> original.categoria_id then
    raise exception 'O estorno precisa ter o valor oposto e a mesma categoria do original.' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger lancamento_validar_estorno before insert on public.lancamento
  for each row execute function public.validar_estorno();

-- =========================================================
-- Carteira (P-01 a P-04). Saldo = soma dos movimentos, sem campo editável.
-- =========================================================
create table public.ativo_carteira (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null check (char_length(nome) between 1 and 60),
  classe text not null check (classe in ('reserva', 'renda_fixa', 'fii', 'acoes', 'capital_trade', 'outro')),
  instituicao text check (instituicao is null or char_length(instituicao) <= 60),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table public.movimento_carteira (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  ativo_id uuid not null references public.ativo_carteira on delete restrict,
  data date not null,
  tipo text not null check (tipo in ('aporte', 'resgate', 'rendimento', 'ajuste_saldo')),
  valor_centavos bigint not null check (valor_centavos <> 0),
  criado_em timestamptz not null default now(),
  -- aporte entra positivo, resgate sai negativo; rendimento e ajuste podem ter qualquer sinal
  constraint movimento_sinal check (
    (tipo = 'aporte' and valor_centavos > 0) or
    (tipo = 'resgate' and valor_centavos < 0) or
    (tipo in ('rendimento', 'ajuste_saldo'))
  )
);
create index movimento_user_ativo on public.movimento_carteira (user_id, ativo_id, data);

-- O ativo do movimento precisa ser do mesmo dono.
create function public.validar_dono_ativo() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.ativo_carteira a where a.id = new.ativo_id and a.user_id = new.user_id) then
    raise exception 'Ativo não encontrado.' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger movimento_validar_dono before insert on public.movimento_carteira
  for each row execute function public.validar_dono_ativo();

-- P-02: na Fase 1 não existe transferência para capital de trade antes da reserva completa.
-- A regra completa (com a meta P-03) entra na Fase 2, junto com a conta de trade.

-- =========================================================
-- Fechamento mensal (PL-04, PL-05, M-06). Imutável: correção gera novo registro.
-- =========================================================
create table public.fechamento_mes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  mes date not null check (extract(day from mes) = 1),
  renda_real bigint not null check (renda_real >= 0),
  gasto_real bigint not null check (gasto_real >= 0),
  aporte_real bigint not null,
  patrimonio_real bigint not null,
  patrimonio_projetado bigint not null,
  meta_batida boolean not null,
  violacoes_trava int not null default 0 check (violacoes_trava >= 0),
  notas text check (notas is null or char_length(notas) <= 2000),
  substitui uuid unique references public.fechamento_mes on delete restrict,
  criado_em timestamptz not null default now()
);
create index fechamento_user_mes on public.fechamento_mes (user_id, mes);

-- Só um fechamento vigente por mês: um novo para o mesmo mês precisa substituir o vigente.
create function public.validar_fechamento() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  vigente uuid;
begin
  select f.id into vigente from public.fechamento_mes f
   where f.user_id = new.user_id and f.mes = new.mes
     and not exists (select 1 from public.fechamento_mes s where s.substitui = f.id);
  if vigente is not null and new.substitui is distinct from vigente then
    raise exception 'Este mês já foi fechado. Para corrigir, registre uma substituição.' using errcode = 'P0001';
  end if;
  if vigente is null and new.substitui is not null then
    raise exception 'Fechamento a substituir não encontrado.' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger fechamento_validar before insert on public.fechamento_mes
  for each row execute function public.validar_fechamento();

-- =========================================================
-- O-02: histórico de mudanças no orçamento depois do dia 5
-- =========================================================
-- security definer: o histórico é escrito só por este trigger, o usuário não grava nele direto.
create function public.registrar_mudanca_orcamento() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  mes_ref date;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select o.mes into mes_ref from public.orcamento_mes o
   where o.id = coalesce(new.orcamento_mes_id, old.orcamento_mes_id);
  if hoje > mes_ref + 4 then
    insert into public.orcamento_historico (user_id, orcamento_mes_id, categoria_id, valor_anterior_centavos, valor_novo_centavos)
    values (
      coalesce(new.user_id, old.user_id),
      coalesce(new.orcamento_mes_id, old.orcamento_mes_id),
      coalesce(new.categoria_id, old.categoria_id),
      case when tg_op = 'INSERT' then null else old.valor_centavos end,
      case when tg_op = 'DELETE' then null else new.valor_centavos end
    );
    update public.orcamento_mes set travado_em = coalesce(travado_em, now())
     where id = coalesce(new.orcamento_mes_id, old.orcamento_mes_id);
  end if;
  return coalesce(new, old);
end $$;

create trigger orcamento_item_historico
  after insert or update of valor_centavos or delete on public.orcamento_item
  for each row execute function public.registrar_mudanca_orcamento();

-- O item e a categoria precisam ser do mesmo dono do orçamento.
create function public.validar_dono_item() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.orcamento_mes o where o.id = new.orcamento_mes_id and o.user_id = new.user_id)
     or not exists (select 1 from public.categoria c where c.id = new.categoria_id and c.user_id = new.user_id) then
    raise exception 'Orçamento ou categoria não encontrados.' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger orcamento_item_validar_dono before insert or update on public.orcamento_item
  for each row execute function public.validar_dono_item();

create function public.validar_dono_lancamento() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.categoria c where c.id = new.categoria_id and c.user_id = new.user_id) then
    raise exception 'Categoria não encontrada.' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger lancamento_validar_dono before insert on public.lancamento
  for each row execute function public.validar_dono_lancamento();

-- =========================================================
-- O-02: abrir o mês copiando o orçamento do mês anterior
-- =========================================================
create function public.abrir_orcamento_mes(p_mes date) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  novo uuid;
  anterior public.orcamento_mes%rowtype;
begin
  if extract(day from p_mes) <> 1 then
    raise exception 'O mês precisa começar no dia 1.' using errcode = 'P0001';
  end if;
  select id into novo from public.orcamento_mes where user_id = auth.uid() and mes = p_mes;
  if novo is not null then
    return novo;
  end if;
  select * into anterior from public.orcamento_mes
   where user_id = auth.uid() and mes < p_mes order by mes desc limit 1;
  insert into public.orcamento_mes (mes, renda_prevista_centavos)
  values (p_mes, coalesce(anterior.renda_prevista_centavos, 0))
  returning id into novo;
  if anterior.id is not null then
    insert into public.orcamento_item (orcamento_mes_id, categoria_id, valor_centavos)
    select novo, i.categoria_id, i.valor_centavos
      from public.orcamento_item i join public.categoria c on c.id = i.categoria_id
     where i.orcamento_mes_id = anterior.id and c.ativa;
  end if;
  return novo;
end $$;

-- =========================================================
-- Views (security_invoker: o RLS de quem consulta vale)
-- =========================================================
create view public.v_saldo_ativo with (security_invoker = true) as
select a.id as ativo_id, a.user_id, a.nome, a.classe, a.instituicao, a.ativo,
       coalesce(sum(m.valor_centavos), 0)::bigint as saldo_centavos
  from public.ativo_carteira a
  left join public.movimento_carteira m on m.ativo_id = a.id
 group by a.id;

-- M-07 a M-09 no banco, para conferir a função pura do cliente.
create view public.v_limite_gasto_hoje with (security_invoker = true) as
with hoje as (
  select (now() at time zone 'America/Sao_Paulo')::date as d
), base as (
  select o.user_id,
         h.d as hoje,
         (date_trunc('month', h.d) + interval '1 month - 1 day')::date - h.d + 1 as dias_restantes,
         coalesce((select sum(i.valor_centavos) from public.orcamento_item i
                     join public.categoria c on c.id = i.categoria_id
                    where i.orcamento_mes_id = o.id and c.tipo = 'variavel'), 0) as orcamento_variavel,
         coalesce((select sum(l.valor_centavos) from public.lancamento l
                     join public.categoria c on c.id = l.categoria_id
                    where l.user_id = o.user_id and c.tipo = 'variavel'
                      and l.data >= o.mes and l.data < h.d), 0) as gasto_ate_ontem,
         coalesce((select sum(l.valor_centavos) from public.lancamento l
                     join public.categoria c on c.id = l.categoria_id
                    where l.user_id = o.user_id and c.tipo = 'variavel' and l.data = h.d), 0) as gasto_hoje
    from public.orcamento_mes o, hoje h
   where o.mes = date_trunc('month', h.d)::date
)
select user_id, hoje, dias_restantes,
       floor(greatest(0, orcamento_variavel - gasto_ate_ontem)::numeric / dias_restantes)::bigint as limite_hoje_centavos,
       gasto_hoje::bigint as gasto_hoje_centavos
  from base;

-- Fechamentos vigentes (os que não foram substituídos)
create view public.v_fechamento_vigente with (security_invoker = true) as
select f.* from public.fechamento_mes f
 where not exists (select 1 from public.fechamento_mes s where s.substitui = f.id);

-- =========================================================
-- RLS: dono em toda tabela. Tabelas só de inclusão não têm política de update/delete.
-- =========================================================
-- Dono da linha e sessão com segundo fator verificado (docs/11_SEGURANCA: MFA obrigatório)
create function public.e_dono(dono uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select dono = (select auth.uid()) and coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
$$;

alter table public.perfil enable row level security;
alter table public.plano_milhao enable row level security;
alter table public.categoria enable row level security;
alter table public.orcamento_mes enable row level security;
alter table public.orcamento_item enable row level security;
alter table public.orcamento_historico enable row level security;
alter table public.renda enable row level security;
alter table public.lancamento enable row level security;
alter table public.ativo_carteira enable row level security;
alter table public.movimento_carteira enable row level security;
alter table public.fechamento_mes enable row level security;

do $$
declare t text;
begin
  -- Tabelas editáveis: as 4 operações, só do dono e só com MFA verificado (aal2)
  foreach t in array array['perfil', 'plano_milhao', 'categoria', 'orcamento_mes', 'orcamento_item', 'renda', 'ativo_carteira'] loop
    execute format('create policy dono_select on public.%I for select to authenticated using (public.e_dono(user_id))', t);
    execute format('create policy dono_insert on public.%I for insert to authenticated with check (public.e_dono(user_id))', t);
    execute format('create policy dono_update on public.%I for update to authenticated using (public.e_dono(user_id)) with check (public.e_dono(user_id))', t);
    execute format('create policy dono_delete on public.%I for delete to authenticated using (public.e_dono(user_id))', t);
  end loop;
  -- Só inclusão: histórico em vez de edição (O-05, fechamento imutável, saldo por movimentos)
  foreach t in array array['lancamento', 'movimento_carteira', 'fechamento_mes'] loop
    execute format('create policy dono_select on public.%I for select to authenticated using (public.e_dono(user_id))', t);
    execute format('create policy dono_insert on public.%I for insert to authenticated with check (public.e_dono(user_id))', t);
  end loop;
  -- Histórico do orçamento: só leitura pelo dono, escrito pelo trigger
  create policy dono_select on public.orcamento_historico for select to authenticated using (public.e_dono(user_id));
end $$;

-- Nada para o papel anônimo
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon, public;
grant execute on function public.abrir_orcamento_mes(date) to authenticated;
grant execute on function public.e_dono(uuid) to authenticated;

-- Privilégios explícitos, o mínimo de cada tabela. O RLS filtra as linhas por cima disso.
revoke all on all tables in schema public from authenticated;
grant select, insert, update, delete on public.perfil, public.plano_milhao, public.categoria, public.orcamento_mes,
  public.orcamento_item, public.renda, public.ativo_carteira to authenticated;
-- Só inclusão: nem o privilégio de update/delete existe
grant select, insert on public.lancamento, public.movimento_carteira, public.fechamento_mes to authenticated;
-- Escrito só pelo trigger (security definer)
grant select on public.orcamento_historico to authenticated;
grant select on public.v_saldo_ativo, public.v_limite_gasto_hoje, public.v_fechamento_vigente to authenticated;
