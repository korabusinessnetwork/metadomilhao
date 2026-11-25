# Backlog, Rota do Milhão

## Fase 0, Preparação (agora até a mudança, ~fev/2027)
- [ ] Lançar todos os gastos reais no protótipo (artifact) por 60 a 90 dias
- [ ] Substituir "Diversos" por categorias reais com base nos lançamentos
- [ ] Começar a reserva de emergência com a sobra de R$ 885
- [ ] Definir a data de mudança no perfil
- [ ] Revisar estas regras de negócio uma vez antes do código

## Fase 1, MVP financeiro (mês 1 após a mudança)
- [x] Supabase: Auth com MFA, schema da modelagem com RLS (local; falta criar o projeto na nuvem)
- [x] Orçamento mensal e categorias
- [x] Lançamentos rápidos (meta: menos de 20 s; 3 toques no teste)
- [x] Limite de gasto diário (M-07 a M-09)
- [x] Patrimônio por classe e reserva (P-01 a P-03; P-02 só na tela até a Fase 2)
- [x] Plano do milhão com cenários e real × projetado (PL-01 a PL-05)
- [x] Fechamento mensal (tela; pré-preenchimento sob demanda, sem cron)
- [x] Metas mensais e anuais (M-01 a M-06)
- [x] Exportação CSV
- [x] PWA instalável no celular e no PC (manifesto e service worker no build)
- [ ] Criar o projeto Supabase na nuvem, aplicar a migration e publicar na Vercel
- [ ] Testar a instalação do PWA no celular de verdade

## Fase 2, Diário de trade
- [ ] Conta de trade, setups, limites (M-10 a M-13)
- [ ] Registro detalhado de operação (T-01 a T-05)
- [ ] Travas no banco e registro de violação (TR-01 a TR-06, ADR-003)
- [ ] Estatísticas (T-06, T-07)
- [ ] Regra de aumento de risco (T-08) e entrada no plano (T-09)
- [ ] Apuração de IR e DARF estimado (IR-01 a IR-04)

## Fase 3, Revisão de notícias por IA
- [ ] Watchlist (máximo 10)
- [ ] Calendário de pregão da B3
- [ ] Edge Function + pg_cron 8h30
- [ ] Trava de custo e painel de uso (IA-03)
- [ ] Vínculo da revisão com a operação (IA-05)

## Fase 4, Integrações
- [ ] Importar operações do MT5
- [ ] Receber operações do KORA TRADER
- [ ] Fila offline de lançamentos

## Ideias (não priorizadas)
- Notificação ao bater 80% do orçamento de uma categoria
- Projeção de renda passiva dos FIIs
