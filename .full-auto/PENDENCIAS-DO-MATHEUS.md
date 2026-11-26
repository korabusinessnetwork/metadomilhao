# Pendências do Matheus

Coisas que só você pode fazer. O app já funciona com contornos (Supabase local, API do Claude falsa), estas tarefas trocam o contorno pelo real.
Ordem: da mais importante para a menos importante.

## P01 Criar a sua conta de acesso no app publicado [prioridade: alta]
- **Feito pelo Claude em 2026-11-26:** projeto Supabase `rota-do-milhao` (ref `pggoncwoeyjhicgcbxye`, São Paulo, plano Free) com as 7 migrations; login com cadastro público desligado, senha mínima de 12 com letras, números e símbolos, MFA TOTP; app publicado na Vercel em https://rota-do-milhao-ochre.vercel.app com só a URL e a anon key. A senha do banco ficou em `.env.local` (`SUPABASE_DB_SENHA_PRODUCAO`), fora do git.
- **Falta (só você, porque a senha é sua):**
  1. Painel do Supabase, projeto `rota-do-milhao`, Authentication, Users, Add user, Create new user.
  2. Seu e-mail, uma senha forte (12+ com letras, números e símbolos) e marque "Auto Confirm User".
- **Como confirmar que funcionou:** abrir https://rota-do-milhao-ochre.vercel.app, entrar, cadastrar o segundo fator no app autenticador e lançar um gasto.

## P02 Ligar a revisão de notícias de verdade [prioridade: alta]
- **Por quê:** a função está pronta e testada, mas nunca chamou a IA real.
- **Contorno atual:** API falsa local (`scripts/api-falsa-anthropic.mjs`).
- **Passo a passo:**
  1. Conferir os preços do Claude Haiku 5.5 e da busca na web na página de preços da Anthropic e a cotação do dólar; ajustar `PRECO_*` e `COTACAO_USD_BRL`.
  2. Preencher `supabase/functions/.env` a partir do `.env.example` com `ANTHROPIC_API_KEY` e um `CRON_SEGREDO` aleatório longo, e rodar `supabase secrets set --env-file supabase/functions/.env`.
  3. `supabase functions deploy revisao-noticias`.
  4. Rodar `supabase/agendamento.sql` no SQL editor, trocando os dois valores entre `<>`.
- **Onde colar o resultado:** secrets do projeto Supabase.
- **Como confirmar que funcionou:** na tela Notícias, "Gerar agora" e ver a revisão com fontes reais e o custo no painel de uso.

## P03 Mandar um relatório real do MT5 [ADIADA pelo Matheus em 2026-11-25]
- **Por quê:** o importador foi escrito pelo formato padrão do relatório HTML; precisa ser conferido com um arquivo seu.
- **Contorno atual:** testado com relatórios de exemplo montados no mesmo formato.
- **Passo a passo:** no MT5, aba Histórico, botão direito, Relatório, HTML. Pode trocar valores, mantenha as colunas.
- **Onde colar o resultado:** em qualquer pasta do projeto ou na conversa.
- **Como confirmar que funcionou:** tela Trade, Importar MT5, o arquivo vira rascunhos sem avisos de linha ignorada.

## P04 Conferir os feriados de 2027 com a B3 [prioridade: média]
- **Por quê:** as travas reabrem no próximo dia de pregão e o DARF vence no último dia útil; os feriados vieram do calendário legal.
- **Contorno atual:** tabela `feriado_b3` com `confirmado = false`.
- **Passo a passo:** comparar com o calendário oficial da B3 de 2027; me dizer o que mudar, ou rodar `update public.feriado_b3 set confirmado = true where extract(year from data) = 2027;` se estiver certo.
- **Como confirmar que funcionou:** `select count(*) from public.feriado_b3 where not confirmado;` dá zero.

## P05 Instalar o app no celular [prioridade: média]
- **Por quê:** o PWA foi testado no navegador do computador, não num celular de verdade.
- **Passo a passo:** depois da P01, abrir https://rota-do-milhao-ochre.vercel.app no navegador do celular e "Adicionar à tela inicial".
- **Como confirmar que funcionou:** o ícone abre o app em tela cheia; com o modo avião, a tela de gasto abre e o gasto fica aguardando envio.

## P06 Decidir se o visual cartoon entra no app [prioridade: baixa]
- **Por quê:** o design system cartoon está publicado (https://claude.ai/artifact/CQozqPsmkRhyoqWCCxvuhK), mas o app continua com o visual atual.
- **Passo a passo:** olhar o artifact e dizer se aplica.
