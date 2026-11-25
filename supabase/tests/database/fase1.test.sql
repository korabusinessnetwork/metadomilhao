-- Testes de banco da Fase 1: RLS, só-inclusão, estorno, fechamento imutável e O-02.
-- Rodar com: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

-- Dois usuários: A (dono) e B (usuário de teste que deve ver zero linhas)
insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-0000000000a1', 'a@teste.local', 'authenticated', 'authenticated'),
       ('00000000-0000-0000-0000-0000000000b2', 'b@teste.local', 'authenticated', 'authenticated');

create function pg_temp.entrar(uid text, nivel text default 'aal2') returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', nivel)::text, true);
end $$;

create function pg_temp.sair() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- ---------- Dados do usuário A ----------
select pg_temp.entrar('00000000-0000-0000-0000-0000000000a1');

insert into public.perfil (nome) values ('A');
insert into public.plano_milhao default values;
insert into public.categoria (id, nome, tipo) values
  ('10000000-0000-0000-0000-000000000001', 'Moradia', 'fixa'),
  ('10000000-0000-0000-0000-000000000002', 'Mercado', 'variavel');
insert into public.orcamento_mes (id, mes, renda_prevista_centavos)
  values ('20000000-0000-0000-0000-000000000001', '2027-03-01', 560000);
insert into public.orcamento_item (orcamento_mes_id, categoria_id, valor_centavos) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 50000),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 93000);
insert into public.renda (mes, fonte, valor_centavos, recebido_em) values ('2027-03-01', 'salario', 400000, '2027-03-05');
insert into public.lancamento (id, data, categoria_id, valor_centavos)
  values ('30000000-0000-0000-0000-000000000001', '2027-03-02', '10000000-0000-0000-0000-000000000002', 4500);
insert into public.ativo_carteira (id, nome, classe) values ('40000000-0000-0000-0000-000000000001', 'Reserva CDB', 'reserva');
insert into public.movimento_carteira (ativo_id, data, tipo, valor_centavos) values
  ('40000000-0000-0000-0000-000000000001', '2027-03-10', 'aporte', 100000),
  ('40000000-0000-0000-0000-000000000001', '2027-03-20', 'resgate', -20000),
  ('40000000-0000-0000-0000-000000000001', '2027-03-31', 'rendimento', 450);
insert into public.fechamento_mes (id, mes, renda_real, gasto_real, aporte_real, patrimonio_real, patrimonio_projetado, meta_batida)
  values ('50000000-0000-0000-0000-000000000001', '2027-03-01', 560000, 300000, 100000, 80450, 88500, false);

-- ---------- Saldo = soma dos movimentos ----------
select is((select saldo_centavos from public.v_saldo_ativo where ativo_id = '40000000-0000-0000-0000-000000000001'),
          80450::bigint, 'saldo do ativo é a soma dos movimentos');

-- ---------- O-04 / O-05: sinais e estorno ----------
select throws_ok($$ insert into public.lancamento (data, categoria_id, valor_centavos)
                    values ('2027-03-02', '10000000-0000-0000-0000-000000000002', -100) $$,
                 '23514', null, 'O-04: valor negativo sem estorno é recusado');
select throws_ok($$ insert into public.lancamento (data, categoria_id, valor_centavos)
                    values ('2027-03-02', '10000000-0000-0000-0000-000000000002', 0) $$,
                 '23514', null, 'O-04: valor zero é recusado');
select throws_ok($$ insert into public.lancamento (data, categoria_id, valor_centavos, estorno_de)
                    values ('2027-03-03', '10000000-0000-0000-0000-000000000002', -4000, '30000000-0000-0000-0000-000000000001') $$,
                 'P0001', 'O estorno precisa ter o valor oposto e a mesma categoria do original.', 'O-05: estorno com valor diferente é recusado');
select lives_ok($$ insert into public.lancamento (id, data, categoria_id, valor_centavos, estorno_de)
                   values ('30000000-0000-0000-0000-000000000002', '2027-03-03', '10000000-0000-0000-0000-000000000002', -4500, '30000000-0000-0000-0000-000000000001') $$,
                'O-05: estorno com valor oposto é aceito');
select throws_ok($$ insert into public.lancamento (data, categoria_id, valor_centavos, estorno_de)
                    values ('2027-03-03', '10000000-0000-0000-0000-000000000002', -4500, '30000000-0000-0000-0000-000000000001') $$,
                 '23505', null, 'O-05: o mesmo lançamento não é estornado duas vezes');
select throws_ok($$ insert into public.lancamento (data, categoria_id, valor_centavos, estorno_de)
                    values ('2027-03-03', '10000000-0000-0000-0000-000000000002', 4500, '30000000-0000-0000-0000-000000000002') $$,
                 'P0001', 'Não é possível estornar um estorno.', 'O-05: não se estorna um estorno');

-- ---------- Histórico em vez de edição ----------
select throws_ok($$ update public.lancamento set valor_centavos = 1 where id = '30000000-0000-0000-0000-000000000001' $$,
                 '42501', null, 'lançamento não pode ser editado');
select throws_ok($$ delete from public.lancamento where id = '30000000-0000-0000-0000-000000000001' $$,
                 '42501', null, 'lançamento não pode ser apagado');
select throws_ok($$ update public.movimento_carteira set valor_centavos = 1 $$,
                 '42501', null, 'movimento da carteira não pode ser editado');
select throws_ok($$ update public.fechamento_mes set gasto_real = 1 $$,
                 '42501', null, 'fechamento não pode ser editado');
select throws_ok($$ delete from public.fechamento_mes $$,
                 '42501', null, 'fechamento não pode ser apagado');

-- ---------- Movimentos: sinal por tipo ----------
select throws_ok($$ insert into public.movimento_carteira (ativo_id, data, tipo, valor_centavos)
                    values ('40000000-0000-0000-0000-000000000001', '2027-03-10', 'aporte', -100) $$,
                 '23514', null, 'aporte negativo é recusado');
select throws_ok($$ insert into public.movimento_carteira (ativo_id, data, tipo, valor_centavos)
                    values ('40000000-0000-0000-0000-000000000001', '2027-03-10', 'resgate', 100) $$,
                 '23514', null, 'resgate positivo é recusado');

-- ---------- Fechamento imutável, correção por substituição ----------
select throws_ok($$ insert into public.fechamento_mes (mes, renda_real, gasto_real, aporte_real, patrimonio_real, patrimonio_projetado, meta_batida)
                    values ('2027-03-01', 1, 1, 1, 1, 1, false) $$,
                 'P0001', 'Este mês já foi fechado. Para corrigir, registre uma substituição.', 'segundo fechamento do mês sem substituição é recusado');
select lives_ok($$ insert into public.fechamento_mes (mes, renda_real, gasto_real, aporte_real, patrimonio_real, patrimonio_projetado, meta_batida, substitui)
                   values ('2027-03-01', 560000, 290000, 110000, 90450, 88500, true, '50000000-0000-0000-0000-000000000001') $$,
                'correção do fechamento entra como substituição');
select is((select count(*) from public.v_fechamento_vigente where mes = '2027-03-01'), 1::bigint, 'só um fechamento vigente por mês');
select is((select gasto_real from public.v_fechamento_vigente where mes = '2027-03-01'), 290000::bigint, 'o vigente é a correção');
select is((select count(*) from public.fechamento_mes where mes = '2027-03-01'), 2::bigint, 'o original continua no histórico');

-- ---------- O-02: abrir mês copia o anterior ----------
select isnt(public.abrir_orcamento_mes('2027-04-01'), null, 'abre abril');
select is((select count(*) from public.orcamento_item i join public.orcamento_mes o on o.id = i.orcamento_mes_id where o.mes = '2027-04-01'),
          2::bigint, 'O-02: abril recebe os itens de março');
select is((select renda_prevista_centavos from public.orcamento_mes where mes = '2027-04-01'), 560000::bigint, 'O-02: renda prevista copiada');
select is(public.abrir_orcamento_mes('2027-04-01'), (select id from public.orcamento_mes where mes = '2027-04-01'), 'abrir de novo devolve o mesmo mês');

-- O-02: um mês que já passou do dia 5 registra a mudança no histórico; um mês futuro não
insert into public.orcamento_mes (id, mes) values ('20000000-0000-0000-0000-000000000009', '2020-01-01');
insert into public.orcamento_item (orcamento_mes_id, categoria_id, valor_centavos)
  values ('20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000002', 93000);
update public.orcamento_item set valor_centavos = 95000 where orcamento_mes_id = '20000000-0000-0000-0000-000000000009';
select is((select valor_anterior_centavos from public.orcamento_historico
            where orcamento_mes_id = '20000000-0000-0000-0000-000000000009' and valor_novo_centavos = 95000),
          93000::bigint, 'O-02: mudança depois do dia 5 gera histórico');
select isnt((select travado_em from public.orcamento_mes where id = '20000000-0000-0000-0000-000000000009'), null, 'O-02: mês marcado como travado');
update public.orcamento_item set valor_centavos = 94000
 where orcamento_mes_id = '20000000-0000-0000-0000-000000000001' and categoria_id = '10000000-0000-0000-0000-000000000002';
select is((select count(*) from public.orcamento_historico where orcamento_mes_id = '20000000-0000-0000-0000-000000000001'),
          0::bigint, 'O-02: mês futuro ajusta sem histórico');
select throws_ok($$ insert into public.orcamento_historico (orcamento_mes_id, categoria_id, valor_novo_centavos)
                    values ('20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000002', 1) $$,
                 '42501', null, 'O-02: histórico não aceita gravação direta');

-- ---------- Isolamento: B não vê nada de A ----------
select pg_temp.entrar('00000000-0000-0000-0000-0000000000b2');
select is((select count(*) from public.perfil) + (select count(*) from public.plano_milhao) + (select count(*) from public.categoria)
        + (select count(*) from public.orcamento_mes) + (select count(*) from public.orcamento_item) + (select count(*) from public.orcamento_historico)
        + (select count(*) from public.renda) + (select count(*) from public.lancamento) + (select count(*) from public.ativo_carteira)
        + (select count(*) from public.movimento_carteira) + (select count(*) from public.fechamento_mes),
          0::bigint, 'RLS: usuário B vê zero linhas nas 11 tabelas');
select is((select count(*) from public.v_saldo_ativo) + (select count(*) from public.v_fechamento_vigente) + (select count(*) from public.v_limite_gasto_hoje),
          0::bigint, 'RLS: usuário B vê zero linhas nas views');
select throws_ok($$ insert into public.categoria (user_id, nome, tipo) values ('00000000-0000-0000-0000-0000000000a1', 'Invasão', 'fixa') $$,
                 '42501', null, 'RLS: B não grava com o user_id de A');
select throws_ok($$ insert into public.lancamento (data, categoria_id, valor_centavos)
                    values ('2027-03-02', '10000000-0000-0000-0000-000000000002', 100) $$,
                 'P0001', 'Categoria não encontrada.', 'B não lança na categoria de A');
select throws_ok($$ insert into public.movimento_carteira (ativo_id, data, tipo, valor_centavos)
                    values ('40000000-0000-0000-0000-000000000001', '2027-03-10', 'aporte', 100) $$,
                 'P0001', 'Ativo não encontrado.', 'B não movimenta o ativo de A');
update public.categoria set nome = 'x';
delete from public.ativo_carteira;
select pg_temp.sair();
select is((select count(*) from public.categoria where nome = 'x'), 0::bigint, 'RLS: update de B não alcança A');
select is((select count(*) from public.ativo_carteira where user_id = '00000000-0000-0000-0000-0000000000a1'), 1::bigint, 'RLS: delete de B não alcança A');

-- ---------- MFA: o próprio dono sem segundo fator não vê nada ----------
select pg_temp.entrar('00000000-0000-0000-0000-0000000000a1', 'aal1');
select is((select count(*) from public.lancamento) + (select count(*) from public.categoria), 0::bigint, 'MFA: sessão aal1 do dono vê zero linhas');
select throws_ok($$ insert into public.categoria (nome, tipo) values ('Sem MFA', 'fixa') $$, '42501', null, 'MFA: sessão aal1 não grava');
select pg_temp.sair();

-- ---------- Papel anônimo não acessa nada ----------
select set_config('role', 'anon', true);
select throws_ok($$ select id from public.lancamento $$, '42501', null, 'anon não lê lançamentos');
select throws_ok($$ select public.abrir_orcamento_mes('2027-05-01') $$, '42501', null, 'anon não executa funções');
select pg_temp.sair();

select * from finish();
rollback;
