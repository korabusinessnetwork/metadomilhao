# FaixaTrava

Faixa que aparece no topo da tela Trade quando o diário está fechado por uma trava de risco: diz o motivo e quando reabre. Não tem botão de desbloquear.

## O que o consumidor fornece
- O motivo da trava, vindo do banco (ADR-003), com o valor envolvido e sinal.
- Data e hora de reabertura.

## Regras
- Fundo `bad-claro`, listras diagonais `bad` no topo (fita de interdição), cadeado em `bad` com contorno.
- Título sempre "Diário fechado". O texto diz o motivo em frase curta e o valor com sinal (−R$ 300,00).
- A reabertura fica num rótulo próprio: "Reabre em 26/11/2026 às 09:00".
- **Sem botão de desbloquear, sem link de ajuste de limite dentro da faixa.** A trava vale no banco; a tela só informa.
- `role="status"` para leitor de tela anunciar quando a trava entra.

## Movimento
- Quando o dia fecha (trava acabou de entrar), a faixa balança duas vezes (`dur-media`, ±1,6°) e o cadeado cai e assenta com `curva-mola`. Acontece uma vez, na transição. Ao abrir a tela com a trava já ativa, a faixa aparece parada.
- Com `prefers-reduced-motion: reduce` não balança.

## Não faça
- Não amenize o texto ("Calma, amanhã tem mais!"). Tom seco e informativo.
- Não use a faixa para avisos que não são trava.
