-- Rota do Milhão, Fase 4: importação do MT5 (spec: specs/mt5-rascunhos.md, decisão D04 de .full-auto/DECISOES.md).
-- Cada posição do relatório vira rascunho; o dono completa o contexto (T-02) e confirma, em ordem.
-- A operação importada passa pelas mesmas regras do diário; só não é recusada pela T-04, porque já foi executada.

create table public.importacao_mt5 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  ticket text not null check (char_length(ticket) between 1 and 40),
  linha int not null check (linha > 0),
  dados jsonb not null,
  status text not null default 'rascunho' check (status in ('rascunho', 'confirmada', 'descartada')),
  operacao_id uuid references public.operacao on delete restrict,
  criado_em timestamptz not null default now(),
  unique (user_id, ticket)
);

-- O dono cria rascunho e só pode descartá-lo. Confirmar é coisa da função (que liga a marca abaixo).
create function public.validar_importacao_mt5() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'rascunho' or new.operacao_id is not null then
      raise exception 'Rascunho de importação nasce como rascunho.' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if current_setting('rota.importando_mt5', true) = 'sim' then
    return new;
  end if;
  if old.status <> 'rascunho' or new.status <> 'descartada'
     or (new.user_id, new.ticket, new.linha, new.dados, new.operacao_id) is distinct from (old.user_id, old.ticket, old.linha, old.dados, old.operacao_id) then
    raise exception 'Só dá para descartar um rascunho.' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger importacao_mt5_validar before insert or update on public.importacao_mt5
  for each row execute function public.validar_importacao_mt5();

-- O trigger da operação passa a reconhecer a importação: mesmas regras, com dois ajustes só para origem mt5.
create or replace function public.preparar_operacao() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  sinal int;
  st record;
  texto_motivo text;
  importada boolean := new.origem = 'mt5';
begin
  -- Origem mt5 só pela função de importação; senão bastaria rotular a operação para fugir da T-04
  if tg_op = 'INSERT' and importada and current_setting('rota.importando_mt5', true) is distinct from 'sim' then
    raise exception 'Operação do MT5 só entra pela importação.' using errcode = 'P0001';
  end if;
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
    -- O banco carimba o encerramento (a ordem decide quando a trava foi batida); a importada traz o horário real do relatório
    if importada then
      if new.fechada_em is null or new.fechada_em < new.aberta_em then
        raise exception 'Horário de fechamento inválido no relatório.' using errcode = 'P0001';
      end if;
    elsif tg_op = 'INSERT' or old.preco_saida is null then
      new.fechada_em := clock_timestamp();
    end if;
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
      -- T-04: risco ≤ 1% do capital do início do dia, só no registro planejado (a importada já foi executada)
      if not importada and new.risco_centavos > floor(st.capital_inicio_dia_centavos * 0.01) then
        raise exception 'Risco acima de 1%% do capital de trade (T-04).' using errcode = 'P0001';
      end if;
    end if;
  end if;
  return new;
end $$;

-- Confirmar um rascunho: completa o contexto, decide violação pelo status do período naquele momento e grava a operação.
create function public.confirmar_importacao_mt5(p_id uuid, p_contexto jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  r public.importacao_mt5;
  d jsonb;
  anterior public.importacao_mt5;
  aberta timestamptz;
  st record;
  stop numeric;
  alvo numeric;
  nova uuid;
begin
  select * into r from public.importacao_mt5 where id = p_id and user_id = auth.uid();
  if not found then
    raise exception 'Rascunho de importação não encontrado.' using errcode = 'P0001';
  end if;
  if r.status <> 'rascunho' then
    raise exception 'Este rascunho já foi confirmado ou descartado.' using errcode = 'P0001';
  end if;
  d := r.dados;
  aberta := (d ->> 'abertaEm')::timestamptz;

  -- Em ordem: as travas dependem do que aconteceu antes
  select * into anterior from public.importacao_mt5 i
   where i.user_id = r.user_id and i.status = 'rascunho' and i.id <> r.id
     and ((i.dados ->> 'abertaEm')::timestamptz, i.linha) < (aberta, r.linha)
   order by (i.dados ->> 'abertaEm')::timestamptz, i.linha limit 1;
  if found then
    raise exception 'Confirme antes a operação de %.', to_char((anterior.dados ->> 'abertaEm')::timestamptz at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
      using errcode = 'P0001';
  end if;

  stop := coalesce(nullif(d ->> 'stop', '')::numeric, nullif(p_contexto ->> 'stop', '')::numeric);
  alvo := coalesce(nullif(d ->> 'alvo', '')::numeric, nullif(p_contexto ->> 'alvo', '')::numeric);
  if stop is null then raise exception 'Informe o stop.' using errcode = 'P0001'; end if;
  if alvo is null then raise exception 'Informe o alvo.' using errcode = 'P0001'; end if;

  -- TR-03: se o período estava fechado naquele momento, a operação é violação, nunca escondida
  select * into st from public.status_travas((aberta at time zone 'America/Sao_Paulo')::date);

  perform set_config('rota.importando_mt5', 'sim', true);
  insert into public.operacao (aberta_em, fechada_em, ativo, mercado, direcao, quantidade, preco_entrada, preco_stop, preco_alvo, preco_saida,
    custos_centavos, multiplicador, risco_centavos, setup_id, tendencia_diario, tendencia_h1, tendencia_h4, timeframe_entrada, teve_noticia,
    noticia_descricao, seguiu_plano, observacao, violacao_trava, origem)
  values (aberta, (d ->> 'fechadaEm')::timestamptz, d ->> 'ativo',
    case when d ->> 'ativo' like 'WIN%' then 'mini_indice' else 'acoes' end,
    d ->> 'direcao', (d ->> 'volume')::numeric::int, (d ->> 'precoEntrada')::numeric, stop, alvo, (d ->> 'precoSaida')::numeric,
    coalesce((d ->> 'custosCentavos')::bigint, 0), 1, 1,
    (p_contexto ->> 'setup_id')::uuid, p_contexto ->> 'tendencia_diario', p_contexto ->> 'tendencia_h1', p_contexto ->> 'tendencia_h4',
    p_contexto ->> 'timeframe_entrada', coalesce((p_contexto ->> 'teve_noticia')::boolean, false), nullif(p_contexto ->> 'noticia_descricao', ''),
    (p_contexto ->> 'seguiu_plano')::boolean, nullif(p_contexto ->> 'observacao', ''),
    coalesce(st.aberto = false, false), 'mt5')
  returning id into nova;

  update public.importacao_mt5 set status = 'confirmada', operacao_id = nova where id = r.id;
  perform set_config('rota.importando_mt5', '', true);
  return nova;
end $$;

alter table public.importacao_mt5 enable row level security;
create policy dono_select on public.importacao_mt5 for select to authenticated using (public.e_dono(user_id));
create policy dono_insert on public.importacao_mt5 for insert to authenticated with check (public.e_dono(user_id));
create policy dono_update on public.importacao_mt5 for update to authenticated using (public.e_dono(user_id)) with check (public.e_dono(user_id));

revoke all on public.importacao_mt5 from anon, authenticated;
grant select, insert, update on public.importacao_mt5 to authenticated;
revoke execute on all functions in schema public from anon, public;
grant execute on function public.confirmar_importacao_mt5(uuid, jsonb), public.e_dia_pregao(date), public.proximo_dia_util(date),
  public.primeiro_dia_util(date), public.status_travas(date), public.hoje_sp(), public.capital_trade_do_periodo(uuid, date, date),
  public.parametros_vigentes(uuid, date), public.meta_reserva(uuid), public.e_dono(uuid), public.abrir_orcamento_mes(date) to authenticated;
