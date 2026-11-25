# Decisões tomadas no lugar do Matheus

Uma entrada por decisão. Ele revisa no final e pode reverter qualquer uma.
Decisões de produto e de arquitetura anteriores a este modo estão em `memory/decisions.md`.

## D01 Push liberado, com branch própria
- **Contexto:** a skill escala push para o remoto; o Matheus disse em 2026-11-25 "Pode sempre enviar pro git".
- **Decisão:** trabalho na branch `full-auto/rota-do-milhao` e envio cada commit para ela no GitHub. No fim, o master avança até ela (fast-forward) e também é enviado.
- **Por quê:** a instrução dele vale por cima da regra da skill; a branch continua servindo de botão de desfazer.
- **Como reverter:** `git reset --hard ea7a47a` no master (último commit antes deste modo, ver LOG) e apagar a branch.

## D02 Hook sem as travas de push
- **Contexto:** o instalador tem a opção `--com-protecoes`, que faz todo `git push` pedir confirmação.
- **Decisão:** instalado sem essa opção (só o Stop hook e o vigia de limite).
- **Por quê:** pedir confirmação a cada push contraria a D01.
- **Como reverter:** `node <skill>/scripts/instalar-hook.js . --com-protecoes`.

## D03 Formato do MT5: relatório HTML de histórico
- **Contexto:** o backlog pede importar operações do MT5, mas não veio arquivo de exemplo.
- **Decisão:** o parser lê o relatório de histórico que o MT5 salva em HTML (Histórico, botão direito, Relatório, HTML), seção de posições, em português ou inglês, achando as colunas pelo cabeçalho. Leitura tolerante: linha que não entende vira aviso, nunca some calada.
- **Por quê:** é a exportação padrão do terminal e não exige biblioteca de planilha.
- **Como reverter:** o parser fica isolado em `src/lib/importacao/mt5.ts`; outro formato entra ao lado dele.

## D04 Importação como rascunho
- **Contexto:** o MT5 não sabe setup, tendências, timeframe nem notícia, que são obrigatórios (T-02).
- **Decisão:** cada posição do relatório vira rascunho; o dono completa o contexto e confirma, na ordem em que as operações aconteceram. A confirmação passa pelas mesmas regras do banco; se o período estava fechado naquela hora, entra como violação marcada (TR-03). T-04 não recusa operação importada, porque ela já foi executada.
- **Por quê:** importar sem contexto furaria a T-02; recusar a importação perderia dado real (Princípio nº 1).
- **Como reverter:** a confirmação é uma função do banco, `confirmar_importacao_mt5`.

## D05 Fora deste modo
- **Contexto:** o backlog tem "Ideias (não priorizadas)" e há o design system cartoon publicado.
- **Decisão:** não implemento as ideias nem aplico o visual cartoon ao app.
- **Por quê:** não estão priorizadas no plano; aplicar o visual muda o app inteiro e é escolha do dono.
- **Como reverter:** pedir explicitamente.

## D06 Meta da reserva com mês de gasto zero
- **Contexto:** ponto em aberto de `memory/decisions.md`: um mês fechado com gasto zero zera a média da P-03.
- **Decisão:** a regra fica como está escrita (média dos 3 últimos meses fechados). A tela já mostra "Sem meta ainda" quando a meta dá zero, em vez de "reserva completa".
- **Por quê:** mudar a regra de negócio é decisão do dono; o risco de enganar já está coberto pela tela.
- **Como reverter:** ajustar `metaReserva` em `src/lib/calculos/reserva.ts` e `meta_reserva` no banco.

## D07 Importação de antes da configuração dos limites
- **Contexto:** testando a tela, o relatório trouxe operações de 23 e 24/11 e os limites foram configurados em 25/11. O banco recusava com "Defina o risco por operação".
- **Decisão:** operação importada com data anterior à primeira configuração de limites entra sem violação, porque não havia trava vigente. O registro manual continua exigindo a configuração.
- **Por quê:** importar o histórico depois de configurar o sistema é o uso normal; recusar perderia dado real, e marcar violação mentiria (não havia limite).
- **Como reverter:** migration `20261125000007_importacao_antes_dos_limites.sql`.
