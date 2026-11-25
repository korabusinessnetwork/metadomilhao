-- Agendamento da revisão de notícias (ADR-004, IA-01). Rodar UMA vez por ambiente, no SQL editor do Supabase.
-- Não é migration porque leva a URL e o segredo de cada ambiente. Os dois ficam no Vault, nunca no código.
-- Troque os dois valores entre <> antes de rodar. O segredo é o mesmo CRON_SEGREDO cadastrado na Edge Function.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('<https://SEU-PROJETO.supabase.co/functions/v1/revisao-noticias>', 'revisao_noticias_url');
select vault.create_secret('<CRON_SEGREDO>', 'revisao_noticias_segredo');

-- 8h30 em Brasília = 11h30 UTC (o Brasil não tem horário de verão desde 2019). Segunda a sexta;
-- a própria função confere os feriados da B3 e não chama a IA quando não há pregão.
select cron.schedule(
  'revisao-noticias',
  '30 11 * * 1-5',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'revisao_noticias_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-segredo-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'revisao_noticias_segredo')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

-- Conferir: select jobname, schedule, active from cron.job;
-- Histórico: select status, return_message, start_time from cron.job_run_details order by start_time desc limit 10;
-- Desligar: select cron.unschedule('revisao-noticias');
