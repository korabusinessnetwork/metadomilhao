# Diretrizes de Desenvolvimento, Rota do Milhão

Constituição do projeto. Leia antes de qualquer mudança relevante.

## Princípio nº 1: Verdade dos números (inegociável)

O sistema existe para mostrar a situação financeira real do Matheus e a distância real até o primeiro milhão. Em qualquer decisão, a honestidade do número vem antes de conveniência técnica ou de uma tela bonita.

Regras práticas:

- Projeção sempre separada de realizado. Nada projetado aparece como se fosse fato.
- Toda projeção mostra as premissas usadas (taxa real, aporte, data de início) ao lado do resultado.
- Valores de longo prazo em dinheiro de hoje (rendimento real, já sem inflação), com o nominal disponível como detalhe.
- O resultado de trade nunca entra no plano do milhão como certo. Ele entra como cenário, e só vira premissa depois de validado por regra (`docs/03_REGRAS_DE_NEGOCIO`, regra T-08).
- Nenhum dado é apagado em silêncio: correções geram histórico.

## Princípio nº 2: Intuitividade

Lançar um gasto ou um trade tem que levar menos de 20 segundos no celular, sem manual.

- Estados sempre visíveis: carregando, erro, vazio e sucesso com feedback humano.
- Prevenção de erro é melhor que mensagem de erro.
- Consistência total com `docs/02_DESIGN_SYSTEM/`.

## Fonte de verdade

- `memory/`: identidade, decisões, padrões, aprendizados e restrições.
- `docs/`: visão, arquitetura, design system, regras de negócio, modelagem, fluxos, componentes, APIs, ADRs, backlog, prompts e segurança.
- ADR-001 define a stack vigente. ADRs em `docs/08_DECISOES/`.
- Schema do banco: `supabase/schema.sql` (nasce na Fase 1, a partir de `docs/04_MODELAGEM`).
- Se doc e código conflitarem, a documentação prevalece, e deve ser corrigida quando estiver errada.
- Produto = ferramenta pessoal, um usuário só (ADR-002). Mesmo assim, toda tabela tem `user_id` e RLS de dono.

## Processo de trabalho

1. Planejar tudo antes de executar: escopo fechado, sem retrabalho.
2. Disciplina de engenharia com evidência (skill `engenharia-com-evidencia`): causa raiz, teste antes, nada pronto sem prova.
3. Builds multi-parte podem usar fan-out paralelo com dono exclusivo por arquivo.
4. Validar no fim: testes, build e checagem contra a regra de negócio correspondente.

## Custo

Fase bootstrap: tudo em tier gratuito (Supabase Free, Vercel Hobby).

Única despesa aprovada: API do Claude para a revisão diária de notícias, com teto de R$ 30/mês e trava no próprio sistema (ADR-004).

Qualquer outro item pago é adiado por padrão. Ao esbarrar em algo pago, apresente custo aproximado, alternativa gratuita, impacto e recomendação. O dono decide.

## Segurança (obrigatório em todo código novo)

- Nunca hardcodar chaves, URLs de API ou secrets. Front usa só `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- A chave da API do Claude vive só em secret de Edge Function. Nunca no front, nunca no repositório.
- `service_role` nunca no front.
- Nunca `select *` em tabelas financeiras: campos explícitos.
- Validar todo input antes de gravar (valores positivos, datas válidas, enums).
- Nunca logar valores financeiros, saldos ou tokens.
- Nunca guardar senha de banco, corretora, número de conta ou cartão.
- Travas de risco aplicadas no banco, não só na tela (ADR-003).
- RLS habilitado e testado em toda tabela.
- Plano completo em `docs/11_SEGURANCA/`.

## Padrões de código

- Organização por feature: `src/features/<orcamento|metas|trade|patrimonio|noticias|plano>/`.
- Todo acesso ao Supabase passa por `src/lib/services/`, nunca direto no componente.
- Dinheiro em centavos inteiros (`bigint`) no banco e na lógica. Formatação só na borda.
- Cálculos (projeção, expectativa, metas, IR) em funções puras com teste unitário.
- Nomes de domínio em português (`registrarOperacao`), padrões técnicos em inglês (`handleSubmit`).
- Tratar erro de toda chamada ao backend (`.error` ou `try/catch`).
- CSS separado do JSX, tokens do design system.
- Textos da interface em português do Brasil, sem travessão.

## Stack

- React + Vite + TypeScript, PWA (instalável no celular e no PC)
- Supabase: Auth, Postgres com RLS, Edge Functions, pg_cron
- React Router
- Context API (sem Redux)
- Deploy: Vercel
- IA: API do Claude via Edge Function agendada (ADR-004)
