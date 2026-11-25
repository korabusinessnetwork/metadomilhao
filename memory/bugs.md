# Bugs, Rota do Milhão

> Meta-cabeçalho: **Tipo** registro de bugs · **Dono** Matheus · **Atualizado** 2026-11-25 · **Revisar** a cada release


## Formato
| ID | Data | Sintoma | Causa raiz | Correção | Teste que impede a volta |
|---|---|---|---|---|---|
| BUG-001 | 2026-11-25 | "Reserva completa" com R$ 0 guardado e orçamento vazio | `reservaCompleta` = falta zero, e com meta zero a falta é sempre zero | Só completa com meta > 0; barra de objetivo mostra "Sem meta ainda" | `patrimonio.test.ts`: "sem meta definida... nunca aparece como completa" |
| BUG-002 | 2026-11-25 | Login recusado: "Email logins are disabled" | `[auth.email] enable_signup = false` desliga o provedor de e-mail inteiro | Fica `true`; o bloqueio de cadastro é o `[auth] enable_signup = false` | Conferido: signup público devolve `signup_disabled` |
| BUG-004 | 2026-11-25 | Violação com lucro reabria o dia fechado | Trava comparava só o saldo final do dia | Trava avalia o pior/melhor acumulado na ordem de encerramento | `travas.test.ts` TR-05 e `fase2.test.sql` "o lucro da violação não reabre" |
| BUG-005 | 2026-11-25 | 409 ao abrir o mês com duas chamadas ao mesmo tempo | Corrida na chave única (user_id, mes) em `abrir_orcamento_mes` | `on conflict do nothing`; só quem cria copia os itens | Conferido: 4 chamadas paralelas, 4 × 200, itens copiados uma vez |
| BUG-006 | 2026-11-25 | Diário "fechado por perda do mês" com capital depositado hoje | Capital do dia excluía depósitos do próprio dia; limite zero fechava com resultado zero | Depósitos até a data contam; limite zero não fecha | `travas.test.ts` "sem capital" e `fase2.test.sql` usuário D |
| BUG-003 | 2026-11-25 | Barra da reserva vermelha com "passou" quando a reserva supera a meta | `BarraMeta` tratava toda meta como limite de gasto | `sentido="objetivo"` para metas em que passar é bom | Conferido na tela Hoje |

Regra: bug só é fechado com causa raiz e teste (skill `engenharia-com-evidencia`).

## Riscos conhecidos a testar primeiro
- Virada de dia e de mês nas travas (fuso America/Sao_Paulo).
- Arredondamento de centavos no cálculo de R e de IR.
- Multiplicador do mini-índice (R$ 0,20 por ponto) aplicado em ações por engano.
