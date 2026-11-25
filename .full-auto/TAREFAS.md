# Tarefas

Legenda: `[ ]` pendente · `[~]` em andamento · `[x]` concluída e verificada · `[!]` bloqueada (com diagnóstico)

Plano: o que falta de `docs/09_BACKLOG/README.md`. Fases 1 a 3 e a fila offline já estão no master (commits 817ef57 a ea7a47a).
O que só o Matheus pode fazer está em `PENDENCIAS-DO-MATHEUS.md`, não aqui.

## Fase A: Importação do MT5 (Fase 4 do backlog)
- [x] T01 Parser do relatório de histórico do MT5 (HTML) | trilha: mt5 | depende: nenhum | pronto quando: testes do parser passam com relatório em português e em inglês, extraindo ativo, direção, volume, entrada, saída, S/L, T/P, horários, comissão e lucro de cada posição fechada
- [x] T02 Rascunhos de importação no banco | trilha: mt5 | depende: T01 | pronto quando: pgTAP prova que o mesmo ticket não importa duas vezes, que confirmar vira operação com origem mt5, que período fechado vira violação marcada e que outro usuário não vê nada
- [~] T03 Tela de importação | trilha: mt5 | depende: T02 | pronto quando: no navegador, um relatório de exemplo vira rascunhos, o contexto é completado e a confirmação grava as operações, que aparecem nas estatísticas

## Fase B: PWA e deploy
- [ ] T04 PWA abre sem internet no build de produção | trilha: pwa | depende: nenhum | pronto quando: com `vite preview` e a API fora do ar, recarregar a tela de gasto abre pelo service worker e o gasto vai para a fila
- [ ] T05 Projeto pronto para deploy na Vercel | trilha: pwa | depende: T04 | pronto quando: `vercel.json` com reescrita de SPA e cabeçalhos de segurança, rota profunda abre no `vite preview`, README com o passo a passo de publicação

## Fase C: Encerramento
- [ ] T06 Verificação final e relatório | trilha: base | depende: todas | pronto quando: instalação limpa, typecheck, testes de cliente, testes de banco, ponta a ponta da IA e fluxo principal no navegador passam, e `RELATORIO-FINAL.md` escrito
