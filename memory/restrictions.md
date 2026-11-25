# Restrições, Rota do Milhão

> Meta-cabeçalho: **Tipo** restrições · **Dono** Matheus · **Atualizado** 2026-11-25 · **Revisar** quando mudar plano de serviço ou lei

## Custo
| Item | Plano | Custo | Status |
|---|---|---|---|
| Supabase | Free | R$ 0 | Aprovado |
| Vercel | Hobby | R$ 0 | Aprovado |
| API do Claude (revisão de notícias) | Uso | Teto R$ 30/mês | Aprovado (ADR-004) |
| Busca na web via API | Uso | Dentro do teto acima | Aprovado (ADR-004) |
| Dados de mercado em tempo real | Pago | n/a | Adiado |
| Domínio próprio | Pago | n/a | Adiado |

- Supabase Free pausa o projeto após um período sem uso. Mitigação: o cron diário de notícias mantém o projeto ativo; conferir o comportamento vigente na Fase 1.
- Ultrapassar o teto da IA: a Edge Function para de chamar a API até o mês seguinte (regra IA-03).

## Legais e regulatórias
- O sistema não recomenda compra ou venda. A revisão de IA é informativa.
- IR de day trade: 20% sobre lucro líquido mensal, DARF código 6015 até o último dia útil do mês seguinte, IRRF de 1% sobre o lucro de cada dia operado como antecipação. O sistema calcula como apoio; a responsabilidade de conferência é do usuário. Revisar regras tributárias todo ano.
- Prejuízo de day trade só compensa lucro de day trade.
- LGPD como referência: dado mínimo, sem dado de terceiros além do necessário.

## Técnicas
- Sem integração direta com banco ou corretora (sem credenciais).
- Sem cotação em tempo real na Fase 1 a 3. Preços entram pelo registro manual.
- PWA: notificações push dependem do suporte do navegador; não são requisito do MVP.

## Comportamentais (do próprio dono)
- Capital de trade só com dinheiro que pode perder, depois da reserva completa (regra P-02).
- Aumento de risco por operação só após 100 operações registradas e resultado líquido positivo (regra T-08).
