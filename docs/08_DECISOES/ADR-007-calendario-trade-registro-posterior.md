# ADR-007, Calendário do diário de trade com registro posterior

**Status:** Aceito
**Data:** 2026-11-26
**Decisores:** Matheus

## Contexto
A tela Trade mostrava só o dia de hoje. O dono pediu que ela fosse um calendário, onde ele toca no dia e registra a operação feita naquele dia. Isso inclui dias que já passaram, o que esbarra em duas regras: a operação é planejada antes e encerrada depois (fluxo do dia), e as travas valem no banco (ADR-003).

## Decisão (regra T-10)
- A tela Trade abre com o calendário do mês: só segunda a sexta, com o líquido de cada dia (em reais, arredondado, com sinal) e a marca de violação. Tocar no dia abre o detalhe com as operações em centavos.
- **Hoje:** continua igual (planejar, depois registrar a saída; encerrar o dia).
- **Dia passado:** a operação entra já com a saída e a hora da entrada. O banco recusa dia sem pregão (fim de semana e feriado da B3) e operação de dia passado sem saída.
- **As travas do próprio dia valem:** se o dia estava aberto, entra normal e passa pela T-04 com o capital do início daquele dia; se estava fechado, só entra como violação (TR-03).
- **Fica marcada como "registrada depois":** sai de `criado_em`, que agora o banco carimba sempre na inserção e não deixa mudar (antes o cliente podia mandar outro valor). Não há coluna nova.
- **Dia futuro:** bloqueado, na tela e no banco (já era).
- Migration `20261126000009_registro_posterior.sql`; testes em `supabase/tests/database/fase5.test.sql`.

## Alternativas descartadas
- Registro só hoje, com o calendário só para consulta: não atende ao pedido.
- Registro livre em qualquer dia, sem marca: quebra a verdade dos números (um dia fechado pela trava poderia receber operação normal).

## Consequências
- Positiva: o diário fica completo mesmo quando a operação não foi lançada na hora, sem esconder isso.
- Negativa: lançar um dia passado muda o resultado da semana e do mês, e pode fechar a semana ou o mês de hoje. É o número real; a tela mostra isso logo depois do registro.
- Dois testes antigos usavam dados que agora são recusados (operação num domingo e operação passada sem saída) e foram ajustados para continuar testando a mesma regra.
