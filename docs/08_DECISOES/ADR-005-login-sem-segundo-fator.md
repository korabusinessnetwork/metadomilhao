# ADR-005, Login só com e-mail e senha, sem segundo fator

**Status:** Aceito (substitui a exigência de MFA do plano de segurança e de `memory/decisions.md`)
**Data:** 2026-11-26
**Decisores:** Matheus

## Contexto
O plano de segurança (`docs/11_SEGURANCA`) pedia senha forte + segundo fator (TOTP), e o banco só liberava dados para sessões com o segundo fator verificado (`aal2`). Com o app publicado, o dono pediu para tirar a etapa do segundo fator.

## Decisão
- Login só com e-mail e senha. A tela de segundo fator saiu do app.
- A função `e_dono` do banco deixa de exigir `aal2`: vale só `user_id = auth.uid()` (migration `20261126000008`).
- A Edge Function `revisao-noticias` aceita o JWT do dono sem checar o nível.
- Cadastro de autenticador desligado no Supabase (local e produção).

## O que continua de pé
- Cadastro público desligado: só a conta do dono existe (ADR-002).
- Senha mínima de 12 caracteres com letras, números e símbolos.
- RLS de dono em toda tabela, privilégios explícitos, travas no banco (ADR-003), segredos fora do front.

## Consequências
- Negativa: se a senha do dono vazar, quem a tiver acessa os dados financeiros. Não há segunda barreira.
- Mitigação: senha forte e única, guardada num gerenciador de senhas.
- Para voltar: reverter a migration (`e_dono` com `aal2`), religar o MFA TOTP no Supabase e recolocar a tela `SegundoFator` (histórico do git, commit anterior a esta decisão).
