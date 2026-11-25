# Spec: projeto pronto para deploy na Vercel (T05)

## 1. Escopo
Deixar o repositório publicável na Vercel (Hobby, grátis) com reescrita de SPA, cabeçalhos de segurança e o passo a passo de publicação no README.

## 2. Fora de escopo
Publicar de verdade, criar o projeto Supabase na nuvem, domínio próprio (pendências P01 e custo adiado em `memory/restrictions.md`).

## 3. Origem
ADR-001 (Vercel), `docs/11_SEGURANCA` (só anon key no front), backlog Fase 1.

## 4. Arquivos afetados
`vercel.json` (novo), `scripts/servir-como-vercel.mjs` (novo, para conferir localmente), `README.md`.

## 5. Critérios de aceite
1. `vercel.json` reescreve qualquer rota do app para `index.html` (rota profunda abre).
2. Cabeçalhos em todas as respostas: CSP restrita (scripts só do próprio site; estilos do site e do Google Fonts; fontes do Google; imagens do site e `data:`, para o QR code do segundo fator; conexões só com o site e `*.supabase.co`; sem frames), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` sem câmera, microfone e localização, `X-Frame-Options: DENY`.
3. `sw.js` e `index.html` sem cache longo, para o app atualizar; `assets/` com cache longo e imutável.
4. Servido localmente com exatamente esses cabeçalhos, o app abre, entra com segundo fator e navega sem nenhuma violação de CSP no console (no teste local, a URL do Supabase local entra só no `connect-src`).
5. README com a seção "Publicar": criar o projeto Supabase Free, aplicar as migrations, configurar Auth (cadastro desligado, MFA TOTP, senha forte), criar a conta do dono, publicar na Vercel com as duas variáveis, ligar a revisão de notícias.

## 6. Edge cases
Rota profunda recarregada; atualização do service worker; QR code do MFA (imagem `data:`).

## 7. Aprovado sem ressalvas
Critérios em sim, build sem erro, verificação do item 4 feita no navegador.

## Resultado da review (2026-11-25)
✅ Aprovado sem ressalvas.

| # | Critério | Evidência |
|---|---|---|
| 1 | Reescrita de SPA | `GET /trade/estatisticas` no build servido com o `vercel.json`: 200 com o `index.html` |
| 2 | Cabeçalhos de segurança | CSP, `X-Frame-Options: DENY`, nosniff, Referrer-Policy e Permissions-Policy conferidos na resposta |
| 3 | Cache | `assets/`: `max-age=31536000, immutable`; `sw.js` e `index.html`: `no-cache` |
| 4 | App sem violação de CSP | login com segundo fator e as telas Hoje, Trade, Notícias, Plano e Patrimônio sem nenhuma mensagem no console; fontes do Google carregadas; conexão a site fora da lista bloqueada pelo `connect-src` (prova de que a CSP vale) |
| 5 | README "Publicar" | seção com Supabase, Auth, Vercel, notícias e conferência local |

Não verificado: o QR code do cadastro do segundo fator sob a CSP (o usuário de teste já tinha o fator); `img-src` inclui `data:` para ele.
