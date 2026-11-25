-- Testes de banco da Fase 2: travas (ADR-003), T-03 a T-05, T-08, P-02, P-04, isolamento.
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@teste.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b2', 'b@teste.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c3', 'c@teste.local', 'authenticated', 'authenticated');

create function pg_temp.entrar(uid text) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', 'aal2')::text, true);
end $$;
create function pg_temp.sair() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Operação de mini-índice com risco de R$ 6 (30 pontos × 1 contrato × 0,20)
create function pg_temp.op(aberta timestamptz, saida numeric default null, violacao boolean default false, stop numeric default 99970)
returns uuid language plpgsql as $$
declare novo uuid;
begin
  insert into public.operacao (aberta_em, ativo, mercado, direcao, quantidade, preco_entrada, preco_stop, preco_alvo, preco_saida,
    multiplicador, risco_centavos, setup_id, tendencia_diario, tendencia_h1, tendencia_h4, timeframe_entrada, teve_noticia, violacao_trava)
  values (aberta, 'WINZ26', 'mini_indice', 'compra', 1, 100000, stop, 100060, saida,
    1, 1, (select id from public.setup limit 1), 'alta', 'alta', 'lateral', '5m', false, violacao)
  returning id into novo;
  return novo;
end $$;

-- =================== Usuário A: o dia de hoje ===================
select pg_temp.entrar('00000000-0000-0000-0000-0000000000a1');
insert into public.ativo_carteira (id, nome, classe) values
  ('40000000-0000-0000-0000-0000000000a1', 'Reserva', 'reserva'),
  ('40000000-0000-0000-0000-0000000000a2', 'Conta da corretora', 'capital_trade');

-- P-02: sem meta de reserva (sem orçamento nem fechamento) não entra dinheiro no capital de trade
select throws_ok($$ insert into public.movimento_carteira (ativo_id, data, tipo, valor_centavos) values ('40000000-0000-0000-0000-0000000000a2', '2020-01-01', 'aporte', 60000) $$,
  'P0001', 'Complete a reserva de emergência antes de colocar dinheiro no capital de trade (P-02).', 'P-02: sem reserva completa, aporte no capital de trade é recusado');

insert into public.categoria (id, nome, tipo) values ('10000000-0000-0000-0000-0000000000a1', 'Mercado', 'variavel');
insert into public.orcamento_mes (id, mes) values ('20000000-0000-0000-0000-0000000000a1', date_trunc('month', public.hoje_sp())::date);
insert into public.orcamento_item (orcamento_mes_id, categoria_id, valor_centavos) values ('20000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000a1', 100000);
select is(public.meta_reserva('00000000-0000-0000-0000-0000000000a1'), 600000::bigint, 'P-03 no banco: 6 × orçamento sem histórico');
insert into public.movimento_carteira (ativo_id, data, tipo, valor_centavos) values ('40000000-0000-0000-0000-0000000000a1', '2020-01-01', 'aporte', 599999);
select throws_ok($$ insert into public.movimento_carteira (ativo_id, data, tipo, valor_centavos) values ('40000000-0000-0000-0000-0000000000a2', '2020-01-01', 'aporte', 60000) $$,
  'P0001', 'Complete a reserva de emergência antes de colocar dinheiro no capital de trade (P-02).', 'P-02: faltando 1 centavo, ainda recusa');
insert into public.movimento_carteira (ativo_id, data, tipo, valor_centavos) values ('40000000-0000-0000-0000-0000000000a1', '2020-01-01', 'aporte', 1);
select lives_ok($$ insert into public.movimento_carteira (ativo_id, data, tipo, valor_centavos) values ('40000000-0000-0000-0000-0000000000a2', '2020-01-01', 'aporte', 60000) $$,
  'P-02: reserva completa libera o capital de trade');
select throws_ok($$ insert into public.movimento_carteira (ativo_id, data, tipo, valor_centavos) values ('40000000-0000-0000-0000-0000000000a2', '2020-01-01', 'aporte', 20000) $$,
  'P0001', 'Capital de trade não pode passar de 10% do patrimônio (P-04).', 'P-04: capital de trade acima de 10% é recusado');

-- Depósito feito hoje conta no capital de hoje (bug encontrado no teste pela tela)
insert into public.ativo_carteira (id, nome, classe) values ('40000000-0000-0000-0000-0000000000a3', 'Reserva 2', 'reserva');

-- Conta e parâmetros
select throws_ok($$ insert into public.conta_trade (ativo_id) values ('40000000-0000-0000-0000-0000000000a1') $$,
  'P0001', 'Escolha um ativo da classe capital de trade.', 'conta de trade só com ativo de capital de trade');
insert into public.setup (nome) values ('FVG de continuação');
select throws_ok($$ select pg_temp.op(now()) $$, 'P0001', 'Configure a conta de trade antes de registrar operações.', 'sem conta, sem operação');
insert into public.conta_trade (ativo_id) values ('40000000-0000-0000-0000-0000000000a2');
insert into public.parametros_trade (vigente_desde, risco_operacao_centavos) values ('2000-01-01', 600);
select is((select vigente_desde from public.parametros_trade), public.hoje_sp(), 'a primeira configuração vale a partir de hoje');

select is((select risco_operacao_centavos from public.v_status_travas), 600::bigint, 'status lê o risco vigente');
select is((select capital_inicio_dia_centavos from public.v_status_travas), 60000::bigint, 'capital do início do dia = movimentos do ativo');
select is((select perda_dia_centavos from public.v_status_travas), 1200::bigint, 'M-11: min(2R, 2% do capital)');

-- T-03 e T-04
select throws_ok($$ select pg_temp.op(now(), stop => 99969) $$, 'P0001', 'Risco acima de 1% do capital de trade (T-04).', 'T-04: risco de R$ 6,20 com capital de R$ 600 é recusado');
select pg_temp.op(now());
select is((select multiplicador from public.operacao), 0.2::numeric, 'T-03: multiplicador vem do mercado, não do cliente');
select is((select risco_centavos from public.operacao), 600::bigint, 'T-03: risco calculado no banco');
select throws_ok($$ select pg_temp.op(now() + interval '2 days') $$, 'P0001', 'A operação não pode ter data futura.', 'data futura é recusada');

-- Encerrar: resultados calculados, uma vez só
update public.operacao set preco_saida = 99970 where preco_saida is null;
select is((select resultado_liquido_centavos from public.operacao), -600::bigint, 'resultado líquido calculado ao encerrar');
select is((select resultado_r from public.operacao), -1.00::numeric, 'T-05: resultado em R');
select throws_ok($$ update public.operacao set preco_saida = 100060 $$, 'P0001', 'Operação já encerrada não é editada.', 'operação encerrada não muda');
select throws_ok($$ delete from public.operacao $$, '42501', null, 'operação não é apagada');

-- Segunda perda fecha o dia (M-11, TR-01)
select pg_temp.op(now(), saida => 99970);
select is((select motivo from public.v_status_travas), 'perda_dia', 'TR-01: bater o limite de perda fecha o dia');
select is((select reabre_em from public.v_status_travas), public.proximo_dia_util(public.hoje_sp()), 'TR-05: reabre sozinho no próximo dia útil');
select throws_matching($$ select pg_temp.op(now()) $$, 'Limite de perda do dia atingido', 'TR-02: período fechado recusa operação planejada');
select lives_ok($$ select pg_temp.op(now(), saida => 100060, violacao => true) $$, 'TR-03: operação já executada entra como violação');
select is((select count(*) from public.operacao where violacao_trava), 1::bigint, 'TR-03: a violação fica registrada, nunca escondida');
select is((select motivo from public.v_status_travas), 'perda_dia', 'o lucro da violação não reabre o dia por baixo do pano');

-- ADR-003 item 4: limite novo só vale a partir do dia seguinte
select throws_ok($$ insert into public.parametros_trade (vigente_desde, risco_operacao_centavos, stop_loss_dia_r) values (public.hoje_sp(), 600, 5) $$,
  'P0001', 'Limites novos valem a partir do próximo dia.', 'ADR-003: não se muda limite no meio do período');
insert into public.parametros_trade (vigente_desde, risco_operacao_centavos, stop_loss_dia_r) values (public.hoje_sp() + 1, 600, 5);
select is((select motivo from public.v_status_travas), 'perda_dia', 'ADR-003: a mudança agendada não reabre o dia de hoje');

-- T-08 no banco
select throws_ok($$ insert into public.parametros_trade (vigente_desde, risco_operacao_centavos) values (public.hoje_sp() + 2, 700) $$,
  'P0001', 'Aumento de risco exige 100 operações, expectativa positiva e zero violações em 30 dias (T-08).', 'T-08: aumento de risco sem amostra é recusado');
select lives_ok($$ insert into public.parametros_trade (vigente_desde, risco_operacao_centavos) values (public.hoje_sp() + 2, 500) $$, 'T-08: reduzir o risco é livre');

-- Encerrar o dia na mão não tem volta (TR-05)
insert into public.dia_trade (data, encerrado_manual_em) values (public.hoje_sp(), now());
select throws_ok($$ update public.dia_trade set encerrado_manual_em = null $$, 'P0001', 'Dia encerrado não reabre. O diário volta no próximo dia útil.', 'TR-05: sem botão de desbloqueio');

-- Saldo do capital de trade inclui o resultado das operações
select is((select saldo_centavos from public.v_saldo_ativo where ativo_id = '40000000-0000-0000-0000-0000000000a2'), (60000 - 600 - 600 + 1200)::bigint,
  'saldo do capital de trade = movimentos + resultado das operações');

-- =================== Usuário D: capital depositado hoje ===================
select pg_temp.sair();
insert into auth.users (id, email, aud, role) values ('00000000-0000-0000-0000-0000000000d4', 'd@teste.local', 'authenticated', 'authenticated');
select pg_temp.entrar('00000000-0000-0000-0000-0000000000d4');
insert into public.ativo_carteira (id, nome, classe) values ('40000000-0000-0000-0000-0000000000d1', 'Reserva', 'reserva'), ('40000000-0000-0000-0000-0000000000d2', 'Corretora', 'capital_trade');
insert into public.categoria (id, nome, tipo) values ('10000000-0000-0000-0000-0000000000d1', 'Mercado', 'variavel');
insert into public.orcamento_mes (id, mes) values ('20000000-0000-0000-0000-0000000000d1', date_trunc('month', public.hoje_sp())::date);
insert into public.orcamento_item (orcamento_mes_id, categoria_id, valor_centavos) values ('20000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-0000000000d1', 100000);
insert into public.movimento_carteira (ativo_id, data, tipo, valor_centavos) values ('40000000-0000-0000-0000-0000000000d1', public.hoje_sp(), 'aporte', 900000);
insert into public.movimento_carteira (ativo_id, data, tipo, valor_centavos) values ('40000000-0000-0000-0000-0000000000d2', public.hoje_sp(), 'aporte', 100000);
insert into public.setup (nome) values ('FVG');
insert into public.conta_trade (ativo_id) values ('40000000-0000-0000-0000-0000000000d2');
insert into public.parametros_trade (vigente_desde, risco_operacao_centavos) values (public.hoje_sp(), 1000);
select is((select capital_inicio_dia_centavos from public.v_status_travas), 100000::bigint, 'depósito de hoje conta no capital de hoje');
select is((select aberto from public.v_status_travas), true, 'conta recém-criada abre o diário');
select is((select perda_mes_centavos from public.v_status_travas), 8000::bigint, 'M-13 usa o capital depositado no mês');

-- =================== Usuário C: semana, mês e fuso ===================
select pg_temp.sair();
alter table public.parametros_trade disable trigger parametros_validar;
select pg_temp.entrar('00000000-0000-0000-0000-0000000000c3');
insert into public.ativo_carteira (id, nome, classe) values ('40000000-0000-0000-0000-0000000000c1', 'Reserva', 'reserva'), ('40000000-0000-0000-0000-0000000000c2', 'Corretora', 'capital_trade');
insert into public.categoria (id, nome, tipo) values ('10000000-0000-0000-0000-0000000000c1', 'Mercado', 'variavel');
insert into public.orcamento_mes (id, mes) values ('20000000-0000-0000-0000-0000000000c1', date_trunc('month', public.hoje_sp())::date);
insert into public.orcamento_item (orcamento_mes_id, categoria_id, valor_centavos) values ('20000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-0000000000c1', 100000);
insert into public.movimento_carteira (ativo_id, data, tipo, valor_centavos) values ('40000000-0000-0000-0000-0000000000c1', '2020-01-01', 'aporte', 1000000);
insert into public.movimento_carteira (ativo_id, data, tipo, valor_centavos) values ('40000000-0000-0000-0000-0000000000c2', '2020-01-01', 'aporte', 100000);
insert into public.setup (nome) values ('FVG');
insert into public.conta_trade (ativo_id) values ('40000000-0000-0000-0000-0000000000c2');
insert into public.parametros_trade (vigente_desde, risco_operacao_centavos) values ('2020-01-01', 600);
select pg_temp.sair();
alter table public.parametros_trade enable trigger parametros_validar;
select pg_temp.entrar('00000000-0000-0000-0000-0000000000c3');-- Capital de C: R$ 1.000. Limites: dia min(R$ 12, 2%) = R$ 12; semana 3% do capital de segunda.
-- Fuso: 02:30 UTC de 10/06 ainda é 09/06 em Brasília (ADR-003: virada às 00h America/Sao_Paulo)
select pg_temp.op('2026-06-10 02:30:00+00', saida => 100000);
select is((select data from public.operacao order by criado_em desc limit 1), '2026-06-09'::date, 'fuso: a virada do dia é à meia-noite de Brasília');

-- Domingo 07/06 é da semana anterior; a semana começa na segunda 08/06
select pg_temp.op('2026-06-07 15:00:00-03', saida => 99975); -- −5
select is((select resultado_semana_centavos from public.status_travas('2026-06-08')), 0::bigint, 'semana começa na segunda: o domingo fica fora');

-- Capital na segunda = 99500, perda semanal = 2985. Três dias de −11 sem fechar nenhum dia.
select pg_temp.op('2026-06-08 10:00:00-03', saida => 99970); -- −6
select pg_temp.op('2026-06-08 11:00:00-03', saida => 99975); -- −5
select is((select aberto from public.status_travas('2026-06-08')), true, 'perda de R$ 11 não fecha o dia (limite R$ 12)');
select pg_temp.op('2026-06-09 10:00:00-03', saida => 99970);
select pg_temp.op('2026-06-09 11:00:00-03', saida => 99975);
select is((select aberto from public.status_travas('2026-06-09')), true, 'semana em −22 ainda aberta');
select pg_temp.op('2026-06-10 10:00:00-03', saida => 99970);
select pg_temp.op('2026-06-10 11:00:00-03', saida => 99975);
select is((select perda_semana_centavos from public.status_travas('2026-06-10')), 2985::bigint, 'M-12: 3% do capital do início da semana');
select is((select motivo from public.status_travas('2026-06-10')), 'perda_semana', 'M-12: perda de 3% na semana fecha a semana');
select is((select reabre_em from public.status_travas('2026-06-10')), '2026-06-15'::date, 'a semana reabre na segunda seguinte');
select throws_matching($$ select pg_temp.op('2026-06-11 10:00:00-03') $$, 'Limite de perda da semana atingido', 'TR-02: semana fechada recusa operação');
select is((select aberto from public.status_travas('2026-06-15')), true, 'nova semana, diário aberto');
select throws_ok($$ select pg_temp.op('2026-06-15 10:00:00-03', saida => 100060, violacao => true) $$,
  'P0001', 'O período está aberto: registre como operação normal.', 'violação só existe com o período fechado');



-- =================== Isolamento ===================
select pg_temp.entrar('00000000-0000-0000-0000-0000000000b2');
select is((select count(*) from public.operacao) + (select count(*) from public.setup) + (select count(*) from public.conta_trade)
        + (select count(*) from public.parametros_trade) + (select count(*) from public.dia_trade) + (select count(*) from public.ir_pagamento),
          0::bigint, 'RLS: B não vê nada de trade de A nem de C');
select is((select count(*) from public.v_status_travas), 0::bigint, 'RLS: B sem conta não tem status');
select throws_ok($$ insert into public.conta_trade (ativo_id) values ('40000000-0000-0000-0000-0000000000a2') $$,
  'P0001', 'Escolha um ativo da classe capital de trade.', 'B não usa o ativo de A como conta');
select pg_temp.sair();

select * from finish();
rollback;
