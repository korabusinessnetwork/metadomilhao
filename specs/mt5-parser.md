# Spec: parser do relatório de histórico do MT5 (T01)

## 1. Escopo
Uma função pura que recebe os bytes do relatório de histórico salvo pelo MT5 em HTML e devolve a lista de posições fechadas, com avisos para o que não conseguiu ler.

## 2. Fora de escopo
- Banco, tela, confirmação e travas (T02 e T03).
- Relatório em XLSX ou CSV, seção de ordens e de transações (deals).
- Saber setup, tendências, timeframe e notícia: o MT5 não tem isso (D04).

## 3. Origem e decisões que este item honra
- Backlog: Fase 4, "Importar operações do MT5".
- `.full-auto/DECISOES.md` D03 (formato HTML, colunas pelo cabeçalho, linha não entendida vira aviso) e D04 (importação vira rascunho).
- `CLAUDE.md`: dinheiro em centavos inteiros, função pura com teste, nomes de domínio em português.
- Princípio nº 1: nada some calado.

## 4. Arquivos afetados
- `src/lib/importacao/mt5.ts` (novo)
- `src/lib/importacao/mt5.test.ts` (novo)

## 5. Critérios de aceite
1. `decodificarRelatorio(bytes)` lê UTF-16LE com BOM (como o MT5 salva), UTF-8 com BOM e UTF-8 sem BOM.
2. `lerRelatorioMt5(html)` acha a tabela de posições pelo cabeçalho, em inglês (Time, Position, Symbol, Type, Volume, Price, S / L, T / P, Time, Price, Commission, Swap, Profit) e em português (Horário/Hora, Posição, Ativo/Símbolo, Tipo, Volume, Preço, S / L, T / P, Horário, Preço, Comissão, Swap, Lucro), sem depender da ordem exata das colunas.
3. Cada posição traz: ticket, ativo (maiúsculo), direção (`compra`/`venda`), volume (número), preço de entrada e de saída, S/L e T/P (`null` quando vazio ou zero), abertura e fechamento em ISO com fuso de Brasília (`-03:00`), custos em centavos (comissão + swap negativos viram custo positivo) e lucro bruto em centavos.
4. Números com espaço de milhar (`128 500`), espaço não quebrável, ponto decimal e sinal negativo são lidos certo; dinheiro vira inteiro em centavos sem erro de ponto flutuante.
5. A leitura para no fim da seção de posições (linha de título de outra seção, como Orders/Ordens/Deals/Transações) e não mistura linhas de outras tabelas.
6. Linha de posição que não dá para ler (data inválida, tipo desconhecido, número inválido) vira aviso com o número da linha e o motivo; as outras continuam.
7. Relatório sem tabela de posições devolve lista vazia e um aviso dizendo isso, sem lançar exceção.
8. Entidades HTML comuns (`&nbsp;`, `&amp;`, `&#160;`) e tags dentro das células não atrapalham.
9. Função pura, sem DOM: roda no Vitest em ambiente node.

## 6. Edge cases conhecidos
- Arquivo vazio ou que não é HTML.
- Posição de venda (direção invertida no resultado é calculada depois, aqui só se lê).
- S/L e T/P vazios.
- Ativo com sufixo (`WINZ26`, `PETR4F`).
- Relatório com linhas de resumo depois da tabela (Balance, Saldo).

## 7. Definição de "aprovado sem ressalvas"
Todos os critérios em sim, `npm test` verde, `npx tsc -b` sem erro, sem TODO pendente e sem `console.log`.

## Resultado da review (2026-11-25)
✅ Aprovado sem ressalvas na 2ª rodada. `npm test`: 122 testes verdes; `npx tsc -b`: sem erro.

| # | Critério | Evidência |
|---|---|---|
| 1 | Decodificação UTF-16LE, UTF-8 com e sem BOM | `mt5.test.ts`, "decodifica UTF-16LE..." |
| 2 | Cabeçalho em inglês, português e fora de ordem | testes "em inglês", "em português", "fora da ordem padrão" |
| 3 | Todos os campos da posição | `toEqual` completo da posição 1001 |
| 4 | Milhar com espaço e nbsp, negativos, centavos inteiros | posições 1001 e 2001 (`emCentavos`) |
| 5 | Para no fim da seção | teste "não mistura a tabela de ordens" |
| 6 | Linha ilegível vira aviso (data, tipo, número) | testes de aviso: data na rodada 1; tipo e volume adicionados na rodada 2 |
| 7 | Sem tabela: lista vazia e aviso | teste "sem tabela de posições" |
| 8 | Tags e entidades | teste "tags e entidades" |
| 9 | Puro, sem DOM | roda no Vitest em ambiente node |

Corrigido pela review: faltava teste para tipo desconhecido e número inválido (critério 6).
