-- Testes de banco do calendário de trade com registro posterior (T-10, ADR-007).
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@teste.local', 'authenticated', 'authenticated');
-- Feriado de teste num dia passado (o calendário real começa em dez/2026)
insert into public.feriado_b3 (data, descricao, nacional) values ('2026-06-12', 'Feriado de teste', false);

create function pg_temp.entrar(uid text) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;
create function pg_temp.sair() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Mini-índice, entrada 100000. Stop 99950 = 50 pontos × R$ 0,20 = R$ 10 de risco (1% de R$ 1.000).
create function pg_temp.op(aberta timestamptz, saida numeric default null, violacao boolean default false, stop numeric default 99950)
returns uuid language plpgsql as $$
declare novo uuid;
begin
  insert into public.operacao (aberta_em, ativo, mercado, direcao, quantidade, preco_entrada, preco_stop, preco_alvo, preco_saida,
    multiplicador, risco_centavos, setup_id, tendencia_diario, tendencia_h1, tendencia_h4, timeframe_entrada, teve_noticia, violacao_trava)
  values (aberta, 'WINZ26', 'mini_indice', 'compra', 1, 100000, stop, 100100, saida,
    1, 1, (select id from public.setup limit 1), 'alta', 'alta', 'lateral', '5m', false, violacao)
  returning id into novo;
  return novo;
end $$;

-- Dono com capital de trade R$ 1.000 e risco R$ 10: perda do dia = min(2R, 2%) = R$ 20 (parâmetros desde 2020)
alter table public.parametros_trade disable trigger parametros_validar;
select pg_temp.entrar('00000000-0000-0000-0000-0000000000a1');
-- P-02: reserva completa antes do capital de trade
insert into public.ativo_carteira (id, nome, classe) values ('40000000-0000-0000-0000-0000000000a1', 'Reserva', 'reserva'), ('40000000-0000-0000-0000-0000000000a2', 'Corretora', 'capital_trade');
insert into public.categoria (id, nome, tipo) values ('10000000-0000-0000-0000-0000000000a1', 'Mercado', 'variavel');
insert into public.orcamento_mes (id, mes) values ('20000000-0000-0000-0000-0000000000a1', date_trunc('month', public.hoje_sp())::date);
insert into public.orcamento_item (orcamento_mes_id, categoria_id, valor_centavos) values ('20000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000a1', 100000);
insert into public.movimento_carteira (ativo_id, data, tipo, valor_centavos) values ('40000000-0000-0000-0000-0000000000a1', '2020-01-01', 'aporte', 900000);
insert into public.movimento_carteira (ativo_id, data, tipo, valor_centavos) values ('40000000-0000-0000-0000-0000000000a2', '2020-01-01', 'aporte', 100000);
insert into public.setup (nome) values ('FVG');
insert into public.conta_trade (ativo_id) values ('40000000-0000-0000-0000-0000000000a2');
insert into public.parametros_trade (vigente_desde, risco_operacao_centavos) values ('2020-01-01', 1000);
select pg_temp.sair();
alter table public.parametros_trade enable trigger parametros_validar;
select pg_temp.entrar('00000000-0000-0000-0000-0000000000a1');

-- Dia passado de pregão (quarta 10/06/2026), com a saída: entra
select lives_ok($$ select pg_temp.op('2026-06-10T10:00:00-03:00', 100030) $$, 'dia passado de pregão entra com a saída');
select is((select data::text || '|' || resultado_liquido_centavos from public.operacao), '2026-06-10|600', 'data vem da hora de entrada e o resultado é calculado no banco');

-- Dia passado sem a saída: recusa
select throws_ok($$ select pg_temp.op('2026-06-10T11:00:00-03:00') $$, 'P0001', 'Operação de dia passado entra já com a saída.', 'dia passado não fica em aberto');
-- Fim de semana e feriado: recusa
select throws_ok($$ select pg_temp.op('2026-06-13T10:00:00-03:00', 100030) $$, 'P0001', 'Nesse dia não houve pregão na B3.', 'sábado não teve pregão');
select throws_ok($$ select pg_temp.op('2026-06-12T10:00:00-03:00', 100030) $$, 'P0001', 'Nesse dia não houve pregão na B3.', 'feriado da B3 não teve pregão');
-- T-04 vale no dia passado: stop 99900 = R$ 20 de risco, acima de 1% de R$ 1.000
select throws_ok($$ select pg_temp.op('2026-06-10T12:00:00-03:00', 100030, false, 99900) $$, 'P0001', 'Risco acima de 1% do capital de trade (T-04).', 'T-04 vale no registro posterior');

-- Travas do dia passado: duas perdas de R$ 10 na quinta 11/06 fecham aquele dia
select lives_ok($$ select pg_temp.op('2026-06-11T10:00:00-03:00', 99950) $$, 'primeira perda do dia 11');
select lives_ok($$ select pg_temp.op('2026-06-11T10:30:00-03:00', 99950) $$, 'segunda perda do dia 11 (fecha o dia em −R$ 20)');
select throws_matching($$ select pg_temp.op('2026-06-11T11:00:00-03:00', 100030) $$, 'Limite de perda do dia atingido. O diário reabre em 15/06/2026',
  'dia passado fechado pela trava recusa operação normal (reabre no próximo pregão, depois do feriado)');
select lives_ok($$ select pg_temp.op('2026-06-11T11:00:00-03:00', 100030, true) $$, 'no dia passado fechado, a operação feita entra como violação');
select is((select count(*)::int from public.operacao where data = '2026-06-11' and violacao_trava), 1, 'a violação fica registrada e visível');
select throws_ok($$ select pg_temp.op('2026-06-10T13:00:00-03:00', 100030, true) $$, 'P0001', 'O período está aberto: registre como operação normal.',
  'dia passado aberto não aceita violação');

-- "Registrada depois" sai de criado_em, que o banco carimba: o cliente não escolhe nem muda
select lives_ok($$
  insert into public.operacao (aberta_em, ativo, mercado, direcao, quantidade, preco_entrada, preco_stop, preco_alvo, preco_saida,
    multiplicador, risco_centavos, setup_id, tendencia_diario, tendencia_h1, tendencia_h4, timeframe_entrada, teve_noticia, criado_em)
  values ('2026-06-10T14:00:00-03:00', 'WINZ26', 'mini_indice', 'compra', 1, 100000, 99950, 100100, 100030,
    1, 1, (select id from public.setup limit 1), 'alta', 'alta', 'lateral', '5m', false, '2026-06-10T14:05:00-03:00') $$, 'insere mandando criado_em antigo');
select ok((select bool_and(criado_em = now()) from public.operacao where data = '2026-06-10'), 'criado_em é sempre o momento do lançamento');
select ok((select bool_and((criado_em at time zone 'America/Sao_Paulo')::date > data) from public.operacao where data < public.hoje_sp()),
  'toda operação de dia passado aparece como registrada depois');

-- Hoje continua como antes: planejar sem saída e encerrar depois, sem mexer em criado_em.
-- Risco R$ 8 (stop 99960): as perdas acima baixaram o capital de hoje para menos de R$ 1.000
create temp table pg_temp.hoje_op (id uuid);
grant all on pg_temp.hoje_op to authenticated;
select lives_ok($$ insert into pg_temp.hoje_op select pg_temp.op(now(), null, false, 99960) $$, 'operação de hoje ainda nasce planejada, sem saída');
select lives_ok($$ update public.operacao set preco_saida = 100030, criado_em = '2020-01-01' where id = (select id from pg_temp.hoje_op) $$, 'encerra a de hoje');
select is((select criado_em from public.operacao where id = (select id from pg_temp.hoje_op)), now(), 'encerrar não muda criado_em');
select pg_temp.sair();

select * from finish();
rollback;
