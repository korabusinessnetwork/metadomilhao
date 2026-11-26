# Plano de Segurança, Rota do Milhão

Dado financeiro pessoal. Ameaça principal: vazamento por configuração errada (RLS, chave exposta) e acesso indevido à conta.

## Por camada
| Camada | Controle |
|---|---|
| Autenticação | Supabase Auth, só a conta do dono, cadastro público desativado, senha forte (12+ com letras, números e símbolos). Sem segundo fator por decisão do dono (ADR-005) |
| Autorização | RLS `user_id = auth.uid()` em toda tabela, nas 4 operações |
| Banco | Travas em trigger (ADR-003); `fechamento_mes` imutável; constraints de valor e enum |
| Edge Functions | Verificação de JWT em chamadas manuais; cron com segredo próprio; `ANTHROPIC_API_KEY` só como secret |
| Front | Só `anon key` e URL; nenhum `service_role`; rota protegida só renderiza depois da sessão |
| Logs | Sem valores, saldos, tokens ou conteúdo de revisão nos logs |
| Backup | Exportação CSV mensal pelo dono (Free não tem backup diário garantido) |
| IA | Sem dados financeiros pessoais no prompt: só a watchlist e a data |

## O que nunca é guardado
Senha de banco ou corretora, número de conta, cartão, CPF, token de corretora.

## Checklist (definition of done de toda feature)
- [ ] RLS habilitado e testado com um segundo usuário de teste (deve ver zero linhas)
- [ ] Nenhum `select *` em tabela financeira
- [ ] Inputs validados no cliente e por constraint no banco
- [ ] Sem secrets no repositório (`.env` no `.gitignore`, `.env.example` sem valores)
- [ ] Rota protegida checa sessão antes de renderizar
- [ ] Erros sem dados sensíveis
- [ ] Travas testadas no banco, não só na tela (ADR-003)
- [ ] Teto de custo da IA testado com uso simulado em 80% e 100%
