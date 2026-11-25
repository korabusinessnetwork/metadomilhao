# Spec: rascunhos de importação do MT5 no banco (T02)

## 1. Escopo
Tabela de rascunhos para as posições lidas do relatório do MT5 e uma função do banco que transforma um rascunho, com o contexto completado pelo dono, numa operação de origem `mt5` que passa pelas mesmas regras do diário.

## 2. Fora de escopo
- Tela e serviço do cliente (T03).
- Apagar rascunho: só descartar (fica no histórico).
- Reprocessar uma operação já confirmada.

## 3. Origem e decisões que este item honra
- Backlog Fase 4, "Importar operações do MT5". `.full-auto/DECISOES.md` D04 (rascunho, confirmação em ordem, violação automática, sem T-04 para o que já foi executado).
- ADR-003 (travas no banco, violação nunca escondida), T-02 (contexto obrigatório), T-03 (risco calculado no banco), ADR-002 (RLS de dono com MFA).

## 4. Arquivos afetados
- `supabase/migrations/20261125000006_importacao_mt5.sql` (novo)
- `supabase/tests/database/fase4.test.sql` (novo)

## 5. Critérios de aceite
1. Tabela `importacao_mt5` com `user_id`, `ticket`, `linha`, `dados jsonb`, `status` (`rascunho`, `confirmada`, `descartada`), `operacao_id`, com RLS de dono (aal2) e privilégios explícitos.
2. O mesmo ticket do mesmo dono não entra duas vezes (chave única); outro dono pode ter o mesmo ticket.
3. O dono só cria rascunho com status `rascunho`, e só muda um rascunho para `descartada`. Não muda para `confirmada` nem edita os dados.
4. `confirmar_importacao_mt5(id, contexto)` cria a operação com origem `mt5`, horários reais de abertura e fechamento do relatório, saída, custos e o contexto (setup, tendências, timeframe, notícia, seguiu o plano, observação), marca o rascunho como `confirmada` com o `operacao_id` e devolve o id da operação.
5. A confirmação segue a ordem do relatório: com rascunho mais antigo do mesmo dono ainda pendente, recusa com mensagem que diz qual confirmar antes.
6. Se o período (dia, semana ou mês) estava fechado naquele momento, a operação entra com `violacao_trava = true`; se aberto, `false` (TR-03, nunca esconder).
7. T-04 não recusa operação importada; risco e resultado são calculados pelo banco como em qualquer operação (T-03, T-05).
8. Stop e alvo: usa os do relatório; se faltarem, o contexto precisa trazê-los, senão recusa com "Informe o stop" ou "Informe o alvo".
9. Ninguém cria operação com origem `mt5` direto na tabela: só a função consegue.
10. Rascunho já confirmado ou descartado não confirma de novo.
11. Outro usuário não vê nem confirma rascunho alheio.

## 6. Edge cases conhecidos
- Rascunho sem conta de trade ou sem parâmetros: a mensagem do trigger da operação chega ao dono.
- Venda com stop acima e alvo abaixo da entrada (o trigger já valida a direção).
- Duas posições no mesmo segundo: ordem por abertura e, no empate, pela linha do relatório.

## 7. Definição de "aprovado sem ressalvas"
Todos os critérios em sim, `supabase test db` verde (todos os arquivos), `npm test` verde, sem regressão nas fases anteriores.

## Resultado da review (2026-11-25)
✅ Aprovado sem ressalvas na 1ª rodada. `supabase test db`: 130 testes verdes (4 arquivos, 23 novos); `npm test`: 122 verdes.

| # | Critério | Evidência |
|---|---|---|
| 1 | Tabela, RLS com aal2, privilégios explícitos | migration `20261125000006`, políticas `e_dono` e `grant` |
| 2 | Ticket único por dono | testes "não importa duas vezes" e "outro dono pode ter o mesmo ticket" |
| 3 | Só nasce rascunho, só se descarta | testes de insert confirmado, descartar, voltar, marcar confirmada e editar dados |
| 4 | Confirmar cria a operação mt5 com horários reais e contexto | teste "operação mt5 com fechamento real, custos e contexto" |
| 5 | Em ordem | teste "confirmação segue a ordem do relatório" |
| 6 | Período fechado vira violação | testes "fecham o dia" e "entra como violação" |
| 7 | Sem T-04, com T-03 | testes "T-04 não recusa" e risco de 10000 centavos |
| 8 | Pede stop e alvo quando faltam | testes "pede o stop" e "pede o alvo" |
| 9 | Origem mt5 só pela função | teste no banco + chamada real pela API com token de usuário: `set_config` não existe (404) e o insert direto é recusado |
| 10 | Não confirma duas vezes | teste "não confirma duas vezes" |
| 11 | Isolamento | testes de B |

Corrigido antes de rodar: um teste "placeholder" que passaria sem testar nada foi trocado pelos dois casos reais do critério 3.
