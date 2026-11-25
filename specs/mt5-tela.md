# Spec: tela de importação do MT5 (T03)

## 1. Escopo
Tela `/trade/importar` que lê o relatório HTML do MT5, guarda as posições como rascunhos e conduz o dono a completar o contexto e confirmar uma por vez, na ordem.

## 2. Fora de escopo
- Outros formatos (XLSX, CSV). Editar uma operação confirmada. Vincular revisão de notícias à importada.

## 3. Origem e decisões que este item honra
- Backlog Fase 4. D03 e D04. T-02 (contexto obrigatório). `CLAUDE.md`: acesso ao Supabase só por `src/lib/services/`, CSS com tokens, estados visíveis, textos sem travessão.

## 4. Arquivos afetados
- `src/lib/services/importacaoService.ts` (novo)
- `src/lib/importacao/mt5.ts` (+ `conferirLucro`) e teste
- `src/features/trade/ImportarMt5.tsx` (novo), `src/features/trade/FormularioOperacao.tsx` (exportar `Opcoes`), `src/features/trade/Trade.tsx` (link), `src/app/App.tsx` (rota)

## 5. Critérios de aceite
1. Escolher o arquivo lê UTF-16LE do MT5 e mostra quantas posições foram lidas, quantas já tinham sido importadas antes e os avisos de linha ignorada.
2. Reimportar o mesmo relatório não duplica rascunho nem operação (ticket único).
3. A lista de pendentes vem na ordem de abertura; só a primeira tem o formulário de contexto, as outras mostram resumo e o botão Descartar.
4. O formulário pede setup, tendência no diário, H1 e H4, timeframe, notícia (com descrição se marcada), seguiu o plano e observação; pede stop e alvo só quando o relatório não trouxe.
5. Quando o lucro do MT5 diverge do calculado pelos preços (multiplicador), a tela avisa antes de confirmar.
6. Confirmar grava a operação, mostra se entrou como violação e passa para a próxima; erro do banco aparece em português na tela.
7. Estados visíveis: carregando, erro com tentar de novo, vazio com a próxima ação ("Escolha o relatório").
8. Tela intuitiva porque a próxima ação é sempre uma só: escolher o arquivo, ou completar a primeira pendente.

## 6. Edge cases
- Arquivo que não é relatório: aviso da leitura, nada gravado.
- Nenhuma conta de trade: a mensagem do banco orienta.
- Descartar a primeira: a próxima ganha o formulário.

## 7. Definição de "aprovado sem ressalvas"
Critérios em sim, `npm test` e `npx tsc -b` verdes, fluxo testado no navegador com um relatório UTF-16LE de exemplo, sem `console.log` e sem TODO.

## Resultado da review (2026-11-25)
✅ Aprovado sem ressalvas. `npm test`: 126 verdes; `npx tsc -b`: sem erro; `supabase test db`: 133 verdes.

| # | Critério | Evidência |
|---|---|---|
| 1 | Lê UTF-16LE e resume | navegador: "2 posições lidas: 2 novas, 0 já importadas antes" e aviso da linha 5 |
| 2 | Reimportar não duplica | navegador: "0 novas, 2 já importadas antes"; banco com 1 rascunho por ticket |
| 3 | Ordem, formulário só na primeira | navegador: formulário na de 23/11, a de 24/11 na fila |
| 4 | Contexto e stop/alvo quando faltam | navegador: a venda sem S/L e T/P pediu stop e alvo |
| 5 | Aviso de lucro divergente | `conferirLucro` testado (diferença 16000); neste relatório os valores batiam e o aviso não apareceu, como esperado |
| 6 | Confirmar, violação e erro em português | navegador: "Operação importada."; o erro "Defina o risco..." apareceu em português (levou à D07) |
| 7 | Estados visíveis | carregando, erro com tentar de novo, vazio com a próxima ação |
| 8 | Próxima ação única | arquivo ou a primeira pendente |

Achado no teste pela tela: histórico de antes da configuração dos limites era recusado. Corrigido com a D07 (migration `20261125000007`, 3 testes novos de banco).
