#!/usr/bin/env bash
# Teste ponta a ponta da Edge Function revisao-noticias contra a API falsa (scripts/api-falsa-anthropic.mjs).
# Pré-requisitos: supabase start, supabase functions serve, node scripts/api-falsa-anthropic.mjs. Só ambiente local.
set -euo pipefail
cd "$(dirname "$0")/.."

FUNC=http://127.0.0.1:55321/functions/v1/revisao-noticias
SEGREDO=$(grep '^CRON_SEGREDO=' supabase/functions/.env | cut -d= -f2-)
sql() { docker exec -i supabase_db_metadomilhao psql -U postgres -tAq -v ON_ERROR_STOP=1 -c "$1"; }
modo() { curl -s -X POST http://localhost:8787/modo -d "{\"modo\":\"$1\"}" > /dev/null; }
cron() { curl -s -X POST "$FUNC" -H "x-segredo-cron: $1"; }
falhas=0
confere() { if [ "$2" = "$3" ]; then echo "ok   - $1"; else echo "FALHA - $1 (esperado: $3, veio: $2)"; falhas=$((falhas+1)); fi; }

# Usuário próprio do roteiro: tudo o que ele apaga ou confere é só dele
U=00000000-0000-0000-0000-00000000e2e0
sql "insert into auth.users (id, email, aud, role) values ('$U', 'e2e@rota.test', 'authenticated', 'authenticated') on conflict (id) do nothing;"
limpar() { sql "delete from public.revisao_noticias where user_id = '$U'; delete from public.uso_ia where user_id = '$U';"; }
ultima() { sql "select $1 from public.revisao_noticias where user_id = '$U' order by gerada_em desc limit 1"; }
# Os outros usuários com watchlist pausam durante o roteiro (o disparo agendado processa todos)
OUTROS=$(sql "select string_agg(id::text, ',') from public.watchlist where ativa and user_id <> '$U'")
sql "update public.watchlist set ativa = false where user_id <> '$U' and ativa;"
trap 'sql "update public.watchlist set ativa = true where id::text = any(string_to_array('"'"'${OUTROS:-}'"'"', '"'"','"'"'))" > /dev/null' EXIT
limpar
sql "delete from public.watchlist where user_id = '$U'; insert into public.watchlist (user_id, ativo, mercado) values ('$U', 'PETR4', 'acoes'), ('$U', 'WINZ26', 'mini_indice');"
HOJE=$(sql "select public.hoje_sp()")
PREGAO=$(sql "select public.e_dia_pregao(public.hoje_sp())")

confere "segredo errado é recusado" "$(cron errado | grep -o '"codigo":"[a-z_]*"')" '"codigo":"nao_autorizado"'
confere "sem segredo nem JWT é recusado" "$(curl -s -X POST "$FUNC" | grep -o '"codigo":"[a-z_]*"')" '"codigo":"nao_autorizado"'

if [ "$PREGAO" != "t" ]; then echo "hoje ($HOJE) não é dia de pregão: o resto do roteiro precisa de um dia útil"; exit 1; fi

modo ok
cron "$SEGREDO" > /dev/null
confere "revisão ok gravada" "$(ultima "status")" "ok"
confere "uma notícia com fonte guardada (IA-04)" "$(ultima "jsonb_array_length(fontes)")" "1"
# 30000 × 0,10/M + 2000 × 0,50/M + 2 × 0,01 = US$ 0,024 × 5,60 = R$ 0,1344 → 14 centavos
confere "custo estimado gravado (IA-04)" "$(ultima "custo_estimado_centavos")" "14"
confere "uso do mês somado (IA-03)" "$(sql "select chamadas || '/' || custo_estimado_centavos from public.uso_ia where user_id = '$U'")" "1/14"
CH=$(curl -s http://localhost:8787/chamadas)
confere "modelo econômico e busca limitada (ADR-004)" "$(echo "$CH" | grep -o '"ferramentas":\["[^]]*\]')" '"ferramentas":["web_search_20250305:5"]'
confere "prompt do sistema proíbe recomendação (IA-02)" "$(echo "$CH" | grep -o '"sistemaProibeRecomendacao":true')" '"sistemaProibeRecomendacao":true'
confere "agendada não repete no mesmo dia" "$(cron "$SEGREDO" | grep -o '"status":"ja_gerada"')" '"status":"ja_gerada"'

limpar
modo invalido_depois_ok
cron "$SEGREDO" > /dev/null
confere "JSON inválido ganha uma nova tentativa e passa" "$(ultima "status")" "ok"
confere "a nova tentativa leva o erro de volta" "$(curl -s http://localhost:8787/chamadas | grep -o '"mensagens":3')" '"mensagens":3'

limpar
modo recomendacao
cron "$SEGREDO" > /dev/null
confere "recomendação explícita reprova a revisão (IA-02)" "$(ultima "status || ': ' || erro")" "erro: A resposta contém recomendação de compra ou venda."

limpar
modo pause_turn
cron "$SEGREDO" > /dev/null
confere "pause_turn é retomado" "$(ultima "status")" "ok"

limpar
modo erro401
cron "$SEGREDO" > /dev/null
confere "chave inválida vira erro legível, sem detalhe sensível" "$(ultima "erro")" "Chave da API do Claude inválida."

# IA-03: uso perto do teto gera aviso; no teto, não chama a API
limpar; sql "insert into public.uso_ia (user_id, mes, custo_estimado_centavos) values ('$U', date_trunc('month', public.hoje_sp())::date, 2390);"
modo ok
cron "$SEGREDO" > /dev/null
confere "aviso aos 80% do teto (IA-03)" "$(ultima "aviso_orcamento")" "t"
sql "delete from public.revisao_noticias where user_id = '$U'; update public.uso_ia set custo_estimado_centavos = 3000 where user_id = '$U';"
modo ok
cron "$SEGREDO" > /dev/null
confere "no teto, grava sem_orcamento (IA-03)" "$(ultima "status")" "sem_orcamento"
confere "no teto, a API não é chamada (IA-03)" "$(curl -s http://localhost:8787/chamadas)" "[]"

limpar
echo "falhas: $falhas"
[ "$falhas" -eq 0 ]
