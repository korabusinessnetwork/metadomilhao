-- Rota do Milhão, Fase 2: diário de trade
-- Regras: M-10 a M-13, T-01 a T-09, TR-01 a TR-06, P-02, P-04, IR. Decisão: ADR-003 (travas no banco).
-- O status do dia não é guardado: é calculado das operações, então não existe desbloqueio (TR-05).

-- =========================================================
-- Datas úteis (segunda a sexta; feriados da B3 entram na Fase 3)
-- =========================================================
create function public.proximo_dia_util(d date) returns date
language sql immutable set search_path = '' as $$
  select case extract(isodow from d)::int when 5 then d + 3 when 6 then d + 2 else d + 1 end
$$;

create function public.primeiro_dia_util(d date) returns date
language sql immutable set search_path = '' as $$
  select case extract(isodow from d)::int when 6 then d + 2 when 7 then d + 1 else d end
$$;

create function public.hoje_sp() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;

-- =========================================================
-- Conta de trade, parâmetros versionados e setups
-- =========================================================
create table public.conta_trade (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  ativo_id uuid not null unique references public.ativo_carteira on delete restrict,
  criado_em timestamptz not null default now()
);

-- ADR-003 item 4: mudar limites só vale do período seguinte. Cada mudança é uma versão nova, só inclusão.
create table public.parametros_trade (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  vigente_desde date not null,
  risco_operacao_centavos bigint not null check (risco_operacao_centavos > 0),
  stop_gain_r numeric(4,2) not null default 2 check (stop_gain_r > 0),
  stop_loss_dia_r numeric(4,2) not null default 2 check (stop_loss_dia_r > 0),
  pct_perda_dia numeric(5,2) not null default 2 check (pct_perda_dia > 0 and pct_perda_dia <= 10),
  pct_perda_semana numeric(5,2) not null default 3 check (pct_perda_semana > 0 and pct_perda_semana <= 20),
  pct_perda_mes numeric(5,2) not null default 8 check (pct_perda_mes > 0 and pct_perda_mes <= 30),
  aumento_risco boolean not null default false,
  criado_em timestamptz not null default now(),
  unique (user_id, vigente_desde)
);

create table public.setup (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null check (char_length(nome) between 1 and 60),
  descricao text check (descricao is null or char_length(descricao) <= 500),
  ativo boolean not null default true,
  unique (user_id, nome)
);

create table public.dia_trade (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  data date not null,
  encerrado_manual_em timestamptz,
  nota_dia text check (nota_dia is null or char_length(nota_dia) <= 2000),
  primary key (user_id, data)
);

-- =========================================================
-- Operação (T-01 a T-05, TR-03)
-- =========================================================
create table public.operacao (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  data date not null,
  aberta_em timestamptz not null,
  fechada_em timestamptz,
  ativo text not null check (ativo ~ '^[A-Z0-9]{4,12}$'),
  mercado text not null check (mercado in ('acoes', 'mini_indice')),
  direcao text not null check (direcao in ('compra', 'venda')),
  quantidade int not null check (quantidade > 0),
  preco_entrada numeric(14,4) not null check (preco_entrada > 0),
  preco_stop numeric(14,4) not null check (preco_stop > 0),
  preco_alvo numeric(14,4) not null check (preco_alvo > 0),
  preco_saida numeric(14,4) check (preco_saida is null or preco_saida > 0),
  multiplicador numeric(6,4) not null,
  risco_centavos bigint not null check (risco_centavos > 0),
  resultado_bruto_centavos bigint,
  custos_centavos bigint check (custos_centavos is null or custos_centavos >= 0),
  resultado_liquido_centavos bigint,
  resultado_r numeric(8,2),
  setup_id uuid not null references public.setup on delete restrict,
  tendencia_diario text not null check (tendencia_diario in ('alta', 'baixa', 'lateral')),
  tendencia_h1 text not null check (tendencia_h1 in ('alta', 'baixa', 'lateral')),
  tendencia_h4 text not null check (tendencia_h4 in ('alta', 'baixa', 'lateral')),
  timeframe_entrada text not null check (timeframe_entrada in ('15s', '5m', '15m')),
  teve_noticia boolean not null,
  noticia_descricao text check (noticia_descricao is null or char_length(noticia_descricao) <= 500),
  revisao_noticias_id uuid, -- IA-05, a FK entra na Fase 3
  seguiu_plano boolean,
  observacao text check (observacao is null or char_length(observacao) <= 1000),
  violacao_trava boolean not null default false,
  origem text not null default 'manual' check (origem in ('manual', 'mt5', 'kora_trader')),
  criado_em timestamptz not null default now(),
  constraint operacao_noticia check (not teve_noticia or char_length(coalesce(noticia_descricao, '')) > 0),
  constraint operacao_fechamento check ((preco_saida is null) = (fechada_em is null) and (preco_saida is null) = (resultado_liquido_centavos is null)),
  -- TR-03: violação é operação já executada, então entra com a saída
  constraint operacao_violacao_executada check (not violacao_trava or preco_saida is not null)
);
create index operacao_user_data on public.operacao (user_id, data);

-- =========================================================
-- Capital, parâmetros vigentes e status das travas
-- =========================================================

-- Capital de trade de um período: depósitos e saques até a data (dinheiro que já está na conta)
-- + resultado das operações fechadas antes do início do período (o resultado do próprio período não muda o limite)
create function public.capital_trade_do_periodo(p_user uuid, p_inicio date, p_data date) returns bigint
language sql stable security invoker set search_path = '' as $$
  select coalesce((select sum(m.valor_centavos) from public.movimento_carteira m
                     join public.conta_trade c on c.ativo_id = m.ativo_id and c.user_id = p_user
                    where m.data <= p_data), 0)
       + coalesce((select sum(o.resultado_liquido_centavos) from public.operacao o
                    where o.user_id = p_user and o.data < p_inicio and o.resultado_liquido_centavos is not null), 0)
$$;

create function public.parametros_vigentes(p_user uuid, p_data date) returns public.parametros_trade
language sql stable security invoker set search_path = '' as $$
  select p.* from public.parametros_trade p
   where p.user_id = p_user and p.vigente_desde <= p_data
   order by p.vigente_desde desc limit 1
$$;

-- TR-01 e M-10 a M-13. Cada período usa os parâmetros e o capital do seu próprio início.
create function public.status_travas(p_data date)
returns table (
  aberto boolean, motivo text, reabre_em date,
  meta_dia_centavos bigint, perda_dia_centavos bigint, perda_semana_centavos bigint, perda_mes_centavos bigint,
  resultado_dia_centavos bigint, resultado_semana_centavos bigint, resultado_mes_centavos bigint,
  capital_inicio_dia_centavos bigint, risco_operacao_centavos bigint
)
language plpgsql stable security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
  semana date := date_trunc('week', p_data)::date; -- ISO: segunda
  mes date := date_trunc('month', p_data)::date;
  p_dia public.parametros_trade;
  p_sem public.parametros_trade;
  p_mes public.parametros_trade;
  cap_dia bigint; cap_sem bigint; cap_mes bigint;
  r_dia bigint; r_sem bigint; r_mes bigint;
  pior_dia bigint; melhor_dia bigint; pior_sem bigint; pior_mes bigint;
  l_meta bigint; l_dia bigint; l_sem bigint; l_mes bigint;
  manual boolean;
begin
  p_dia := public.parametros_vigentes(uid, p_data);
  if p_dia.id is null then
    return; -- sem conta configurada: nenhuma linha
  end if;
  -- Parâmetros de semana e mês: os vigentes no início do período; se ainda não existiam, os mais antigos
  p_sem := coalesce(public.parametros_vigentes(uid, semana), (select p from public.parametros_trade p where p.user_id = uid order by vigente_desde limit 1));
  p_mes := coalesce(public.parametros_vigentes(uid, mes), (select p from public.parametros_trade p where p.user_id = uid order by vigente_desde limit 1));
  if p_sem.id is null then p_sem := p_dia; end if;
  if p_mes.id is null then p_mes := p_dia; end if;

  cap_dia := public.capital_trade_do_periodo(uid, p_data, p_data);
  cap_sem := public.capital_trade_do_periodo(uid, semana, p_data);
  cap_mes := public.capital_trade_do_periodo(uid, mes, p_data);

  -- Acumulado na ordem de encerramento. O limite vale se foi batido em qualquer momento (TR-05):
  -- um lucro depois do fechamento, como uma violação, não reabre o período.
  select coalesce(sum(x.v) filter (where x.data = p_data), 0),
         coalesce(sum(x.v) filter (where x.data >= semana), 0),
         coalesce(sum(x.v), 0),
         least(0, coalesce(min(x.ac_dia) filter (where x.data = p_data), 0)),
         greatest(0, coalesce(max(x.ac_dia) filter (where x.data = p_data), 0)),
         least(0, coalesce(min(x.ac_sem) filter (where x.data >= semana), 0)),
         least(0, coalesce(min(x.ac_mes), 0))
    into r_dia, r_sem, r_mes, pior_dia, melhor_dia, pior_sem, pior_mes
    from (
      select o.data, o.resultado_liquido_centavos as v,
             sum(o.resultado_liquido_centavos) over w as ac_mes,
             sum(case when o.data >= semana then o.resultado_liquido_centavos else 0 end) over w as ac_sem,
             sum(case when o.data = p_data then o.resultado_liquido_centavos else 0 end) over w as ac_dia
        from public.operacao o
       where o.user_id = uid and o.data >= mes and o.data <= p_data and o.resultado_liquido_centavos is not null
      window w as (order by o.data, o.fechada_em, o.id)
    ) x;

  l_meta := round(p_dia.stop_gain_r * p_dia.risco_operacao_centavos);
  l_dia := least(round(p_dia.stop_loss_dia_r * p_dia.risco_operacao_centavos), round(cap_dia * p_dia.pct_perda_dia / 100));
  l_sem := round(cap_sem * p_sem.pct_perda_semana / 100);
  l_mes := round(cap_mes * p_mes.pct_perda_mes / 100);
  select exists (select 1 from public.dia_trade d where d.user_id = uid and d.data = p_data and d.encerrado_manual_em is not null) into manual;

  aberto := false;
  -- Limite zero (sem capital) não fecha nada: sem capital, a T-04 recusa qualquer operação
  if l_mes > 0 and pior_mes <= -l_mes then
    motivo := 'perda_mes'; reabre_em := public.primeiro_dia_util((mes + interval '1 month')::date);
  elsif l_sem > 0 and pior_sem <= -l_sem then
    motivo := 'perda_semana'; reabre_em := semana + 7;
  elsif l_dia > 0 and pior_dia <= -l_dia then
    motivo := 'perda_dia'; reabre_em := public.proximo_dia_util(p_data);
  elsif l_meta > 0 and melhor_dia >= l_meta then
    motivo := 'meta_dia'; reabre_em := public.proximo_dia_util(p_data);
  elsif manual then
    motivo := 'manual'; reabre_em := public.proximo_dia_util(p_data);
  else
    aberto := true; motivo := null; reabre_em := null;
  end if;

  meta_dia_centavos := l_meta; perda_dia_centavos := l_dia; perda_semana_centavos := l_sem; perda_mes_centavos := l_mes;
  resultado_dia_centavos := r_dia; resultado_semana_centavos := r_sem; resultado_mes_centavos := r_mes;
  capital_inicio_dia_centavos := cap_dia; risco_operacao_centavos := p_dia.risco_operacao_centavos;
  return next;
end $$;

create view public.v_status_travas with (security_invoker = true) as
select public.hoje_sp() as data, s.* from public.status_travas(public.hoje_sp()) s;

-- =========================================================
-- Trigger da operação: cálculo, validação, T-04 e trava (ADR-003)
-- =========================================================
create function public.preparar_operacao() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  sinal int;
  st record;
  texto_motivo text;
begin
  new.data := (new.aberta_em at time zone 'America/Sao_Paulo')::date;
  if new.data > public.hoje_sp() then
    raise exception 'A operação não pode ter data futura.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.setup s where s.id = new.setup_id and s.user_id = new.user_id) then
    raise exception 'Setup não encontrado.' using errcode = 'P0001';
  end if;
  if new.direcao = 'compra' and not (new.preco_stop < new.preco_entrada and new.preco_entrada < new.preco_alvo) then
    raise exception 'Na compra, o stop fica abaixo da entrada e o alvo acima.' using errcode = 'P0001';
  end if;
  if new.direcao = 'venda' and not (new.preco_stop > new.preco_entrada and new.preco_entrada > new.preco_alvo) then
    raise exception 'Na venda, o stop fica acima da entrada e o alvo abaixo.' using errcode = 'P0001';
  end if;

  -- T-03: o multiplicador vem do mercado, nunca do cliente
  new.multiplicador := case new.mercado when 'mini_indice' then 0.2 else 1 end;
  new.risco_centavos := round(abs(new.preco_entrada - new.preco_stop) * new.quantidade * new.multiplicador * 100);

  if new.preco_saida is not null then
    sinal := case new.direcao when 'compra' then 1 else -1 end;
    new.custos_centavos := coalesce(new.custos_centavos, 0);
    new.resultado_bruto_centavos := round(sinal * (new.preco_saida - new.preco_entrada) * new.quantidade * new.multiplicador * 100);
    new.resultado_liquido_centavos := new.resultado_bruto_centavos - new.custos_centavos;
    new.resultado_r := round(new.resultado_liquido_centavos::numeric / new.risco_centavos, 2); -- T-05
    -- O banco carimba o encerramento: a ordem das operações decide quando a trava foi batida
    if tg_op = 'INSERT' or old.preco_saida is null then new.fechada_em := clock_timestamp(); end if;
  else
    new.resultado_bruto_centavos := null; new.resultado_liquido_centavos := null; new.resultado_r := null; new.fechada_em := null;
  end if;

  if tg_op = 'INSERT' then
    if not exists (select 1 from public.conta_trade c where c.user_id = new.user_id) then
      raise exception 'Configure a conta de trade antes de registrar operações.' using errcode = 'P0001';
    end if;
    select * into st from public.status_travas(new.data);
    if st is null or st.aberto is null then
      raise exception 'Defina o risco por operação antes de registrar.' using errcode = 'P0001';
    end if;
    if new.violacao_trava and st.aberto then
      raise exception 'O período está aberto: registre como operação normal.' using errcode = 'P0001';
    end if;
    if not new.violacao_trava then
      -- TR-02 e TR-04: período fechado recusa operação planejada
      if not st.aberto then
        texto_motivo := case st.motivo
          when 'perda_mes' then 'Limite de perda do mês atingido.'
          when 'perda_semana' then 'Limite de perda da semana atingido.'
          when 'perda_dia' then 'Limite de perda do dia atingido.'
          when 'meta_dia' then 'Meta de lucro do dia atingida.'
          else 'Dia encerrado.' end;
        raise exception '% O diário reabre em %. Se já operou, registre como violação.', texto_motivo, to_char(st.reabre_em, 'DD/MM/YYYY')
          using errcode = 'P0001';
      end if;
      -- T-04: risco ≤ 1% do capital de trade do início do dia
      if new.risco_centavos > floor(st.capital_inicio_dia_centavos * 0.01) then
        raise exception 'Risco acima de 1%% do capital de trade (T-04).' using errcode = 'P0001';
      end if;
    end if;
  end if;
  return new;
end $$;

create trigger operacao_preparar before insert on public.operacao
  for each row execute function public.preparar_operacao();

-- Só se fecha uma operação aberta, uma vez. Fechada, ela não muda mais.
create function public.validar_encerramento() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if old.preco_saida is not null then
    raise exception 'Operação já encerrada não é editada.' using errcode = 'P0001';
  end if;
  if new.preco_saida is null then
    raise exception 'Informe o preço de saída para encerrar.' using errcode = 'P0001';
  end if;
  if (new.user_id, new.aberta_em, new.ativo, new.mercado, new.direcao, new.quantidade, new.preco_entrada, new.preco_stop, new.preco_alvo,
      new.setup_id, new.tendencia_diario, new.tendencia_h1, new.tendencia_h4, new.timeframe_entrada, new.teve_noticia,
      new.noticia_descricao, new.violacao_trava, new.origem, new.revisao_noticias_id)
     is distinct from
     (old.user_id, old.aberta_em, old.ativo, old.mercado, old.direcao, old.quantidade, old.preco_entrada, old.preco_stop, old.preco_alvo,
      old.setup_id, old.tendencia_diario, old.tendencia_h1, old.tendencia_h4, old.timeframe_entrada, old.teve_noticia,
      old.noticia_descricao, old.violacao_trava, old.origem, old.revisao_noticias_id) then
    raise exception 'Ao encerrar, só mudam saída, custos, se seguiu o plano e a observação.' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- Ordem alfabética: primeiro valida (operacao_a_), depois recalcula (operacao_b_)
create trigger operacao_a_validar_encerramento before update on public.operacao
  for each row execute function public.validar_encerramento();
create trigger operacao_b_recalcular before update on public.operacao
  for each row execute function public.preparar_operacao();

-- =========================================================
-- Dia de trade: encerrar na mão não tem volta (TR-05)
-- =========================================================
create function public.validar_dia_trade() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.encerrado_manual_em is not null and new.encerrado_manual_em is distinct from old.encerrado_manual_em then
    raise exception 'Dia encerrado não reabre. O diário volta no próximo dia útil.' using errcode = 'P0001';
  end if;
  if new.encerrado_manual_em is not null and new.data <> public.hoje_sp() and (tg_op = 'INSERT' or old.encerrado_manual_em is null) then
    raise exception 'Só dá para encerrar o dia de hoje.' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger dia_trade_validar before insert or update on public.dia_trade
  for each row execute function public.validar_dia_trade();

-- =========================================================
-- Parâmetros: vigência futura (ADR-003) e aumento de risco (T-08)
-- =========================================================
create function public.validar_parametros() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  atual public.parametros_trade;
  n_ops int;
  expectativa numeric;
  violacoes int;
  ultimo_aumento date;
begin
  select * into atual from public.parametros_trade p where p.user_id = new.user_id order by p.vigente_desde desc limit 1;
  if atual.id is null then
    new.vigente_desde := public.hoje_sp(); -- primeira configuração vale já
    new.aumento_risco := false;
    return new;
  end if;
  -- ADR-003 item 4: limites novos só a partir de amanhã, nunca no meio de um período fechado
  if new.vigente_desde <= public.hoje_sp() then
    raise exception 'Limites novos valem a partir do próximo dia.' using errcode = 'P0001';
  end if;
  if new.vigente_desde <= atual.vigente_desde then
    raise exception 'Já existe uma mudança agendada para essa data ou depois.' using errcode = 'P0001';
  end if;
  new.aumento_risco := new.risco_operacao_centavos > atual.risco_operacao_centavos;
  if new.aumento_risco then
    select count(*), avg(o.resultado_liquido_centavos) into n_ops, expectativa
      from public.operacao o where o.user_id = new.user_id and o.resultado_liquido_centavos is not null;
    select count(*) into violacoes from public.operacao o
     where o.user_id = new.user_id and o.violacao_trava and o.data > public.hoje_sp() - 30;
    select max(p.vigente_desde) into ultimo_aumento from public.parametros_trade p where p.user_id = new.user_id and p.aumento_risco;
    if n_ops < 100 or coalesce(expectativa, 0) <= 0 or violacoes > 0 then
      raise exception 'Aumento de risco exige 100 operações, expectativa positiva e zero violações em 30 dias (T-08).' using errcode = 'P0001';
    end if;
    if ultimo_aumento is not null and new.vigente_desde < (ultimo_aumento + interval '6 months')::date then
      raise exception 'No máximo um aumento de risco a cada 6 meses (T-08).' using errcode = 'P0001';
    end if;
    if new.risco_operacao_centavos > floor(atual.risco_operacao_centavos * 1.25) then
      raise exception 'Aumento máximo de 25%% por etapa (T-08).' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

create trigger parametros_validar before insert on public.parametros_trade
  for each row execute function public.validar_parametros();

-- A conta de trade aponta para um ativo de capital de trade do próprio dono
create function public.validar_conta_trade() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.ativo_carteira a where a.id = new.ativo_id and a.user_id = new.user_id and a.classe = 'capital_trade') then
    raise exception 'Escolha um ativo da classe capital de trade.' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger conta_trade_validar before insert or update on public.conta_trade
  for each row execute function public.validar_conta_trade();

-- =========================================================
-- P-02 e P-04 no banco: dinheiro novo no capital de trade
-- =========================================================
-- P-03: 6 × média das despesas dos últimos 3 fechamentos vigentes; sem histórico, o orçamento do mês atual
create function public.meta_reserva(p_user uuid) returns bigint
language sql stable security invoker set search_path = '' as $$
  select 6 * coalesce(
    (select round(avg(g.gasto_real)) from (
       select f.gasto_real from public.fechamento_mes f
        where f.user_id = p_user and not exists (select 1 from public.fechamento_mes s where s.substitui = f.id)
        order by f.mes desc limit 3) g),
    (select sum(i.valor_centavos) from public.orcamento_item i join public.orcamento_mes o on o.id = i.orcamento_mes_id
      where o.user_id = p_user and o.mes = date_trunc('month', public.hoje_sp())::date),
    0)::bigint
$$;

create function public.validar_capital_trade() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  classe_ativo text;
  meta bigint;
  reserva bigint;
  total bigint;
  capital bigint;
begin
  select a.classe into classe_ativo from public.ativo_carteira a where a.id = new.ativo_id;
  -- is distinct from: ativo de outro dono (invisível pelo RLS) vem nulo e segue para a validação de dono
  if classe_ativo is distinct from 'capital_trade' or new.tipo <> 'aporte' then
    return new;
  end if;
  meta := public.meta_reserva(new.user_id);
  select coalesce(sum(m.valor_centavos), 0) into reserva from public.movimento_carteira m
    join public.ativo_carteira a on a.id = m.ativo_id where a.user_id = new.user_id and a.classe = 'reserva';
  if meta <= 0 or reserva < meta then
    raise exception 'Complete a reserva de emergência antes de colocar dinheiro no capital de trade (P-02).' using errcode = 'P0001';
  end if;
  select coalesce(sum(s.saldo_centavos), 0), coalesce(sum(s.saldo_centavos) filter (where s.classe = 'capital_trade'), 0)
    into total, capital from public.v_saldo_ativo s where s.user_id = new.user_id and s.ativo;
  if (capital + new.valor_centavos) * 10 > (total + new.valor_centavos) then
    raise exception 'Capital de trade não pode passar de 10%% do patrimônio (P-04).' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger movimento_validar_capital_trade before insert on public.movimento_carteira
  for each row execute function public.validar_capital_trade();

-- Saldo do ativo de capital de trade inclui o resultado das operações fechadas
create or replace view public.v_saldo_ativo with (security_invoker = true) as
select a.id as ativo_id, a.user_id, a.nome, a.classe, a.instituicao, a.ativo,
       (coalesce((select sum(m.valor_centavos) from public.movimento_carteira m where m.ativo_id = a.id), 0)
      + coalesce((select sum(o.resultado_liquido_centavos) from public.operacao o
                   join public.conta_trade c on c.user_id = o.user_id
                  where c.ativo_id = a.id and o.resultado_liquido_centavos is not null), 0))::bigint as saldo_centavos
  from public.ativo_carteira a;

-- =========================================================
-- IR: registro de pagamento do DARF (a apuração é calculada)
-- =========================================================
create table public.ir_pagamento (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  mes date not null check (extract(day from mes) = 1),
  valor_centavos bigint not null check (valor_centavos > 0),
  pago_em date not null,
  unique (user_id, mes)
);

-- =========================================================
-- RLS e privilégios
-- =========================================================
alter table public.conta_trade enable row level security;
alter table public.parametros_trade enable row level security;
alter table public.setup enable row level security;
alter table public.dia_trade enable row level security;
alter table public.operacao enable row level security;
alter table public.ir_pagamento enable row level security;

do $$
declare t text;
begin
  foreach t in array array['conta_trade', 'setup', 'dia_trade', 'ir_pagamento'] loop
    execute format('create policy dono_select on public.%I for select to authenticated using (public.e_dono(user_id))', t);
    execute format('create policy dono_insert on public.%I for insert to authenticated with check (public.e_dono(user_id))', t);
    execute format('create policy dono_update on public.%I for update to authenticated using (public.e_dono(user_id)) with check (public.e_dono(user_id))', t);
  end loop;
  execute 'create policy dono_delete on public.ir_pagamento for delete to authenticated using (public.e_dono(user_id))';
  foreach t in array array['parametros_trade', 'operacao'] loop
    execute format('create policy dono_select on public.%I for select to authenticated using (public.e_dono(user_id))', t);
    execute format('create policy dono_insert on public.%I for insert to authenticated with check (public.e_dono(user_id))', t);
  end loop;
  -- Operação: update só para encerrar (o trigger garante o resto)
  execute 'create policy dono_update on public.operacao for update to authenticated using (public.e_dono(user_id)) with check (public.e_dono(user_id))';
end $$;

revoke all on public.conta_trade, public.parametros_trade, public.setup, public.dia_trade, public.operacao, public.ir_pagamento from anon, authenticated;
grant select, insert, update on public.conta_trade, public.setup, public.dia_trade to authenticated;
grant select, insert, delete on public.ir_pagamento to authenticated;
grant select, insert on public.parametros_trade to authenticated;
grant select, insert, update on public.operacao to authenticated;
revoke all on public.v_status_travas, public.v_saldo_ativo from anon;
grant select on public.v_status_travas, public.v_saldo_ativo to authenticated;

revoke execute on all functions in schema public from anon, public;
grant execute on function public.status_travas(date), public.hoje_sp(), public.proximo_dia_util(date), public.primeiro_dia_util(date),
  public.capital_trade_do_periodo(uuid, date, date), public.parametros_vigentes(uuid, date), public.meta_reserva(uuid),
  public.e_dono(uuid), public.abrir_orcamento_mes(date) to authenticated;
