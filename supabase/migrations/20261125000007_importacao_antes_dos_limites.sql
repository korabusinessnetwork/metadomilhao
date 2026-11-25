-- D07 (.full-auto/DECISOES.md): operação importada do MT5 com data anterior à primeira configuração de limites
-- entra sem violação, porque não havia trava vigente. O registro manual continua exigindo a configuração.
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
      -- D07: histórico importado de antes da primeira configuração de limites não tinha trava vigente
      if importada then
        if new.violacao_trava then
          raise exception 'Sem limites vigentes nessa data: não há violação a registrar.' using errcode = 'P0001';
        end if;
        return new;
      end if;
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

