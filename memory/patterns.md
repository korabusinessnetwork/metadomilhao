# Padrões, Rota do Milhão

> Meta-cabeçalho: **Tipo** padrões · **Dono** Matheus · **Atualizado** 2026-11-25 · **Revisar** ao fim de cada fase

## Dinheiro
- Sempre centavos inteiros (`bigint` / `number` inteiro). Nunca `float` para dinheiro.
- Formatação BRL só no componente `Dinheiro`.
- Percentuais e taxas em `numeric` com 4 casas.

## Cálculo
- Toda regra com código (M-07, T-05, PL-01...) tem uma função pura em `src/lib/calculos/` com o código no nome do teste.
- Exemplo: `limiteGastoHoje()` → `limite-gasto-hoje.test.ts` com o caso "M-07: excedente reduz os dias seguintes".

## Projetado × realizado
- Valor projetado sempre passa por `SeloProjecao`.
- Nenhuma tela soma projetado com realizado no mesmo número.

## Histórico em vez de edição
- Estorno em vez de alterar lançamento (O-05).
- Fechamento corrigido gera novo registro com `substitui` (imutável).
- Saldo de ativo = soma de movimentos.

## Datas
- Regras de dia, semana e mês sempre em America/Sao_Paulo. Semana começa na segunda.

## Erros
- Serviço retorna `{ dados, erro }`. Componente mostra mensagem humana e a próxima ação.
