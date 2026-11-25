# Respostas do Intake, Rota do Milhão

Data: 2026-11-25. Fonte de verdade das escolhas iniciais.

## Bloco 1, Produto
- **Produto:** Rota do Milhão, sistema financeiro pessoal com plano até o primeiro milhão.
- **Problema:** hoje os gastos, metas e trades vivem em conversas soltas e estimativas. Não existe registro real nem acompanhamento do plano.
- **Proposta:** um lugar só, com números reais, metas que se recalculam e travas de risco que protegem o patrimônio.
- **Código existente:** protótipo em artifact (página "Rota do Milhão") com orçamento, cenários, lançamentos e patrimônio. Serve de referência visual e de cálculo, não de código base.

## Bloco 2, Público
- Uso pessoal, um usuário (Matheus). B2C de uma pessoa.
- **Aha moment:** ver no fim do primeiro mês o gasto real contra o orçado e o prazo do milhão recalculado com dados reais.

## Bloco 3, Multi-tenant
- Single-tenant definitivo. Sem white-label, sem planos. (ADR-002)

## Bloco 4, Stack
- React + Vite + Supabase + Vercel, PWA. (ADR-001)
- Uso igual no celular e no computador.

## Bloco 5, Segurança
- Dado financeiro pessoal. Sem credenciais de banco ou corretora. LGPD como referência de boas práticas.

## Bloco 6, Custo
- Bootstrap gratuito. Exceção aprovada: API do Claude até R$ 30/mês. (ADR-004)

## Escolhas de produto
- **Metas diárias:** limite de gasto do dia + meta de lucro e limite de perda no trade.
- **Travas:** ao bater o limite de perda do dia ou do mês, bloquear novos registros até o período seguinte. (ADR-003)
- **Ativos:** ações e mini-índice.
- **Registro de trade:** manual detalhado agora, importação MT5 e KORA TRADER no roadmap.
- **Campos extras do trade:** setup e contexto (FVG, tendência, timeframe, notícias).
- **IA:** revisão diária de notícias dos ativos operados, antes do pregão (por volta das 8h30).
- **Início:** a sistemática começa depois da mudança de moradia (cerca de 3 meses).

## Números de partida (vídeo de 25/11/2026)
- Renda: R$ 4.000 salário líquido + R$ 1.600 renda extra = R$ 5.600.
- Despesas atuais: R$ 4.715. Sobra: R$ 885.
- Após a mudança: moradia (aluguel, luz, gás) cai de R$ 2.060 para R$ 500. Sobra prevista: R$ 2.445.
- O cartão de crédito (R$ 300) não duplica outras linhas.
