# Decisões, Rota do Milhão

> Meta-cabeçalho: **Tipo** índice de decisões · **Dono** Matheus · **Atualizado** 2026-11-25 · **Revisar** a cada ADR novo

## Regras
- Toda decisão que afeta 2+ partes do sistema ou dura mais que um ciclo vira ADR em `docs/08_DECISOES/`.
- ADR aceito não é editado: um ADR novo o substitui e os dois se linkam.
- Numeração sequencial, nunca reciclada.

## Índice

| ID | Título | Status | Data |
|---|---|---|---|
| ADR-001 | Stack: React + Vite + Supabase + Vercel, como PWA | Aceito | 2026-11-25 |
| ADR-002 | Usuário único, sem multi-tenant | Aceito | 2026-11-25 |
| ADR-003 | Travas de risco aplicadas no banco, sem esconder violações | Aceito | 2026-11-25 |
| ADR-004 | Revisão de notícias pré-pregão com a API do Claude, com teto de custo | Aceito | 2026-11-25 |

## Decisões de produto registradas fora de ADR
- Sistemática começa na data de mudança configurada no perfil (F-01, F-02).
- Registro de trade manual na Fase 2, importação MT5 e KORA TRADER na Fase 4.
- Ativos: ações e mini-índice.

## Decisões da Fase 1 (2026-11-25)
- **MFA exigido no banco:** o RLS só libera linhas para sessão `aal2` (função `e_dono`). Senha vazada sozinha não lê nada.
- **Só inclusão no banco:** `lancamento`, `movimento_carteira` e `fechamento_mes` não têm privilégio de update/delete. Correção = estorno, ajuste de saldo ou fechamento substituto.
- **Privilégios explícitos:** a migration revoga tudo e concede tabela a tabela (o Supabase novo não concede mais por padrão).
- **Schema em migrations:** `supabase/migrations/` substitui o `supabase/schema.sql` citado no CLAUDE.md.
- **F-02 no mês da mudança:** o aporte novo vale a partir do mês da data de mudança. Mudança em 01/02/2027 vista de novembro dá 2 meses de aporte atual (dez, jan), não 3.
- **Projetado do fechamento (PL-04):** patrimônio real do mês anterior × (1 + taxa) + aporte planejado do mês. Comparação mês a mês, não contra uma curva fixa.
- **Fechamento sem cron:** o rascunho é calculado na hora em que a tela abre. A Edge Function `fechamento-mensal` ficou desnecessária na Fase 1.
- **P-02 só na tela:** a trava de aporte em capital de trade antes da reserva completa vai para o banco na Fase 2, junto com `conta_trade`.

## Decisões da Fase 2 (2026-11-25)
- **Status do dia é calculado, não guardado:** `status_travas(data)` deriva tudo das operações. Não há campo de status para alguém "destravar" (TR-05). A tabela `dia_trade` guarda só a nota e o encerramento manual, que não tem volta.
- **Trava pelo caminho, não pelo saldo final:** o período fecha se o acumulado bateu o limite em qualquer momento, na ordem de encerramento. Lucro posterior, como uma violação, não reabre.
- **Capital do período:** depósitos até a data, mais o resultado das operações fechadas antes do início do período. O resultado do próprio período não mexe no limite dele. Limite zero (sem capital) não fecha nada; a T-04 barra.
- **Violação só com período fechado:** com o período aberto, a operação entra como normal.
- **Multiplicador e risco no banco:** o trigger ignora o que o cliente manda (T-03).
- **Operação: planejar e encerrar uma vez só.** Encerrada, não muda. Não há delete.
- **Capital de trade é um ativo da carteira:** o resultado das operações entra no saldo desse ativo (`v_saldo_ativo`), então o patrimônio já reflete o trade.
- **IRRF que sobra passa para os meses seguintes** (prática da Receita); o mínimo de R$ 10 do DARF é só aviso, não entra no cálculo.
- **Navegação:** 5 itens + "+" (Hoje, Gastos, +, Trade, Plano, Mais). O "+" abre gasto; operação se registra na tela Trade.

## Em aberto
- P-03 com mês fechado de gasto zero zera a meta da reserva. Decidir se mês sem gasto entra na média.
- Regra exata de meta de lucro diária (M-10) a validar após 30 dias de operação real.
- Calendário de feriados da B3: fonte e atualização anual. Hoje "dia útil" = segunda a sexta.
