# Relatório final: Rota do Milhão (modo Full Automático)

## Resumo
Este modo fechou o que faltava do backlog que não depende de você: a importação do MT5 (leitura do relatório, rascunhos e tela de confirmação), a prova de que o app abre sem internet no build de produção e o projeto pronto para publicar na Vercel com cabeçalhos de segurança. Tudo verificado no navegador e enviado para a branch `full-auto/rota-do-milhao` e para o `master`.

## Como rodar
```
npm install && supabase start && npm run dev
```
(primeira vez: copie `.env.example` para `.env.local` com a URL e a anon key do `supabase status`; ver README)

## O que está pronto
- Leitura do relatório HTML do MT5 em português e inglês, com aviso por linha ilegível (12 testes, `src/lib/importacao/mt5.test.ts`).
- Rascunhos de importação no banco: ticket único, confirmação em ordem, violação marcada se o período estava fechado, sem T-04 para o que já foi executado, origem `mt5` só pela função (26 testes de banco em `fase4.test.sql`, mais a chamada real pela API recusada).
- Tela Trade, Importar MT5 (verificado no navegador: 2 posições importadas, uma pedindo stop e alvo, reimportação sem duplicar, operações nas estatísticas).
- PWA abre sem servidor e sem API no build de produção e manda o gasto para a fila (verificado no navegador).
- `vercel.json` com reescrita de rotas, CSP e demais cabeçalhos; conferido servindo o build com os mesmos cabeçalhos: nenhuma violação, inclusive no QR code do segundo fator. README com a seção Publicar.

## O que está mockado ou local
| Parte | Contorno | Pendência |
|---|---|---|
| Banco e login | Supabase local no Docker | P01 |
| Publicação | build pronto, `vercel.json` conferido localmente | P01 |
| Revisão de notícias | API falsa local (`scripts/api-falsa-anthropic.mjs`) | P02 |
| Importação do MT5 | testada com relatórios de exemplo no formato padrão | P03 |
| Feriados de 2027 | calendário legal, `confirmado = false` | P04 |

## Suas pendências (em ordem)
1. P01 Criar o projeto Supabase e publicar na Vercel, cerca de 30 min (README, seção Publicar).
2. P02 Ligar a revisão de notícias de verdade: conferir preços, cadastrar a chave e o segredo, rodar o agendamento, cerca de 15 min.
3. P03 Mandar um relatório real do MT5 para conferir o importador, 5 min.
4. P04 Conferir os feriados de 2027 com a B3, 10 min.
5. P05 Instalar o app no celular depois da P01, 5 min.
6. P06 Decidir se o visual cartoon entra no app.

## Decisões principais
- D01 Push liberado: trabalho na branch `full-auto/rota-do-milhao`, `master` avançado até ela no fim.
- D02 Hook instalado sem a trava que pede confirmação a cada push.
- D03 MT5 pelo relatório HTML padrão, colunas achadas pelo cabeçalho.
- D04 Importação vira rascunho; contexto completado por você; violação marcada quando o período estava fechado.
- D05 Ideias não priorizadas e visual cartoon ficaram de fora.
- D06 Meta da reserva com mês de gasto zero: regra mantida, a tela já não engana.
- D07 Histórico importado de antes da configuração dos limites entra sem violação (achado no teste pela tela).
(lista completa em `.full-auto/DECISOES.md`)

## Bloqueios
- Nenhum. Nenhuma tarefa ficou `[!]`.

## Verificação final
- Instalação limpa: ok (`npm ci`, 379 pacotes; a primeira tentativa falhou porque o servidor de desenvolvimento segurava um arquivo do bundler, e passou depois de parar o servidor).
- Build: ok (`npm run build`, typecheck sem erro).
- Testes: 126 de 126 no cliente (`npm test`), 133 de 133 no banco recriado do zero (`supabase test db`), 17 de 17 ponta a ponta da revisão de notícias (`scripts/e2e-revisao.sh`).
- Fluxo principal testado pelo Claude no navegador: sim, do zero, com os cabeçalhos de produção (login, segundo fator com QR code, configuração inicial, orçamento, primeiro gasto e limite de R$ 70,00 conferido à mão).
- Alertas do npm: 4 moderados, todos do gerador do service worker (`workbox-build`), que roda só no build.

## Próximos passos sugeridos
- Resolver P01 e P02 juntos: são o que transforma o sistema local em app de uso diário.
- Depois de 30 dias operando, revisar a meta de lucro diária (M-10), como pede `memory/decisions.md`.
