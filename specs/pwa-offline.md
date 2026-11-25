# Spec: PWA abre sem internet no build de produção (T04)

## 1. Escopo
Confirmar, e corrigir se preciso, que o app instalado abre sem rede: o service worker serve a casca do app, os dados vêm do cache do aparelho e o gasto vai para a fila.

## 2. Fora de escopo
Cache de respostas da API no service worker (dado financeiro fica só no `localStorage` do dono, decisão da Fase 4). Notificação push.

## 3. Origem
Backlog Fase 1 "PWA instalável" e Fase 4 "fila offline". `vite.config.ts` (VitePWA, `navigateFallback`).

## 4. Arquivos afetados
`vite.config.ts` (se precisar), `.claude/launch.json` (configuração de preview).

## 5. Critérios de aceite
1. `npm run build` gera `sw.js` e `manifest.webmanifest` com nome, ícones 192 e 512 e `display: standalone`.
2. Com o build servido por `vite preview`, o service worker fica ativo e controla a página.
3. Com o servidor do app e a API desligados, recarregar `/gastos/novo` (rota profunda) abre a tela pelo service worker.
4. Nessa situação, salvar um gasto coloca na fila e mostra "Gasto guardado no aparelho".
5. Nenhuma resposta da API fica no cache do service worker (só os arquivos do app).

## 6. Edge cases
Rota profunda sem rede (precisa do `navigateFallback`). Atualização do app com service worker antigo (`autoUpdate`).

## 7. Aprovado sem ressalvas
Os 5 critérios conferidos no navegador, build sem erro.

## Resultado da review (2026-11-25)
✅ Aprovado sem ressalvas, sem mudança de código.

| # | Critério | Evidência |
|---|---|---|
| 1 | Build com sw.js e manifesto completo | `dist/manifest.webmanifest`: nome, ícones 192 e 512, `standalone` |
| 2 | Service worker ativo | navegador em `vite preview`: `controller.state = activated` |
| 3 | Abre sem servidor e sem API | servidor do app parado e gateway derrubado; recarregar `/gastos/novo` abriu "Novo gasto" pelo service worker |
| 4 | Gasto vai para a fila | "Gasto guardado no aparelho", fila com 1200, limite de R$ 131,60 para R$ 119,60; enviado ao religar a API |
| 5 | Só arquivos do app no cache | cache `workbox-precache` com 8 arquivos do build, nenhuma rota da API |
