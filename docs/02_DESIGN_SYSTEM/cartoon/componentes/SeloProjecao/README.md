# SeloProjecao

Selo "projeção" com contorno tracejado que corre devagar, usado em todo número que ainda não aconteceu.

## O que o consumidor fornece
- O selo em si não recebe nada: o texto é sempre "projeção", em minúsculas.
- O cartão de projeção (`rm-projecao`) recebe o resultado e a lista de premissas: taxa real, aporte, data de início e a nota "Valores em dinheiro de hoje".

## Regras
- Projeção e realizado nunca dividem o mesmo traço:
  - **Realizado**: cartão `rm-cartao`, contorno cheio, sombra chapada, linha cheia em `co`.
  - **Projeção**: cartão `rm-projecao`, fundo `warn-claro`, contorno tracejado em `warn`, **sem sombra** (ainda não é objeto sólido), linha tracejada em `warn`.
- Todo resultado projetado mostra as premissas ao lado, com `rm-premissas`. Sem premissa, não há projeção na tela.
- Cenário de trade (regra T-08) usa o mesmo selo até ser validado. Nunca entra no plano como realizado.

## Movimento
- O tracejado do selo e da linha projetada anda com `stroke-dashoffset` em `dur-tracejado` (1400ms), linear, em loop. É o único loop do sistema: sinaliza "isto ainda está em movimento, não é fato".
- Com `prefers-reduced-motion: reduce` o tracejado fica parado, e a diferença continua visível pela cor, pelo traço e pelo rótulo.

## Não faça
- Não use `warn` em número realizado.
- Não esconda as premissas atrás de um toque.
