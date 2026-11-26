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
- [x] Criar o projeto Supabase na nuvem, aplicar as migrations e publicar na Vercel (https://rota-do-milhao-ochre.vercel.app, 26/11/2026)
- [ ] Testar a instalação do PWA no celular de verdade

## Fase 2, Diário de trade
- [x] Conta de trade, setups, limites (M-10 a M-13), com versões que valem do dia seguinte (ADR-003)
- [x] Registro detalhado de operação (T-01 a T-05): planejar, depois registrar a saída
- [x] Travas no banco e registro de violação (TR-01 a TR-06, ADR-003)
- [x] Estatísticas (T-06, T-07)
- [x] Regra de aumento de risco (T-08) e entrada no plano (T-09)
- [x] Apuração de IR e DARF estimado (IR-01 a IR-04)
- [x] P-02 e P-04 aplicadas no banco
- [x] Feriados da B3 no "próximo dia útil" e no vencimento do DARF (Fase 3)

## Fase 3, Revisão de notícias por IA
- [x] Watchlist (máximo 10, garantido no banco)
- [x] Calendário de pregão da B3 (tabela `feriado_b3`, 2026 e 2027) usado nas travas e no DARF
- [x] Edge Function `revisao-noticias` + agendamento pg_cron 8h30 (`supabase/agendamento.sql`)
- [x] Trava de custo e painel de uso (IA-03)
- [x] Vínculo da revisão com a operação (IA-05) e comparação nas estatísticas
- [ ] Conferir os feriados de 2027 com o calendário oficial da B3 e marcar `confirmado`
- [ ] Cadastrar `ANTHROPIC_API_KEY` e `CRON_SEGREDO` como secrets, conferir preços e rodar o agendamento no projeto na nuvem

## Fase 4, Integrações
- [x] Importar operações do MT5: relatório HTML vira rascunho, contexto completado e confirmação em ordem pelo banco (conferência com relatório real adiada pelo dono em 25/11/2026)
- [x] Fila offline de lançamentos: gasto sem internet fica no aparelho, sobe sozinho, não duplica, recusa fica visível

## Ideias (não priorizadas)
- Notificação ao bater 80% do orçamento de uma categoria
- Projeção de renda passiva dos FIIs
