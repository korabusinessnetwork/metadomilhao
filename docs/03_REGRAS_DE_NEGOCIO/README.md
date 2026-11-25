# Regras de Negócio, Rota do Milhão

Cada regra tem um código. Código e testes citam o código da regra.

## 1. Prioridade do dinheiro (P)

| Código | Regra |
|---|---|
| P-01 | Toda sobra do mês segue esta ordem: reserva de emergência, depois aporte de longo prazo, depois capital de trade. |
| P-02 | Capital de trade só pode receber dinheiro novo quando a reserva estiver completa. Antes disso, o sistema não deixa transferir para a conta de trade. |
| P-03 | Reserva de emergência = 6 × média das despesas dos últimos 3 meses fechados. Antes de existir histórico, usa o orçamento. |
| P-04 | Capital de trade nunca passa de 10% do patrimônio total, salvo novo ADR. |
| P-05 | Lucro de trade não paga despesa do mês. Ele vai para aporte (percentual configurável, padrão 70%) ou fica no capital de trade. |

## 2. Orçamento e gastos (O)

| Código | Regra |
|---|---|
| O-01 | Cada categoria tem valor orçado por mês e tipo: fixa ou variável. |
| O-02 | Orçamento de um mês é copiado do mês anterior ao abrir, e pode ser ajustado até o dia 5. Depois disso, mudanças ficam registradas no histórico. |
| O-03 | Categoria sem lançamento real por 2 meses seguidos é marcada como "estimativa" (caso dos Diversos). |
| O-04 | Lançamento exige data, categoria e valor positivo. Descrição é opcional. |
| O-05 | Estorno é um lançamento negativo vinculado ao original, nunca edição do valor antigo. |

## 3. Metas (M)

### Anual
| Código | Regra |
|---|---|
| M-01 | Meta anual de aporte = aporte mensal planejado × 12, vinda do plano do milhão. |
| M-02 | Meta anual de patrimônio = patrimônio projetado para 31/12 no cenário base. |
| M-03 | Ao virar o ano, a meta é recalculada a partir do patrimônio real, não do projetado. |

### Mensal
| Código | Regra |
|---|---|
| M-04 | Meta mensal de gasto = soma do orçamento do mês. |
| M-05 | Meta mensal de aporte = renda do mês menos meta de gasto, com reserva primeiro (P-01). |
| M-06 | Mês é "batido" quando o gasto real ficou ≤ orçado e o aporte real ficou ≥ meta de aporte. |

### Diária (gasto)
| Código | Regra |
|---|---|
| M-07 | Limite de gasto do dia = (orçamento variável do mês − gasto variável até ontem) ÷ dias restantes do mês, contando hoje. |
| M-08 | Despesas fixas (aluguel, contas) não entram no limite diário; são lançadas no vencimento. |
| M-09 | Se o dia passa do limite, o excedente reduz automaticamente o limite dos dias seguintes. Sem bloqueio, só aviso. |

### Diária (trade)
| Código | Regra |
|---|---|
| M-10 | Meta de lucro do dia (stop gain) = 2R, onde R é o risco por operação vigente. Ao atingir, o dia fecha. |
| M-11 | Limite de perda do dia (stop loss diário) = 2R ou 2% do capital de trade, o que for menor. |
| M-12 | Limite de perda semanal = 3% do capital de trade no início da semana. |
| M-13 | Limite de perda mensal = 8% do capital de trade no início do mês. |

## 4. Travas (TR), ver ADR-003

| Código | Regra |
|---|---|
| TR-01 | Bater M-10 ou M-11 fecha o dia de trade. Bater M-12 fecha a semana. Bater M-13 fecha o mês. |
| TR-02 | Período fechado bloqueia o registro de novas operações planejadas. |
| TR-03 | Operação executada na corretora mesmo com o período fechado pode ser registrada, mas entra marcada como `violacao_trava = true`. O dado nunca é escondido. |
| TR-04 | A trava é aplicada no banco (trigger/RLS), não só na tela. |
| TR-05 | Não existe botão de desbloqueio. O período reabre sozinho no próximo dia útil, semana ou mês. |
| TR-06 | Violações aparecem no fechamento mensal com contagem e resultado. |

## 5. Trade (T)

| Código | Regra |
|---|---|
| T-01 | Toda operação registra: data/hora, ativo, mercado (ações ou mini-índice), direção, quantidade, entrada, stop, alvo, saída, resultado bruto, custos, resultado líquido, resultado em R. |
| T-02 | Contexto obrigatório: setup (ex.: FVG), tendência no diário e no H1/H4, timeframe de entrada (15s, 5m, 15m), notícia relevante (sim/não, qual). |
| T-03 | Risco da operação = |entrada − stop| × quantidade × multiplicador do ativo. No mini-índice, R$ 0,20 por ponto por contrato. |
| T-04 | Risco por operação ≤ 1% do capital de trade. Operação acima é recusada no registro planejado. |
| T-05 | Resultado em R = resultado líquido ÷ risco da operação. |
| T-06 | Estatísticas mínimas: taxa de acerto, payoff médio, expectativa em R e em reais, maior sequência de perdas, drawdown máximo, resultado por setup e por timeframe. |
| T-07 | Expectativa só é exibida como "confiável" a partir de 100 operações. Antes disso, mostra "amostra pequena". |
| T-08 | Aumento de risco por operação: só depois de 100 operações registradas, expectativa líquida positiva e zero violações de trava nos últimos 30 dias. Aumento máximo de 25% por etapa, e no máximo uma etapa a cada 6 meses. |
| T-09 | Resultado de trade só entra como premissa no plano do milhão quando T-08 for atendida. Antes disso, aparece só como cenário. |

## 6. Imposto (IR)

| Código | Regra |
|---|---|
| IR-01 | Lucro líquido de day trade no mês × 20% = imposto devido, menos IRRF retido e prejuízo acumulado de day trade. |
| IR-02 | IRRF estimado = 1% sobre o resultado positivo de cada dia. |
| IR-03 | Prejuízo de day trade acumula e só compensa lucro de day trade futuro. |
| IR-04 | O sistema mostra o DARF estimado e o vencimento (último dia útil do mês seguinte). É apoio, não declaração oficial. |

## 7. Plano do milhão (PL)

| Código | Regra |
|---|---|
| PL-01 | Projeção mês a mês: patrimônio × (1 + taxa real) + aporte do mês. |
| PL-02 | Taxa real padrão 0,45% a.m., editável. Mostrar o equivalente anual. |
| PL-03 | Cenários fixos: Base (aporte planejado), Conservador (taxa − 0,15 p.p.), Com trade (só se T-09). |
| PL-04 | Todo fechamento mensal grava o patrimônio real e compara com o projetado para aquele mês. |
| PL-05 | O prazo até o milhão é recalculado a cada fechamento a partir do patrimônio real. |

## 8. Revisão de notícias por IA (IA), ver ADR-004

| Código | Regra |
|---|---|
| IA-01 | Roda em dia de pregão, às 8h30 (horário de Brasília), sobre a watchlist (máximo 10 ativos). |
| IA-02 | A saída é informativa: resumo por ativo, agenda do dia, riscos. Nunca diz "compre" ou "venda". |
| IA-03 | Teto de custo mensal: R$ 30. Ao atingir 100%, a função não chama mais a API até o mês seguinte. Aviso aos 80%. |
| IA-04 | Toda revisão guarda as fontes citadas e o custo estimado da chamada. |
| IA-05 | O registro de uma operação pode vincular a revisão daquele dia, para depois medir se a notícia ajudou. |

## 9. Fases

| Código | Regra |
|---|---|
| F-01 | Até a data de mudança configurada, o plano usa o orçamento atual (sobra de R$ 885). |
| F-02 | Na data de mudança, o orçamento novo entra em vigor (moradia R$ 500) e o plano recalcula. |
