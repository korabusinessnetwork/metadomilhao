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
- Secrets: `ANTHROPIC_API_KEY`, `CRON_SEGREDO`. Configuração: `MODELO_REVISAO` (padrão `claude-haiku-5-5`), `MAX_TOKENS_SAIDA`, `MAX_BUSCAS`, `TETO_MENSAL_CENTAVOS=3000`, `ESFORCO`, `PRECO_ENTRADA_USD_MTOK`, `PRECO_SAIDA_USD_MTOK`, `PRECO_BUSCA_USD`, `COTACAO_USD_BRL`, `ORIGEM_APP`. Modelo em `supabase/functions/.env.example`.
- Acesso: o cron manda o cabeçalho `x-segredo-cron`; o disparo manual manda o JWT do dono (sem exigir segundo fator, ADR-005). `verify_jwt` fica desligado porque a função valida por conta própria.
- Saída manual: `{ id, status: "ok" | "sem_orcamento" | "erro" | "sem_watchlist" }`. Agendada: `{ resultados: [...] }` ou `{ status: "sem_pregao" }`.

### `fechamento-mensal` e `abrir-dia-trade` (não criadas)
- Ficaram desnecessárias: o rascunho do fechamento é calculado quando a tela abre, e o status do dia de trade é calculado das operações (`status_travas`). Ver `memory/decisions.md`.

### `importar-operacoes` (Fase 4)
- Entrada: relatório exportado do MT5, autenticado.
- Grava `operacao` com `origem`, passando pelas mesmas travas e validações.

## Erros
Toda função responde `{ erro: { codigo, mensagem } }`, sem dados financeiros na mensagem nem no log.
