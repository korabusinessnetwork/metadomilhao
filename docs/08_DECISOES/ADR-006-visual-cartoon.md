# ADR-006, Visual cartoon no app

**Status:** Aceito (substitui o estilo ficha técnica de `docs/02_DESIGN_SYSTEM/README.md`)
**Data:** 2026-11-26
**Decisores:** Matheus

## Contexto
O design system cartoon (`docs/02_DESIGN_SYSTEM/cartoon/`) foi criado como proposta, com as mesmas cores de estado e as mesmas regras de honestidade do estilo ficha técnica. O dono pediu para aplicá-lo no app (pendência P06).

## Decisão
- O app passa a usar o visual cartoon: papel azulado, objetos com contorno de 3px, sombra chapada deslocada, cantos redondos e movimento com mola.
- Fontes: Fredoka (títulos e botões), Nunito 800/900 (números, com algarismos tabulares) e Inter (texto e campos).
- Tokens em `src/estilos/tokens.css`, copiados de `docs/02_DESIGN_SYSTEM/cartoon/tokens.json`. Escuro pelo sistema (`prefers-color-scheme`) ou por `data-theme`.
- As classes do app não mudaram de nome; só o desenho delas. Componentes que ganharam marcação nova: navegação (ícones de traço), `SeloProjecao` (tracejado que anda), `BarraMeta` (moedinha quando a meta de objetivo é batida) e `FaixaTrava` (fita de interdição e cadeado).
- Animações que confirmam algo: o + quica quando um gasto é gravado (`src/app/avisoGasto.ts`), o cartão "Gasto salvo" entra com mola, a barra enche, a faixa de trava balança ao aparecer. Com `prefers-reduced-motion: reduce`, tudo para e o estado final aparece direto.

## O que continua de pé
- Verde e vermelho sempre com sinal ou texto; projeção sempre separada de realizado (fundo e contorno tracejado `warn`, sem sombra, com premissas).
- Alvo de toque de 44px, campos com 16px, textos sérios em português do Brasil, sem emoji.
- Trava sem botão de desbloquear (ADR-003).

## Consequências
- Positiva: a tela fica mais legível de longe e as confirmações ficam visíveis.
- Negativa: botões e cartões ocupam um pouco mais de espaço. Dentro de tabelas, botões e campos ficam compactos para caber em 375px.
- Para voltar: reverter o commit desta decisão (os estilos antigos estão no histórico do git).
