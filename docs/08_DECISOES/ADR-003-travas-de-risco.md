# ADR-003, Travas de risco aplicadas no banco, sem esconder violações

**Status:** Aceito
**Data:** 2026-11-25
**Decisores:** Matheus

## Contexto
O dono escolheu que, ao bater o limite de perda do dia ou do mês (ou a meta de lucro do dia), o sistema bloqueie novos registros até o período seguinte, sem jeito fácil de burlar. Mas o sistema não controla a corretora: se o dono operar mesmo bloqueado, bloquear o registro faria o diário mentir, o que fere o Princípio nº 1.

## Decisão
1. A trava vive no banco: um trigger `before insert` em `operacao` consulta `v_status_travas` e recusa operações com `violacao_trava = false` quando o dia, a semana ou o mês estão fechados (TR-01, TR-02, TR-04).
2. O registro de uma operação já executada continua possível, mas só com `violacao_trava = true`, que exige confirmação explícita na tela e aparece em destaque nas estatísticas e no fechamento (TR-03, TR-06).
3. Não existe desbloqueio manual. A reabertura é automática pela data (TR-05).
4. Mudar os limites (M-10 a M-13) só vale a partir do período seguinte, nunca no meio de um período fechado.

## Alternativas consideradas
1. **Bloqueio total, inclusive do registro de violação.** Prós: mais duro. Contras: perde dado real, incentiva não registrar. Descartado.
2. **Só aviso.** Prós: simples. Contras: não protege. Descartado pela escolha do dono.
3. **Trava só no front.** Prós: fácil. Contras: burlável por qualquer outro cliente ou pela API. Descartado.

## Consequências
- Positivas: disciplina garantida pelo sistema, dado sempre verdadeiro, violações medidas.
- Negativas: trigger exige teste cuidadoso de fuso horário e de limites de semana e mês.
- Testes obrigatórios: virada de dia às 00h (America/Sao_Paulo), semana começando na segunda, mês com feriado, mudança de limite no meio do período.
