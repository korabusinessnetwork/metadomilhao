# ADR-004, Revisão de notícias pré-pregão com a API do Claude, com teto de custo

**Status:** Aceito
**Data:** 2026-11-25
**Decisores:** Matheus

## Contexto
O dono quer uma revisão diária de notícias da bolsa sobre os ativos que opera, antes do pregão, para registrar o contexto de cada trade. É o único item pago aprovado, com teto de R$ 30 por mês.

## Decisão
- **Onde roda:** Edge Function `revisao-noticias`, disparada por pg_cron às 8h30 (America/Sao_Paulo) em dias úteis de pregão. Feriados da B3 ficam numa tabela de calendário.
- **Como:** uma única chamada por dia à API do Claude, com a ferramenta de busca na web, cobrindo todos os ativos ativos da watchlist (máximo 10) e a agenda macro do dia.
- **Modelo:** o modelo mais econômico da família Claude disponível na data de implementação. O nome do modelo fica em variável de ambiente, para trocar sem deploy de código.
- **Saída:** JSON validado por schema (ver `docs/10_PROMPTS/`), salvo em `revisao_noticias` com as fontes.
- **Trava de custo:** antes de chamar, a função soma `uso_ia` do mês. Com 80% do teto, grava aviso. Com 100%, não chama e salva a revisão com status `sem_orcamento` (IA-03). Limites de tokens de saída e de número de buscas por chamada definidos em variável de ambiente.
- **Chave:** `ANTHROPIC_API_KEY` só como secret da Edge Function.
- **Conteúdo:** informativo. O prompt proíbe recomendação de compra ou venda (IA-02).

## Alternativas consideradas
1. **Chamar a IA a partir do front.** Descartado: expõe a chave.
2. **Uma chamada por ativo.** Prós: mais detalhe. Contras: custo multiplicado. Descartado.
3. **Feed de notícias pago + IA só para resumo.** Contras: custo extra fora do teto. Adiado.

## Consequências
- Positivas: contexto diário registrado e vinculável às operações (IA-05), custo previsível.
- Negativas: depende da qualidade das fontes encontradas pela busca; notícias podem chegar atrasadas ou incompletas.
- Antes de ativar: estimar o custo real com o preço vigente da API e ajustar os limites de tokens e buscas para caber em R$ 30 com folga.
