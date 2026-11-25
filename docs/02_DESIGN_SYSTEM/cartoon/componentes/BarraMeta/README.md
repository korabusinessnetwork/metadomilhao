# BarraMeta

Barra de progresso de uma meta, com trilho grosso que enche com efeito de mola e uma moedinha que salta quando a meta é atingida.

## O que o consumidor fornece
- Nome da meta, valor atual e valor alvo em centavos.
- O percentual vem de uma função pura (`src/features/metas`), nunca calculado no componente.

## Regras
- Mostra só **realizado**. Trilho cheio, sem tracejado. Uma data prevista para bater a meta é projeção e vai num cartão `rm-projecao` com `SeloProjecao`.
- Enchimento em `co`, com listras diagonais claras para dar textura de desenho. Meta atingida: enchimento em `ok` e chip `rm-chip--ok` com o texto "Meta atingida".
- Percentual em `numero-medio` com `tabular-nums`.
- `role="progressbar"` com `aria-valuenow`; a moeda é `aria-hidden`.

## Movimento
- A largura transiciona em `dur-lenta` (700ms) com `curva-mola`: passa um pouco do ponto e volta. Anima só quando o valor muda, nunca em loop.
- A moedinha (`rm-moeda`, cor `moeda`) salta uma vez, girando, quando o valor cruza o alvo. Não repete ao reabrir a tela.
- Com `prefers-reduced-motion: reduce`, a barra aparece direto no valor e a moeda aparece parada.

## Não faça
- Não acompanhe a moeda de texto comemorativo. O texto é "Meta atingida", e só.
- Não use a moeda para outra coisa (lucro de trade, saldo). Ela existe só para meta batida.
