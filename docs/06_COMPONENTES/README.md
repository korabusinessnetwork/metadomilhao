# Componentes e Telas, Rota do Milhão

## Telas
| Tela | Feature | Conteúdo principal | Fase |
|---|---|---|---|
| Hoje | `metas` | Limite de gasto do dia, status do trade, revisão de notícias, prazo do milhão | 1 (trade na 2, notícias na 3) |
| Gastos | `lancamentos` | Lista do mês, realizado × orçado por categoria | 1 |
| Orçamento | `orcamento` | Categorias, valores, renda prevista, data de mudança | 1 |
| Plano | `plano` | Curva real × projetada, cenários, metas anuais | 1 |
| Patrimônio | `patrimonio` | Ativos por classe, reserva, movimentos | 1 |
| Fechamento | `metas` | Fluxo de fechamento mensal | 1 |
| Trade, dia | `trade` | Status das travas, formulário, operações do dia | 2 |
| Trade, estatísticas | `trade` | Acerto, payoff, expectativa, drawdown, por setup e timeframe | 2 |
| IR | `trade` | Apuração mensal, DARF estimado | 2 |
| Notícias | `noticias` | Revisão do dia, histórico, watchlist, uso do teto | 3 |
| Configurações | `config` | Limites de risco, taxa real, setups, exportação CSV | 1 |

## Componentes compartilhados
| Componente | Uso |
|---|---|
| `Dinheiro` | Formata centavos em BRL, com sinal e cor semântica |
| `Prazo` | Converte meses em "X anos e Y meses" |
| `BarraMeta` | Progresso realizado × meta, com estouro |
| `SeloProjecao` | Marca qualquer número projetado |
| `FaixaTrava` | Aviso de período fechado com hora de reabertura |
| `CampoValor` | Input numérico de dinheiro (teclado numérico, centavos) |
| `SeletorCategoria` | Categorias com as mais usadas primeiro |
| `GraficoPatrimonio` | Linha real × projetada × meta |
| `EstadoVazio` | Vazio com a próxima ação sugerida |
| `BotaoNovoLancamento` | "+" fixo, abre gasto ou operação |
