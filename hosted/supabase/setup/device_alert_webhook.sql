-- FrameDecks 26.11.36 - the webhook for new-device alerts (docs/architecture/passwordless.md, owner step 5).
-- Not a migration: it needs pg_net and Supabase Vault, which the local test database does not have. Run it once in
-- the SQL editor after 0023. It does what Database -> Webhooks would: each new row in public.device_alerts is POSTed to
-- the device-alert Edge Function as {type, table, record}, with the header x-alert-secret. The secret's value is never
-- in this file: store it first (the same value as the function's ALERT_WEBHOOK_SECRET):
--   select vault.create_secret('<value>', 'device_alert_webhook_secret');
-- Undo: drop trigger device_alert_webhook on public.device_alerts; drop function public.device_alert_webhook();
create extension if not exists pg_net with schema extensions;

create or replace function public.device_alert_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  secret text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'device_alert_webhook_secret' limit 1;
  if secret is null then
    return new;                                   -- not set up yet: the alert still shows on Devices
  end if;
  perform net.http_post(
    url := 'https://slrsykiknlqlivlnpvrb.supabase.co/functions/v1/device-alert',
    body := jsonb_build_object('type', 'INSERT', 'table', 'device_alerts', 'schema', 'public', 'record', to_jsonb(new)),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-alert-secret', secret),
    timeout_milliseconds := 5000);
  return new;
exception when others then
  return new;                                     -- an email problem never stops a device from joining
end;
$$;
revoke execute on function public.device_alert_webhook() from public, anon, authenticated;

drop trigger if exists device_alert_webhook on public.device_alerts;
create trigger device_alert_webhook after insert on public.device_alerts
  for each row execute function public.device_alert_webhook();
