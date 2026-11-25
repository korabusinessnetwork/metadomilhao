# Botao

Botão pílula com contorno grosso e sombra chapada, em três papéis: primário, secundário e perigo.

## Quando usar
- **Primário** (`rm-botao`): a uma ação principal da tela. Fundo `co`, texto `co-tinta`. Um por tela.
- **Secundário** (`rm-botao rm-botao--secundario`): ações de apoio. Fundo `superficie`, texto `tinta`.
- **Perigo** (`rm-botao rm-botao--perigo`): excluir ou desfazer. Fundo `bad-claro`, texto `bad`. Sempre com verbo explícito ("Excluir lançamento"), nunca só "OK".
- **Desabilitado**: contorno tracejado e sem sombra, para não parecer clicável. Use durante o salvamento com o verbo no gerúndio ("Salvando").

## O que o consumidor fornece
- Um `<button type="button">` ou `type="submit"` com o texto da ação.
- `rm-botao--bloco` para ocupar a largura toda no celular.

## Movimento
- Hover: sobe 1px e a sombra cresce de `sombra-p` para `sombra-m`.
- Pressionado: desce 3px e a sombra vira `sombra-pressionada`. O botão parece afundar no papel.
- Duração `dur-rapida`, curva `curva-suave`. Com movimento reduzido não há deslocamento.

## Não faça
- Não use perigo para trava de risco. Trava não tem botão (ver `FaixaTrava`).
- Não coloque emoji no rótulo.
- Altura mínima `alvo-botao` (48px); nunca abaixo de `alvo-minimo` (44px).
