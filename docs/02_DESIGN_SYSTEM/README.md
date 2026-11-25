# Design System, Rota do Milhão

Referência visual: o protótipo "Rota do Milhão" (artifact). Estilo de ficha técnica: denso, preciso, números grandes, nada decorativo.

## Cores
| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--bg` | #ffffff | #0a0d18 | fundo |
| `--ink` | #0b0d12 | #e9ecf5 | texto |
| `--mut` | #5a6070 | #98a0b5 | texto secundário |
| `--zone` | #eef2ff | #121833 | faixas e painéis |
| `--line` | #d9dff0 | #232b4a | bordas |
| `--co` | #1240e0 | #5b7cff | ação principal, meta |
| `--ok` | #0a7d4f | #3ccf8e | dentro da meta, lucro |
| `--bad` | #c0261c | #ff6b5e | estouro, prejuízo, trava |
| `--warn` | #9a6200 | #f2b84b | atenção, hipótese |

Regra: verde e vermelho sempre acompanhados de sinal (+/−) ou texto, nunca só a cor.

## Tipografia
- Space Grotesk 600: títulos e números de destaque.
- Inter 400/500/600: texto e tabelas.
- Escala: 13, 16, 22, 34 px (números de destaque até 46 px com `clamp`).
- Números com `font-variant-numeric: tabular-nums`, alinhados à direita, sem quebra.

## Espaço e forma
- Grade de 4 px. Raio 6 px. Alvo de toque mínimo 44 px. Inputs com 16 px (evita zoom no iOS).

## Padrões de tela
- **Topo do dia:** limite de gasto restante, status do trade (aberto, fechado com motivo), prazo do milhão.
- **Projetado × realizado:** projetado sempre em traço ou cor `--warn` com o rótulo "projeção"; realizado em linha cheia.
- **Trava ativa:** faixa `--bad` com motivo e hora de reabertura. Sem botão de desbloquear.
- **Amostra pequena:** estatísticas de trade com menos de 100 operações levam o selo "amostra pequena".

## Layout
- Celular: navegação inferior com 5 itens (Hoje, Gastos, Trade, Plano, Mais) e botão "+" central.
- Desktop (≥ 900 px): barra lateral com os mesmos itens; tela Trade em duas colunas (formulário + histórico do dia).

## Textos
- Português do Brasil, frases curtas, sem travessão, sem emoji, rótulos em caixa de frase.
