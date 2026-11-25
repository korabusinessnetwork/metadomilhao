-- Testes de banco da Fase 3: calendário da B3, watchlist (IA-01), escrita só pela função, IA-05.
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

-- ---------- Calendário ----------
select is(public.e_dia_pregao('2027-02-08'), false, 'Carnaval não tem pregão');
select is(public.e_dia_pregao('2027-02-10'), true, 'quarta de cinzas tem pregão');
select is(public.proximo_dia_util('2027-02-05'), '2027-02-10'::date, 'TR-05: sexta antes do Carnaval reabre na quarta');
select is(public.proximo_dia_util('2026-12-23'), '2026-12-28'::date, 'pula 24/12 (sem pregão), 25/12 e o fim de semana');
select is(public.primeiro_dia_util('2027-01-01'), '2027-01-04'::date, 'M-13: mês reabre no primeiro dia de pregão');
select is(public.e_dia_pregao('2027-03-24'), true, 'dia comum tem pregão');

-- ---------- Watchlist (IA-01) ----------
select pg_temp.entrar('00000000-0000-0000-0000-0000000000a1');
insert into public.watchlist (ativo, mercado)
select 'ATV' || lpad(g::text, 2, '0') || 'X', 'acoes' from generate_series(1, 10) g;
select is((select count(*) from public.watchlist where ativa), 10::bigint, 'IA-01: cabem 10 ativos ativos');
select throws_ok($$ insert into public.watchlist (ativo, mercado) values ('PETR4', 'acoes') $$,
  'P0001', 'A watchlist tem no máximo 10 ativos ativos (IA-01).', 'IA-01: o 11º ativo ativo é recusado');
select lives_ok($$ insert into public.watchlist (ativo, mercado, ativa) values ('PETR4', 'acoes', false) $$, 'inativo não conta no limite');
select throws_ok($$ update public.watchlist set ativa = true where ativo = 'PETR4' $$,
  'P0001', 'A watchlist tem no máximo 10 ativos ativos (IA-01).', 'IA-01: reativar o 11º também é recusado');
update public.watchlist set ativa = false where ativo = 'ATV01X';
select lives_ok($$ update public.watchlist set ativa = true where ativo = 'PETR4' $$, 'com vaga, reativa');

-- ---------- Escrita só pela função ----------
select throws_ok($$ insert into public.revisao_noticias (user_id, data, origem, versao_prompt, status) values ('00000000-0000-0000-0000-0000000000a1', '2027-03-10', 'manual', 'v1', 'ok') $$,
  '42501', null, 'o usuário não grava revisão (só a Edge Function)');
select throws_ok($$ insert into public.uso_ia (user_id, mes) values ('00000000-0000-0000-0000-0000000000a1', '2027-03-01') $$,
  '42501', null, 'o usuário não grava uso de IA (a trava de custo não se burla)');
select throws_ok($$ select public.registrar_uso_ia('00000000-0000-0000-0000-0000000000a1', '2027-03-01', 1, 1, 1, 1) $$,
  '42501', null, 'o usuário não executa registrar_uso_ia');
select pg_temp.sair();

-- service_role (a Edge Function) grava e soma
set local role service_role;
select is(public.registrar_uso_ia('00000000-0000-0000-0000-0000000000a1', '2027-03-01', 40000, 3000, 5, 32), 32::bigint, 'IA-03: primeira chamada do mês');
select is(public.registrar_uso_ia('00000000-0000-0000-0000-0000000000a1', '2027-03-01', 40000, 3000, 5, 32), 64::bigint, 'IA-03: uso soma no mês');
insert into public.revisao_noticias (id, user_id, data, origem, versao_prompt, status, conteudo)
values ('60000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', public.hoje_sp(), 'agendada', 'v1', 'ok', '[]'),
       ('60000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a1', public.hoje_sp(), 'manual', 'v1', 'sem_orcamento', null);
select pg_temp.sair();

-- ---------- IA-05 e isolamento ----------
select pg_temp.entrar('00000000-0000-0000-0000-0000000000a1');
select is((select chamadas from public.uso_ia), 2, 'o dono lê o próprio uso');
select is((select count(*) from public.revisao_noticias), 2::bigint, 'o dono lê as próprias revisões');

select pg_temp.entrar('00000000-0000-0000-0000-0000000000b2');
select is((select count(*) from public.watchlist) + (select count(*) from public.revisao_noticias) + (select count(*) from public.uso_ia), 0::bigint,
  'RLS: B não vê watchlist, revisões nem uso de A');
select is((select count(*) from public.feriado_b3) > 0, true, 'o calendário é público para quem está logado');
select throws_ok($$ insert into public.feriado_b3 (data, descricao, nacional) values ('2027-06-01', 'x', true) $$, '42501', null, 'ninguém altera o calendário pelo app');
select pg_temp.sair();

-- Operação de B não vincula revisão de A (IA-05)
select pg_temp.entrar('00000000-0000-0000-0000-0000000000b2');
insert into public.ativo_carteira (id, nome, classe) values ('40000000-0000-0000-0000-0000000000b1', 'Reserva', 'reserva'), ('40000000-0000-0000-0000-0000000000b2', 'Corretora', 'capital_trade');
insert into public.categoria (id, nome, tipo) values ('10000000-0000-0000-0000-0000000000b1', 'Mercado', 'variavel');
insert into public.orcamento_mes (id, mes) values ('20000000-0000-0000-0000-0000000000b1', date_trunc('month', public.hoje_sp())::date);
insert into public.orcamento_item (orcamento_mes_id, categoria_id, valor_centavos) values ('20000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-0000000000b1', 100000);
insert into public.movimento_carteira (ativo_id, data, tipo, valor_centavos) values ('40000000-0000-0000-0000-0000000000b1', public.hoje_sp(), 'aporte', 900000);
insert into public.movimento_carteira (ativo_id, data, tipo, valor_centavos) values ('40000000-0000-0000-0000-0000000000b2', public.hoje_sp(), 'aporte', 100000);
insert into public.setup (id, nome) values ('70000000-0000-0000-0000-0000000000b1', 'FVG');
insert into public.conta_trade (ativo_id) values ('40000000-0000-0000-0000-0000000000b2');
insert into public.parametros_trade (vigente_desde, risco_operacao_centavos) values (public.hoje_sp(), 1000);
select throws_ok($$
  insert into public.operacao (aberta_em, ativo, mercado, direcao, quantidade, preco_entrada, preco_stop, preco_alvo, multiplicador, risco_centavos,
    setup_id, tendencia_diario, tendencia_h1, tendencia_h4, timeframe_entrada, teve_noticia, revisao_noticias_id)
  values (now(), 'WINZ26', 'mini_indice', 'compra', 1, 100000, 99950, 100100, 1, 1, '70000000-0000-0000-0000-0000000000b1',
    'alta', 'alta', 'alta', '5m', false, '60000000-0000-0000-0000-0000000000a1') $$,
  'P0001', 'Revisão de notícias não encontrada.', 'IA-05: B não vincula a revisão de A');
select pg_temp.sair();

-- O dono vincula a própria revisão ok, mas não uma sem orçamento
select pg_temp.sair();
select * from finish();
rollback;
