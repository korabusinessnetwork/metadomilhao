# Design System Cartoon, Rota do Milhão

> **Status: proposta, não adotada.** O estilo vigente é o de `../README.md`. Adotar este exige um ADR em `docs/08_DECISOES/`.
>
> Versão navegável (artifact, privado): https://claude.ai/artifact/CQozqPsmkRhyoqWCCxvuhK
>
> Arquivos desta pasta: `tokens.json` (fonte dos tokens), `tokens.css` (gerado a partir dele), `componentes.css` (classes `rm-`), `componentes/<Nome>/` (guia e prévia de cada componente) e `vitrine.html` (todos os componentes numa página só, com botão de tema; abra no navegador). As prévias isoladas em `componentes/` não carregam os CSS sozinhas; use a vitrine.

Estilo cartoonizado e animado para o Rota do Milhão, o app pessoal de finanças do Matheus. Os objetos parecem recortes de papel colados na tela: contorno grosso, sombra chapada deslocada, cantos redondos e um pouco de mola no movimento. **O cartoon fica no desenho, nunca nos textos nem nos números.** Este sistema deriva do design system atual (`docs/02_DESIGN_SYSTEM/README.md`, estilo ficha técnica) e mantém todas as regras dele.

## Regras que não mudam

1. **Verdade dos números.** Verde e vermelho sempre com sinal (+R$ 120,00, −R$ 12,40) ou texto ("Dentro do limite", "Estourado"). A cor nunca está sozinha.
2. **Projeção separada de realizado.** Realizado: contorno cheio, sombra chapada, linha cheia em `co`. Projeção: fundo `warn-claro`, contorno tracejado em `warn`, sem sombra, `SeloProjecao` e premissas visíveis (taxa real, aporte, data de início, "Valores em dinheiro de hoje").
3. **Alvo de toque mínimo de 44px** (`alvo-minimo`). Botões pílula com 48px (`alvo-botao`), botão + com 64px (`alvo-mais`).
4. **Inputs com 16px** de fonte, para não dar zoom no iOS.
5. **Tom sério.** Frases curtas e factuais, em português do Brasil, sem travessão, sem emoji, rótulos em caixa de frase. Escreva "Meta atingida", não "Parabéns, rumo à liberdade financeira". Escreva "Diário fechado. Reabre em 26/11/2026 às 09:00.", não "Calma, amanhã tem mais!".
6. **Trava sem botão de desbloquear.** A `FaixaTrava` só informa motivo e reabertura; a trava vale no banco (ADR-003).

## Conteúdo e voz

- Sujeito oculto ou terceira pessoa neutra: "Gasto de R$ 18,50 lançado em Alimentação."
- Dinheiro sempre `R$` com vírgula decimal e ponto de milhar, sinal tipográfico − (U+2212) para negativo.
- Datas `dd/mm/aaaa`, horas `09:00`, meses curtos `ago/2041` em projeções longas.
- Os exemplos das prévias (valores, a decisão do Copom) são ilustrativos, não dados do dono.

## Cor

| Papel | Token | Uso |
|---|---|---|
| Fundo da tela | `papel` | Papel azulado no claro, noite azul no escuro. |
| Objetos | `superficie`, `superficie-funda` | Cartões, inputs, navegação; trilhos e áreas internas. |
| Texto | `tinta`, `tinta-suave` | Principal e secundário. Ambos acima de 6:1 nos dois temas. |
| Traço | `contorno`, `sombra-cor` | Contorno de 3px e sombra chapada. No escuro o contorno vira giz azul claro e a sombra um cobalto fundo, para continuarem visíveis. |
| Marca e ação | `co`, `co-tinta`, `co-claro` | Cobalto #1240e0 (escuro #5b7cff). Texto sobre `co` usa `co-tinta`: branco no claro, quase preto no escuro. |
| Lucro, dentro da meta | `ok`, `ok-claro` | Sempre com + ou texto. |
| Estouro, prejuízo, trava | `bad`, `bad-claro` | Sempre com − ou texto. |
| Projeção, hipótese | `warn`, `warn-claro` | Só para o que ainda não aconteceu, inclusive o "possível impacto" das notícias. |
| Moedinha | `moeda` | Só a moeda que salta ao bater meta. Decorativa. |
| Foco | `foco` | Anel de 3px com 3px de afastamento. Cobalto no claro, amarelo no escuro. |

`co`, `ok`, `bad` e `warn` têm exatamente os valores do design system atual. Os tons `-claro`, `papel`, `contorno`, `sombra-cor` e `moeda` são novos.

No escuro, `co` como texto pequeno sobre `superficie` fica em 4.3:1: use cobalto em fundo, ícone e traço, e deixe texto em `tinta`. Links usam `tinta` com sublinhado grosso em `co`.

## Tipografia

- **Fredoka** (`titulo`), 600: títulos de tela, de cartão, rótulos de botão e da navegação. Redonda e amigável, é onde mora o cartoon.
- **Nunito** (`numero`), 800 e 900, com `tabular-nums`: números de destaque (`numero-destaque`, 46px com `clamp(34px, 9vw, 46px)`) e médios (`numero-medio`, 24px). Arredondada como a Fredoka, mas com algarismos tabulares para alinhar valores.
- **Inter** (`texto`), 400 a 600: texto, tabelas, rótulos, premissas, inputs. A fonte legível que o app já usa.
- Toda coluna de números: `font-variant-numeric: tabular-nums`, alinhada à direita, sem quebra (`rm-num`).
- As três vêm do Google Fonts. `components/bundle.css` importa as três no topo.

## Forma

- **Contorno**: `traco-grosso` (3px) em cartões, botões, barras, faixas e navegação; `traco-fino` (2px) em chips e divisórias.
- **Sombra chapada**: sem desfoque, deslocada para baixo e para a direita. `sombra-p` (3px) em botões e chips; `sombra-m` (5px) em cartões; `sombra-g` (7px) só no + central ou num cartão em destaque por tela. Projeção não tem sombra.
- **Cantos**: `raio-p` 10px (chips, selos, inputs), `raio-m` 16px (barras, faixas), `raio-g` 22px (cartões), `raio-pilula` (botões e o +).
- **Espaço**: grade de 4px (`espaco-1` a `espaco-8`). Cartão com `espaco-4` no celular e `espaco-6` no desktop; `espaco-6` entre cartões.
- **Texturas**: listras diagonais claras no enchimento da `BarraMeta`; listras `bad` como fita de interdição na `FaixaTrava`. Nada de gradiente ou ilustração de fundo.

## Movimento

Cada animação confirma algo que aconteceu. Nada anima para enfeitar, e nenhum número conta até o valor.

| Momento | Componente | Animação | Token |
|---|---|---|---|
| Gasto salvo | `NavegacaoInferior` | O + quica duas vezes, achatando e esticando, e o aviso de sucesso entra com mola. Dispara no sucesso da gravação, não no toque. | `dur-media`, `curva-mola` |
| Aporte registrado | `BarraMeta` | A barra enche até o novo valor, passa um pouco e volta. | `dur-lenta`, `curva-mola` |
| Meta batida | `BarraMeta` | Uma moedinha salta girando sobre o fim da barra, uma vez. | `dur-lenta`, `curva-mola` |
| Dia fechado | `FaixaTrava` | A faixa balança duas vezes e o cadeado cai e assenta. Só na transição para fechado. | `dur-media`, `curva-mola` |
| Valor projetado | `SeloProjecao` | O tracejado anda devagar, em loop. É o único loop do sistema. | `dur-tracejado`, linear |
| Toque em botão | `Botao` | Sobe 1px no hover, afunda 3px na própria sombra ao pressionar. | `dur-rapida`, `curva-suave` |

**`prefers-reduced-motion: reduce`**: todas as animações e transições são desligadas e o estado final aparece direto (barra no valor, moeda parada, tracejado parado, faixa parada). A informação nunca depende do movimento: o texto e a forma dizem tudo sozinhos.

## Iconografia

- Ícones de traço desenhados em SVG inline, 24px, traço de 2.4px com pontas redondas, em `currentColor`. Os da navegação estão na prévia de `NavegacaoInferior` (casa, recibo, candles, bandeira, três pontos).
- Ilustrações maiores (cadeado da trava, moedinha) usam o mesmo contorno de 3px e preenchimento por token.
- Sem emoji, sem mascote, sem ícone de foguete.

## Componentes

`Botao`, `CartaoLimiteHoje`, `BarraMeta`, `SeloProjecao` (com o cartão de projeção e o gráfico realizado × projeção), `FaixaTrava`, `NavegacaoInferior` (com o aviso de sucesso) e `CartaoNoticia`. São só CSS (`components/bundle.css`, prefixo `rm-`) e HTML; o JavaScript das prévias só dispara as animações. Cada um tem guia próprio com o que o consumidor fornece.

As prévias têm uma faixa "Prévia:" com botões para repetir a animação. Essa faixa não existe no app.
