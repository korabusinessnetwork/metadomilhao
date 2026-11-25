-- BUG-005: duas chamadas simultâneas de abrir_orcamento_mes para um mês novo disputavam a chave
-- única (user_id, mes) e uma falhava com 23505 (409 na API). Agora só quem cria o mês copia os
-- itens do anterior; as demais devolvem o mês já criado.
create or replace function public.abrir_orcamento_mes(p_mes date) returns uuid
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
  on conflict (user_id, mes) do nothing
  returning id into novo;
  if novo is null then
    -- outra chamada criou o mês ao mesmo tempo: ela copia os itens
    select id into novo from public.orcamento_mes where user_id = auth.uid() and mes = p_mes;
    return novo;
  end if;
  if anterior.id is not null then
    insert into public.orcamento_item (orcamento_mes_id, categoria_id, valor_centavos)
    select novo, i.categoria_id, i.valor_centavos
      from public.orcamento_item i join public.categoria c on c.id = i.categoria_id
     where i.orcamento_mes_id = anterior.id and c.ativa;
  end if;
  return novo;
end $$;

revoke execute on function public.abrir_orcamento_mes(date) from anon, public;
grant execute on function public.abrir_orcamento_mes(date) to authenticated;
