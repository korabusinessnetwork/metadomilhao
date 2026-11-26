-- Testes de banco da importação do MT5 (spec: specs/mt5-rascunhos.md).
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@teste.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b2', 'b@teste.local', 'authenticated', 'authenticated');

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

-- Posição como o parser devolve (T01)
create function pg_temp.posicao(ticket text, aberta text, fechada text, entrada numeric, saida numeric, stop numeric default 128450, alvo numeric default 128600, direcao text default 'compra')
returns jsonb language sql as $$
  select jsonb_build_object('ticket', ticket, 'ativo', 'WINJ27', 'direcao', direcao, 'volume', 1, 'precoEntrada', entrada, 'precoSaida', saida,
    'stop', stop, 'alvo', alvo, 'abertaEm', aberta, 'fechadaEm', fechada, 'custosCentavos', 50, 'lucroBrutoCentavos', round((saida - entrada) * 20))
$$;

create function pg_temp.contexto(extra jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('setup_id', (select id from public.setup limit 1), 'tendencia_diario', 'alta', 'tendencia_h1', 'alta', 'tendencia_h4', 'lateral',
    'timeframe_entrada', '5m', 'teve_noticia', false, 'seguiu_plano', true) || extra
$$;

-- Usuário A com conta de trade: capital R$ 1.000, risco R$ 10, perda do dia R$ 20 (parâmetros desde 2020)
select pg_temp.sair();
alter table public.parametros_trade disable trigger parametros_validar;
select pg_temp.entrar('00000000-0000-0000-0000-0000000000a1');
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

-- Três posições de 10/06/2026: duas perdas de R$ 10 (fecham o dia em −R$ 20) e uma depois
insert into public.importacao_mt5 (id, ticket, linha, dados) values
  ('80000000-0000-0000-0000-000000000001', '1001', 4, pg_temp.posicao('1001', '2026-06-10T10:00:00-03:00', '2026-06-10T10:10:00-03:00', 128500, 128450)),
  ('80000000-0000-0000-0000-000000000002', '1002', 5, pg_temp.posicao('1002', '2026-06-10T11:00:00-03:00', '2026-06-10T11:10:00-03:00', 128500, 128450)),
  ('80000000-0000-0000-0000-000000000003', '1003', 6, pg_temp.posicao('1003', '2026-06-10T12:00:00-03:00', '2026-06-10T12:10:00-03:00', 128500, 128600, null, null));

-- Critério 2: mesmo ticket não entra duas vezes
select throws_ok($$ insert into public.importacao_mt5 (ticket, linha, dados) values ('1001', 9, '{}') $$, '23505', null, 'o mesmo ticket não importa duas vezes');
-- Critério 3: só nasce rascunho
select throws_ok($$ insert into public.importacao_mt5 (ticket, linha, dados, status) values ('1009', 9, '{}', 'confirmada') $$, 'P0001', 'Rascunho de importação nasce como rascunho.', 'não se cria rascunho já confirmado');
-- Critério 9: origem mt5 direto na tabela é recusada
select throws_ok($$
  insert into public.operacao (aberta_em, fechada_em, ativo, mercado, direcao, quantidade, preco_entrada, preco_stop, preco_alvo, preco_saida, multiplicador, risco_centavos,
    setup_id, tendencia_diario, tendencia_h1, tendencia_h4, timeframe_entrada, teve_noticia, origem)
  values ('2026-06-10T09:00:00-03:00', '2026-06-10T09:05:00-03:00', 'WINJ27', 'mini_indice', 'compra', 1, 128500, 128000, 129000, 128600, 1, 1,
    (select id from public.setup limit 1), 'alta', 'alta', 'alta', '5m', false, 'mt5') $$,
  'P0001', 'Operação do MT5 só entra pela importação.', 'ninguém cria operação mt5 fora da função (e fura a T-04)');

-- Critério 5: em ordem
select throws_matching($$ select public.confirmar_importacao_mt5('80000000-0000-0000-0000-000000000002', pg_temp.contexto()) $$,
  'Confirme antes a operação de 10/06/2026 10:00', 'confirmação segue a ordem do relatório');

-- Critério 4: confirmar cria a operação com horários reais e contexto
select lives_ok($$ select public.confirmar_importacao_mt5('80000000-0000-0000-0000-000000000001', pg_temp.contexto('{"observacao": "Entrada atrasada"}')) $$, 'confirma o primeiro rascunho');
select is((select origem || '|' || to_char(fechada_em at time zone 'America/Sao_Paulo', 'HH24:MI') || '|' || resultado_liquido_centavos || '|' || observacao
             from public.operacao), 'mt5|10:10|-1050|Entrada atrasada', 'operação mt5 com fechamento real, custos e contexto');
select is((select status || '|' || (operacao_id is not null) from public.importacao_mt5 where ticket = '1001'), 'confirmada|true', 'rascunho vira confirmada com a operação');
select is((select violacao_trava from public.operacao where origem = 'mt5' order by aberta_em limit 1), false, 'período aberto: não é violação');
-- Critério 10
select throws_ok($$ select public.confirmar_importacao_mt5('80000000-0000-0000-0000-000000000001', pg_temp.contexto()) $$, 'P0001', 'Este rascunho já foi confirmado ou descartado.', 'não confirma duas vezes');

-- Critério 6: a segunda perda fecha o dia; a terceira entra como violação
select public.confirmar_importacao_mt5('80000000-0000-0000-0000-000000000002', pg_temp.contexto());
select is((select motivo from public.status_travas('2026-06-10')), 'perda_dia', 'as importadas fecham o dia como qualquer operação');
-- Critério 8: sem stop e alvo no relatório, o contexto precisa trazer
select throws_ok($$ select public.confirmar_importacao_mt5('80000000-0000-0000-0000-000000000003', pg_temp.contexto()) $$, 'P0001', 'Informe o stop.', 'sem stop no relatório, pede o stop');
select throws_ok($$ select public.confirmar_importacao_mt5('80000000-0000-0000-0000-000000000003', pg_temp.contexto('{"stop": 128450}')) $$, 'P0001', 'Informe o alvo.', 'sem alvo no relatório, pede o alvo');
select lives_ok($$ select public.confirmar_importacao_mt5('80000000-0000-0000-0000-000000000003', pg_temp.contexto('{"stop": 128450, "alvo": 128700}')) $$, 'com stop e alvo informados, confirma');
select is((select violacao_trava from public.operacao where aberta_em = '2026-06-10T12:00:00-03:00'), true, 'TR-03: operou com o dia fechado, entra como violação');

-- Critério 7: risco acima de 1% não é recusado na importação (já foi executada)
insert into public.importacao_mt5 (id, ticket, linha, dados) values
  ('80000000-0000-0000-0000-000000000004', '1004', 7, pg_temp.posicao('1004', '2026-06-15T10:00:00-03:00', '2026-06-15T10:10:00-03:00', 128500, 128600, 128000, 129000));
select lives_ok($$ select public.confirmar_importacao_mt5('80000000-0000-0000-0000-000000000004', pg_temp.contexto()) $$, 'T-04 não recusa operação já executada');
select is((select risco_centavos from public.operacao where aberta_em = '2026-06-15T10:00:00-03:00'), 10000::bigint, 'T-03: risco calculado pelo banco (500 pontos × R$ 0,20)');

-- Critério 3: descartar, e não mexer no que não pode
insert into public.importacao_mt5 (id, ticket, linha, dados) values ('80000000-0000-0000-0000-000000000005', '1005', 8, '{}');
select lives_ok($$ update public.importacao_mt5 set status = 'descartada' where ticket = '1005' $$, 'o dono descarta um rascunho');
select throws_ok($$ update public.importacao_mt5 set status = 'rascunho' where ticket = '1005' $$, 'P0001', 'Só dá para descartar um rascunho.', 'descartado não volta');
insert into public.importacao_mt5 (id, ticket, linha, dados) values ('80000000-0000-0000-0000-000000000006', '1006', 9, '{}');
select throws_ok($$ update public.importacao_mt5 set status = 'confirmada' where ticket = '1006' $$, 'P0001', 'Só dá para descartar um rascunho.', 'o dono não marca confirmada por conta própria');
select throws_ok($$ update public.importacao_mt5 set dados = '{"precoSaida": 999999}' where ticket = '1006' $$, 'P0001', 'Só dá para descartar um rascunho.', 'o dono não edita os dados do relatório');
-- D07: histórico de antes da primeira configuração de limites entra sem violação (não havia trava vigente)
insert into public.importacao_mt5 (id, ticket, linha, dados) values
  ('80000000-0000-0000-0000-000000000007', '1007', 10, pg_temp.posicao('1007', '2019-06-03T10:00:00-03:00', '2019-06-03T10:10:00-03:00', 128500, 128450));
select lives_ok($$ select public.confirmar_importacao_mt5('80000000-0000-0000-0000-000000000007', pg_temp.contexto()) $$, 'D07: importa operação de antes da configuração dos limites');
select is((select violacao_trava from public.operacao where aberta_em = '2019-06-03T10:00:00-03:00'), false, 'D07: sem trava vigente naquela data, não é violação');
-- O registro manual continua exigindo a configuração
select throws_ok($$
  insert into public.operacao (aberta_em, ativo, mercado, direcao, quantidade, preco_entrada, preco_stop, preco_alvo, preco_saida, multiplicador, risco_centavos,
    setup_id, tendencia_diario, tendencia_h1, tendencia_h4, timeframe_entrada, teve_noticia)
  values ('2019-06-03T11:00:00-03:00', 'WINJ27', 'mini_indice', 'compra', 1, 128500, 128450, 128600, 128550, 1, 1, (select id from public.setup limit 1), 'alta', 'alta', 'alta', '5m', false) $$,
  'P0001', 'Defina o risco por operação antes de registrar.', 'o registro manual continua exigindo os limites');
select pg_temp.sair();
select pg_temp.entrar('00000000-0000-0000-0000-0000000000b2');

-- Critério 11 e 2: B não vê nem confirma, e pode ter o mesmo ticket
select is((select count(*) from public.importacao_mt5), 0::bigint, 'RLS: B não vê rascunhos de A');
select throws_ok($$ select public.confirmar_importacao_mt5('80000000-0000-0000-0000-000000000001', '{}') $$, 'P0001', 'Rascunho de importação não encontrado.', 'B não confirma rascunho de A');
select lives_ok($$ insert into public.importacao_mt5 (ticket, linha, dados) values ('1001', 4, '{}') $$, 'outro dono pode ter o mesmo ticket');
select pg_temp.sair();

select * from finish();
rollback;
