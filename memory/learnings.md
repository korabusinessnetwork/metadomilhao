# Aprendizados, Rota do Milhão

> Meta-cabeçalho: **Tipo** aprendizados · **Dono** Matheus · **Atualizado** 2026-11-25 · **Revisar** a cada fechamento mensal

## Da análise inicial (25/11/2026)
- **A alavanca real é a moradia, não o trade.** Cortar R$ 1.560 por mês reduz o prazo do milhão de ~33 para ~19 anos sem nenhum risco de mercado.
- **Projeção boa com premissa ruim continua ruim.** A simulação de 7 anos e 2 meses estava certa na conta, mas dependia de 60% de acerto em 1:3 por anos, de quase 300% ao ano sobre o capital e de nenhum imposto.
- **Nominal engana.** 0,8% a.m. nominal vira cerca de 0,45% a.m. real; o milhão nominal daqui a 20 anos vale bem menos.
- **Estimativa grande é ponto cego.** "Diversos" de R$ 800 (17% das despesas) precisa virar número real antes de qualquer meta fina.
- **Salário < despesas.** Com salário de R$ 4.000 e despesas de R$ 4.715, a renda extra sustenta o mês. Risco a acompanhar até a mudança.

## Da Fase 1 (25/11/2026)
- **Teste de banco tem que filtrar pelo dono.** Um teste que contava todas as linhas quebrou quando havia dados reais no banco local.
- **Sabotar para provar.** Trocar `e_dono` por `true` fez os testes de isolamento falharem, prova de que eles pegam vazamento.
- **Meta zero engana.** Qualquer "completo" ou "atingido" precisa checar se a meta existe.

## Formato
Cada aprendizado novo: data, o que aconteceu, o que muda no sistema (regra, ADR ou backlog).
