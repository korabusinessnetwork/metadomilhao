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
- Registro de trade manual na Fase 2, importação MT5 na Fase 4.
- **KORA TRADER fora do escopo (2026-11-25):** é outro produto. Saiu do backlog e da origem das operações (migration `20261125000005`).
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

## Decisões da Fase 3 (2026-11-25)
- **Modelo da revisão:** `claude-haiku-5-5` (o mais econômico, como pede o ADR-004), na variável `MODELO_REVISAO`. Esforço `low` por padrão.
- **Busca:** `web_search_20250305` com `max_uses` (`MAX_BUSCAS`, padrão 5). A versão com filtragem dinâmica não é suportada pelo Haiku.
- **Saída:** JSON pedido no prompt e validado no código (`supabase/functions/_compartilhado/revisao.ts`), com uma nova tentativa. Não usamos saída estruturada porque não confirmamos que ela combina com as citações da busca.
- **Custo:** estimado pelo uso de cada chamada (tokens + buscas) × preços em variáveis × cotação, arredondado para cima. O que foi consumido conta mesmo se a revisão falhar.
- **Escrita da IA só pela função:** `revisao_noticias` e `uso_ia` não aceitam insert do usuário; o uso soma por `registrar_uso_ia` (atômica, só `service_role`).
- **Agendamento fora das migrations:** `supabase/agendamento.sql` guarda URL e segredo no Vault, por ambiente.
- **Calendário:** `feriado_b3` com `nacional` (vale para o DARF) e `confirmado` (conferido com a B3). As travas reabrem no próximo dia de pregão.

## Decisões da Fase 4 (2026-11-25)
- **Fila offline só para gastos.** Lançamento sem conexão vai para `localStorage` com id gerado no aparelho (`crypto.randomUUID`). Reenviar não duplica: o banco recusa o id repetido (23505) e a fila trata como enviado.
- **Recusa nunca some:** gasto que o banco recusa por regra vai para "recusados", visível até o dono descartar.
- **Pendentes contam nos números:** o limite do dia e o gasto do mês somam o que está na fila, marcado como "aguardando envio".
- **Cache no aparelho:** o último perfil, plano e dados do mês ficam no `localStorage` para o app abrir sem internet. Sair da conta apaga cache e fila (com aviso se houver gasto não enviado).
- **Sem retentativa automática do Supabase (`db.retry: false`):** ver BUG-007.
- **Trade, orçamento e carteira continuam exigindo conexão:** travas e regras rodam no banco, então não faz sentido aceitar operação offline.

## Em aberto
- P-03 com mês fechado de gasto zero zera a meta da reserva. Decidir se mês sem gasto entra na média.
- Regra exata de meta de lucro diária (M-10) a validar após 30 dias de operação real.
- Calendário de feriados da B3: 2026 e 2027 vieram do calendário legal e estão com `confirmado = false`. Conferir com a B3 e cadastrar 2028 todo fim de ano.
