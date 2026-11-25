# APIs e Edge Functions, Rota do Milhão

O cliente fala com o Supabase pelo SDK, sempre via `src/lib/services`. Edge Functions só para o que exige secret ou agendamento.

## Serviços do cliente
| Serviço | Operações |
|---|---|
| `orcamentoService` | `obterMes`, `abrirMes`, `atualizarItem` |
| `lancamentoService` | `listarMes`, `registrar`, `estornar` |
| `patrimonioService` | `listarAtivos`, `registrarMovimento`, `saldos` |
| `fechamentoService` | `preparar`, `confirmar`, `historico` |
| `tradeService` | `diaAtual`, `registrarOperacao`, `registrarViolacao`, `encerrarOperacao`, `estatisticas` |
| `irService` | `apuracaoMes` |
| `noticiasService` | `revisaoDoDia`, `historico`, `watchlist`, `usoDoMes` |

## Edge Functions
### `revisao-noticias` (ADR-004)
- Disparo: pg_cron, 8h30, dias de pregão. Também `POST` manual autenticado (conta para o teto).
- Entrada: nenhuma (lê a watchlist ativa).
- Passos: verifica teto (IA-03), monta o prompt (`docs/10_PROMPTS`), chama a API, valida o JSON, salva `revisao_noticias` e soma `uso_ia`.
- Saída: `{ id, status: "ok" | "sem_orcamento" | "erro" }`.
- Secrets: `ANTHROPIC_API_KEY`, `MODELO_REVISAO`, `MAX_TOKENS_SAIDA`, `MAX_BUSCAS`, `TETO_MENSAL_CENTAVOS=3000`.

### `fechamento-mensal`
- Disparo: pg_cron, dia 1 às 6h.
- Cria o rascunho do fechamento do mês anterior. Nunca confirma sozinho.

### `abrir-dia-trade`
- Disparo: pg_cron, 8h, dias de pregão. Cria o `dia_trade` com o capital de início.

### `importar-operacoes` (Fase 4)
- Entrada: CSV/relatório do MT5 ou payload do KORA TRADER, autenticado.
- Grava `operacao` com `origem`, passando pelas mesmas travas e validações.

## Erros
Toda função responde `{ erro: { codigo, mensagem } }`, sem dados financeiros na mensagem nem no log.
