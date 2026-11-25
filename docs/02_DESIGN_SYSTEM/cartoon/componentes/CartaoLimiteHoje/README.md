# CartaoLimiteHoje

O primeiro cartão da tela Hoje: quanto ainda dá para gastar hoje, em número grande, com o estado escrito ao lado.

## O que o consumidor fornece
- Limite do dia, gasto do dia e restante, em centavos inteiros, formatados só na borda.
- O estado: dentro do limite ou estourado.

## Regras
- O número principal usa `numero-destaque` (Nunito 900, `tabular-nums`) com `clamp(34px, 9vw, 46px)`.
- Dentro do limite: valor em `tinta`, chip `rm-chip--ok` com o texto "Dentro do limite".
- Estourado: valor em `bad` **com sinal −** ("−R$ 12,40") e chip `rm-chip--bad` com o texto "Estourado". A cor nunca aparece sozinha.
- O trilho é realizado, então é cheio (sem tracejado). Barra em `co`; estourado em `bad`, ocupando 100%.
- Use o sinal de menos tipográfico (−, U+2212), não o hífen.

## Não faça
- Não mostre valor futuro como fato. Qualquer estimativa de saldo de amanhã ou do fim do mês vai com `SeloProjecao`.
- Não anime o número contando. Número de dinheiro aparece pronto.
