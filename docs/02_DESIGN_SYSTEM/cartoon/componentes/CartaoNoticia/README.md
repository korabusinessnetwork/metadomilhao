# CartaoNoticia

Cartão da revisão diária de notícias: fonte, horário, resumo curto e um quadro "possível impacto" separado do fato.

## O que o consumidor fornece
- Fonte (nome do veículo ou órgão), data e hora, categoria, título, resumo e o link da fonte original.
- O texto de possível impacto, gerado pela revisão por IA (ADR-004).

## Regras
- A fonte vem sempre primeiro e em `tinta` com peso 600. Notícia sem fonte não aparece.
- O resumo é fato. A leitura da IA fica no quadro `rm-impacto`, com o rótulo "possível impacto" em minúsculas, fundo `warn-claro` e contorno tracejado em `warn`: a mesma linguagem visual da projeção, porque é hipótese.
- O quadro de impacto nunca altera premissa sozinho. Se sugerir mudança, diz "Nenhuma premissa foi alterada" ou leva a uma ação explícita do dono.
- Link "Ler na fonte" com alvo de 44px.

## Movimento
- Nenhum. Notícia é leitura; o cartão só ganha o hover padrão se for clicável inteiro.

## Não faça
- Não use `ok` ou `bad` para dizer se a notícia é boa ou ruim.
- Não use emoji ou ícone de foguete, alta ou queda no título.
